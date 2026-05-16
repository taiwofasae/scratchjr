// web-adapter.js
// Replaces the native iOS/Android tablet interface so the ScratchJr bundle
// can initialise in a plain browser context.
//
// Loaded from editions/free/src/viewer.html, so all relative paths in the
// bundle resolve correctly against editions/free/src/ — no path rewriting needed.
//
// Must be loaded synchronously before app.bundle.js so window.tablet is in
// place when the bundle evaluates and sets isiOS / isAndroid flags.

(function () {

    // In-memory store for project media assets: md5/filename -> base64 data URL.
    // Populated by url-loader.js after unzipping a .sjr file.
    window.WebAdapter = {
        assetStore: {}
    };

    // Simple hash used to generate keys when the runtime asks us to store media.
    function simpleHash(str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    // Returns a JSON string representing a single empty project row.
    // Project.dataRecieved does JSON.parse(str)[0] then checks row.json.
    // Returning a row with no json field causes the runtime to create a
    // blank page — exactly what we want for an empty project.
    function emptyProjectRow() {
        return JSON.stringify([{
            id: 1,
            name: 'Untitled',
            version: window.Settings ? window.Settings.scratchJrVersion : 'iOSv01',
            deleted: 'NO',
            mtime: Date.now().toString(),
            isgift: '0'
        }]);
    }

    window.tablet = {

        // --- Settings ---
        // editor.js calls OS.getsettings(fcn) and splits the result on commas.
        // list[0] = path prefix, list[1] = '0' means no custom path.
        // Returning ',0' tells the runtime to use default relative asset paths.
        getsettings: function (fcn) {
            if (fcn) { fcn(',0'); }
        },

        // --- Media I/O ---

        getmedia: function (md5, fcn) {
            var data = window.WebAdapter.assetStore[md5];
            if (fcn) { fcn(data || ''); }
        },

        setmedia: function (str, ext, fcn) {
            var key = simpleHash(str) + '.' + ext;
            window.WebAdapter.assetStore[key] = str;
            if (fcn) { fcn(key); }
        },

        setmedianame: function (str, name, ext, fcn) {
            var key = name + '.' + ext;
            window.WebAdapter.assetStore[key] = str;
            if (fcn) { fcn(key); }
        },

        getmd5: function (str, fcn) {
            if (fcn) { fcn(simpleHash(str)); }
        },

        remove: function (str, fcn) {
            delete window.WebAdapter.assetStore[str];
            if (fcn) { fcn(); }
        },

        getfile: function (name, fcn) {
            // Scroll-state files — return btoa('0') so the runtime gets a valid value.
            if (fcn) { fcn(btoa('0')); }
        },

        setfile: function (name, str, fcn) {
            if (fcn) { fcn(); }
        },

        cleanassets: function (ft, fcn) {
            if (fcn) { fcn(); }
        },

        // --- Database ---
        // The viewer is read-only. Project queries return a single empty project
        // row so the runtime creates a blank stage instead of crashing on
        // JSON.parse('[]')[0] being undefined.

        query: function (json, fcn) {
            if (!fcn) { return; }
            var stmt = (json && json.stmt) ? json.stmt : '';
            if (stmt.indexOf('from projects') !== -1) {
                fcn(emptyProjectRow());
            } else {
                fcn('[]');
            }
        },

        stmt: function (json, fcn) {
            if (fcn) { fcn(); }
        },

        // --- Sound ---

        registerSound:   function (dir, name, fcn) { if (fcn) { fcn(); } },
        playSound:       function (name, fcn)       { if (fcn) { fcn(); } },
        stopSound:       function (name, fcn)       { if (fcn) { fcn(); } },
        sndrecord:       function (fcn)             { if (fcn) { fcn(); } },
        recordstop:      function (fcn)             { if (fcn) { fcn(); } },
        volume:          function (fcn)             { if (fcn) { fcn(0); } },
        startplay:       function (fcn)             { if (fcn) { fcn(); } },
        stopplay:        function (fcn)             { if (fcn) { fcn(); } },
        recorddisappear: function (b, fcn)          { if (fcn) { fcn(); } },
        askpermission:   function () {},

        // --- Camera ---

        hascamera:    function ()          { return false; },
        startfeed:    function (data, fcn) { if (fcn) { fcn(); } },
        stopfeed:     function (fcn)       { if (fcn) { fcn(); } },
        choosecamera: function (mode, fcn) { if (fcn) { fcn(); } },
        captureimage: function (fcn)       { if (fcn) { fcn(); } },
        hidesplash:   function (fcn)       { if (fcn) { fcn(); } },

        // --- Sharing ---

        createZipForProject:   function (data, meta, name, fcn) { if (fcn) { fcn(name); } },
        sendSjrToShareDialog:  function () {},
        registerLibraryAssets: function (v, assets, fcn) { if (fcn) { fcn(); } },
        duplicateAsset:        function (path, name, fcn) { if (fcn) { fcn(); } },
        deviceName:            function (fcn) { if (fcn) { fcn('Web Viewer'); } },

        // --- Analytics ---

        analyticsEvent:        function () {},
        setAnalyticsPlacePref: function () {},
        setAnalyticsPref:      function () {},

        // postMessage is called by the iOS class inside the bundle whenever it
        // needs to talk to the native layer. We immediately resolve the pending
        // promise so the async chains in iOS.js complete without hanging.
        postMessage: function (msg) {
            if (window.iOS && window.iOS.resolve) {
                setTimeout(function () {
                    window.iOS.resolve(msg.id, '');
                }, 0);
            }
        }
    };

})();
