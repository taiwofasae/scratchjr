// web-bridge.js
(function createWebBridge() {
    let db;

    // Load Wasm SQL on Startup
    initSqlJs({ locateFile: file => `js/${file}` }).then(SQL => {
        // Initialize an in-memory database
        db = new SQL.Database();
        console.log("[Web Bridge] In-memory SQLite initialized.");

        // Create the basic tables ScratchJr expects
        db.run(`
            CREATE TABLE IF NOT EXISTS PROJECTS (
                ID INTEGER PRIMARY KEY AUTOINCREMENT, 
                NAME TEXT, 
                THUMBNAIL TEXT, 
                DATA TEXT, 
                VERSION TEXT, 
                MTIME DATETIME
            );
            CREATE TABLE IF NOT EXISTS USERSettings (
                SETTING TEXT PRIMARY KEY, 
                VALUE TEXT
            );
        `);
        console.log("[Web Bridge] Database schema created.");


        // Restore existing data from browser cache if available
        const savedData = localStorage.getItem("scratchjr_db");
        if (savedData) {
            const u8 = new Uint8Array(JSON.parse(savedData));
            db = new SQL.Database(u8);
            console.log("[Web Bridge] Restored database state from local cache.");
        }
    });

    // Create global object to trick the ScratchJr Core
    window.handleDatabaseQuery = function (res) {
        console.log("[Web Bridge] handleDatabaseQuery called:", res);
    };

    window.tablet = {
        postMessage: function (message) {
            console.log("[Web Bridge] Message received from ScratchJr:", message);

            // FIX: Check if message is already an object or needs parsing
            let data;
            if (typeof message === 'string') {
                try {
                    data = JSON.parse(message);
                } catch (e) {
                    console.error("[Web Bridge] Failed to parse message string:", e);
                    return;
                }
            } else {
                data = message; // Use it directly if it's already an object
            }

            if (data.method === 'io_getsettings') {
                console.log("[Web Bridge] Handling method: io_getsettings");
                const response = {
                    id: data.id,
                    result: {
                        is_ios: false,
                        is_android: false,
                        is_web: true,
                        language: "en"
                    }
                };

                const sendResponse = () => {
                    // 1. Try to find the instance. It might be ScratchJr, OS, or a hidden app property
                    const instance = (typeof window.ScratchJr === 'object') ? window.ScratchJr :
                        (window.ScratchJr && window.ScratchJr.app) ? window.ScratchJr.app : null;

                    // 2. Check if the receiver function exists on that instance
                    const receiver = instance ? instance.onMessage : null;

                    if (typeof receiver === 'function') {
                        receiver.call(instance, JSON.stringify(response));
                        console.log("[Web Bridge] Success! Settings injected into core instance.");
                    } else {
                        // 3. Technical Note: If ScratchJr is still a function, we try to force-start it
                        if (typeof window.ScratchJr === 'function' && !window.scratchJrInitialized) {
                            console.log("[Web Bridge] Attempting to manually instantiate ScratchJr...");
                            try {
                                // This triggers the constructor if the bundle didn't do it automatically
                                new window.ScratchJr();
                                window.scratchJrInitialized = true;
                            } catch (e) {
                                console.log("[Web Bridge] Manual start waiting for DOM...");
                            }
                        }

                        console.log("[Web Bridge] Waiting for app instance... (Current state: " + typeof window.ScratchJr + ")");
                        setTimeout(sendResponse, 500);
                    }
                };
                sendResponse();
            } else if (data.func === 'onDatabaseQuery') {
                console.log("[Web Bridge] Handling method: onDatabaseQuery");
                if (typeof handleDatabaseQuery === 'function') {
                    handleDatabaseQuery(data.args ? data.args[0] : null);
                }
            }
        },
        database_stmt: function (json) {
            const data = JSON.parse(json);
            db.run(data.stmt, data.values || []);

            // Save state to browser's memory on every change
            const binaryState = db.export();
            localStorage.setItem("scratchjr_db", JSON.stringify(Array.from(binaryState)));
            return JSON.stringify({ status: "success" });
        },
        database_query: function (json) {
            const data = JSON.parse(json);
            const res = db.exec(data.stmt, data.values || []);

            // Return query results to core engine exactly as expected
            if (res.length === 0) return JSON.stringify([]);
            const formatted = res[0].values.map(row => {
                let obj = {};
                res[0].columns.forEach((col, i) => obj[col] = row[i]);
                return obj;
            });
            return JSON.stringify(formatted);
        },
        io_getfile: function (filename) {
            console.log(`[Web Bridge] Requesting file: ${filename}`);
        }
    };


    // This part Mocks the iOS object
    window.iOS = {
        handleQuery: function (json) {
            window.tablet.postMessage(json);
        }
    };
})();