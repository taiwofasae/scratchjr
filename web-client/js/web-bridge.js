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
                        language: (window.Settings && window.Settings.defaultLocale) ? window.Settings.defaultLocale : "en"
                    }
                };

                const sendResponse = () => {
                    // 1. Try to find the instance in multiple possible locations 
                    let instance = null; 
                    
                    // Check for the instance we created in index.html 
                    if (window.ScratchJrInstance && typeof window.ScratchJrInstance.onMessage === 'function') { 
                        instance = window.ScratchJrInstance; 
                    } 
                    // Check if window.OS is an instance (not the constructor) 
                    else if (window.OS && typeof window.OS !== 'function' && typeof window.OS.onMessage === 'function') { 
                        instance = window.OS; 
                    } 
                    // Check if window.ScratchJr is an instance (not the constructor) 
                    else if (window.ScratchJr && typeof window.ScratchJr !== 'function' && typeof window.ScratchJr.onMessage === 'function') { 
                        instance = window.ScratchJr; 
                    } 
                    // Check if window.ScratchJr.app exists 
                    else if (window.ScratchJr && window.ScratchJr.app && typeof window.ScratchJr.app.onMessage === 'function') { 
                        instance = window.ScratchJr.app; 
                    } 

                    // 2. Check if the receiver function exists on that instance
                    const receiver = instance ? instance.onMessage : null;

                    if (typeof receiver === 'function') {
                        receiver.call(instance, JSON.stringify(response));
                        console.log("[Web Bridge] Success! Settings injected into core instance.");
                    } else {
                        // Log what we have to help debugging 
                        console.log("[Web Bridge] Waiting for app instance..."); 
                        console.log("  - window.ScratchJrInstance:", typeof window.ScratchJrInstance, window.ScratchJrInstance ? Object.keys(window.ScratchJrInstance) : 'none'); 
                        console.log("  - window.OS type:", typeof window.OS); 
                        console.log("  - window.ScratchJr type:", typeof window.ScratchJr); 
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
            // Fetch assets from the assets directory
            return fetch(`assets/${filename}`)
                .then(res => res.text())
                .then(content => content)
                .catch(err => {
                    console.error(`[Web Bridge] Failed to load file ${filename}:`, err);
                    return "";
                });
        }
    };


    // This part Mocks the iOS object
    window.iOS = {
        handleQuery: function (json) {
            window.tablet.postMessage(json);
        },
        registerApp: function(appInstance) { 
            console.log("[Web Bridge] App registered successfully!"); 
            console.log("[Web Bridge] App instance methods:", Object.keys(appInstance)); 
            
            // Store the instance in multiple places for compatibility 
            window.ScratchJrInstance = appInstance; 
            if (!window.OS || typeof window.OS === 'function') { 
                window.OS = appInstance; 
            } 
            
            // Now that we have the real instance, inject the pending URL data 
            if (window.pendingSjrData) { 
                console.log("[Web Bridge] Loading pending project data..."); 
                if (typeof appInstance.loadProjectFromSjr === 'function') { 
                    appInstance.loadProjectFromSjr(window.pendingSjrData); 
                    delete window.pendingSjrData; 
                } else if (window.OS && typeof window.OS.loadProjectFromSjr === 'function') { 
                    window.OS.loadProjectFromSjr(window.pendingSjrData); 
                    delete window.pendingSjrData; 
                } else { 
                    console.error("[Web Bridge] No loadProjectFromSjr method found. Available methods:", Object.keys(appInstance)); 
                } 
            } 
        },
        loadProjectFromSjr: function (b64data) {
            console.log("[Web Bridge] loadProjectFromSjr called with base64 data");
            console.log("[Web Bridge] Data length:", b64data ? b64data.length : 0); 
            
            // Try multiple locations for the target instance 
            let target = window.ScratchJrInstance; 
            if (!target || typeof target.loadProjectFromSjr !== 'function') { 
                target = window.OS; 
            } 
            if (!target || typeof target.loadProjectFromSjr !== 'function') { 
                target = window.ScratchJr; 
            } 
            
            if (target && typeof target.loadProjectFromSjr === 'function') { 
                console.log("[Web Bridge] Found loadProjectFromSjr, loading..."); 
                target.loadProjectFromSjr(b64data); 
                if (window.pendingSjrData) delete window.pendingSjrData; 
            } else { 
                console.warn("[Web Bridge] No loadProjectFromSjr method found. Available targets:"); 
                console.log("  - window.ScratchJrInstance:", window.ScratchJrInstance ? Object.keys(window.ScratchJrInstance) : 'undefined'); 
                console.log("  - window.OS:", window.OS ? (typeof window.OS === 'function' ? 'constructor' : Object.keys(window.OS)) : 'undefined'); 
                console.log("  - window.ScratchJr:", typeof window.ScratchJr); 
                window.pendingSjrData = b64data; 
                
                // If we have the constructor but no instance, try to instantiate 
                if (typeof window.ScratchJr === 'function' && !window.ScratchJrInstance) { 
                    console.log("[Web Bridge] Attempting to instantiate ScratchJr from constructor..."); 
                    try { 
                        window.ScratchJrInstance = new window.ScratchJr(); 
                        window.OS = window.ScratchJrInstance; 
                        // Re-run the check with the new instance
                        window.iOS.loadProjectFromSjr(b64data);
                    } catch(e) { 
                        console.error("[Web Bridge] Failed to instantiate:", e); 
                    } 
                }
            }
        }
    };
})();