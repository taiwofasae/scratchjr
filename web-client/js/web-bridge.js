// web-bridge.js
(function createWebBridge() {
    let db;

    // Load Wasm SQL on Startup
    initSqlJs({ locateFile: file => `js/${file}` }).then(SQL => {
        // Initialize an in-memory database
        db = new SQL.Database();
        console.log("[Web Bridge] In-memory SQLite initialized.");

        // Restore existing data from browser cache if available
        const savedData = localStorage.getItem("scratchjr_db");
        if (savedData) {
            const u8 = new Uint8Array(JSON.parse(savedData));
            db = new SQL.Database(u8);
            console.log("[Web Bridge] Restored database state from local cache.");
        }
    });

    // Create global object to trick the ScratchJr Core
    window.tablet = {
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
})();