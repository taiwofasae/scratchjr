// web-adapter.js
// Replaces the native iOS/Android tablet interface so the ScratchJr bundle
// can initialise in a plain browser context.
//
// Must be loaded synchronously before app.bundle.js.
// The bundle checks `typeof AndroidInterface` to decide whether it is running
// on iOS or Android. Because AndroidInterface is never defined here, the bundle
// treats the environment as iOS and delegates all tablet calls to window.tablet,
// which this file provides.

(function () {
    // In-memory store for media assets (md5/filename -> base64 data URL).
    // Populated by url-loader.js after unzipping a .sjr file.
    window.WebAdapter = {
        assetStore: {}
    };

    // Simple non-cryptographic hash used to generate stable md5-like keys
    // for assets that the runtime asks us to store.
    function simpleHash(str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            var ch = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + ch;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    // Fetch settings.json synchronously and return the comma-separated string
    // the editor entry point expects: "<path>,0"
    // The editor entry point (src/entry/editor.js) calls OS.getsettings(fcn)
    // and then splits the result on commas: list[0] is the path, list[1] is
    // a flag for whether a custom path is set.
    function fetchSettings(fcn) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'settings.json', false); // synchronous — fine for a local file
        try {
            xhr.send(null);
        } catch (e) {
            // If the synchronous request fails, fall back to an empty path.
            if (fcn) { fcn(',0'); }
            return;
        }
        if (xhr.status === 200 || xhr.status === 0) {
            try {
                var settings = JSON.parse(xhr.responseText);
                window.Settings = settings;
            } catch (e) {
                console.warn('web-adapter: could not parse settings.json', e);
            }
        }
        // The editor entry point only uses list[0] (path) and list[1] (flag).
        // Passing an empty path tells the runtime to use relative asset paths.
        if (fcn) { fcn(',0'); }
    }

    // The tablet object that the bundle calls into.
    window.tablet = {

        // --- Settings ---

        getsettings: function (fcn) {
            fetchSettings(fcn);
        },

        // --- Media I/O ---

        getmedia: function (md5, fcn) {
            var data = window.WebAdapter.assetStore[md5];
            if (data) {
                if (fcn) { fcn(data); }
            } else {
                // Asset not in store — return empty string so the runtime
                // does not hang waiting for a callback.
                if (fcn) { fcn(''); }
            }
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
            var hash = simpleHash(str);
            if (fcn) { fcn(hash); }
        },

        remove: function (str, fcn) {
            delete window.WebAdapter.assetStore[str];
            if (fcn) { fcn(); }
        },

        getfile: function (name, fcn) {
            // Scroll-state files are stored as btoa-encoded numbers.
            // Return btoa("0") so the runtime gets a valid value.
            if (fcn) { fcn(btoa('0')); }
        },

        setfile: function (name, str, fcn) {
            if (fcn) { fcn(); }
        },

        cleanassets: function (ft, fcn) {
            if (fcn) { fcn(); }
        },

        // --- Database (SQLite) ---
        // The viewer is read-only. All queries return empty result sets and
        // all write statements are no-ops.

        query: function (json, fcn) {
            if (fcn) { fcn('[]'); }
        },

        stmt: function (json, fcn) {
            if (fcn) { fcn(); }
        },

        // --- Sound ---

        registerSound: function (dir, name, fcn) {
            if (fcn) { fcn(); }
        },

        playSound: function (name, fcn) {
            if (fcn) { fcn(); }
        },

        stopSound: function (name, fcn) {
            if (fcn) { fcn(); }
        },

        sndrecord: function (fcn) {
            if (fcn) { fcn(); }
        },

        recordstop: function (fcn) {
            if (fcn) { fcn(); }
        },

        volume: function (fcn) {
            if (fcn) { fcn(0); }
        },

        startplay: function (fcn) {
            if (fcn) { fcn(); }
        },

        stopplay: function (fcn) {
            if (fcn) { fcn(); }
        },

        recorddisappear: function (b, fcn) {
            if (fcn) { fcn(); }
        },

        askpermission: function () {},

        // --- Camera ---

        hascamera: function () {
            return false;
        },

        startfeed: function (data, fcn) {
            if (fcn) { fcn(); }
        },

        stopfeed: function (fcn) {
            if (fcn) { fcn(); }
        },

        choosecamera: function (mode, fcn) {
            if (fcn) { fcn(); }
        },

        captureimage: function (fcn) {
            if (fcn) { fcn(); }
        },

        hidesplash: function (fcn) {
            if (fcn) { fcn(); }
        },

        // --- Sharing ---

        createZipForProject: function (projectData, metadata, name, fcn) {
            if (fcn) { fcn(name); }
        },

        sendSjrToShareDialog: function () {},

        registerLibraryAssets: function (version, assets, fcn) {
            if (fcn) { fcn(); }
        },

        duplicateAsset: function (path, name, fcn) {
            if (fcn) { fcn(); }
        },

        deviceName: function (fcn) {
            if (fcn) { fcn('Web Viewer'); }
        },

        // --- Analytics ---

        analyticsEvent: function () {},
        setAnalyticsPlacePref: function () {},
        setAnalyticsPref: function () {},

        // postMessage is called by the iOS class in the bundle when it wants
        // to communicate with the native layer. We intercept it here and
        // immediately resolve the pending callback with an empty result so
        // the async chains in iOS.js do not hang.
        postMessage: function (msg) {
            // The iOS class stores callbacks keyed by msg.id and resolves
            // them via window.iOS.resolve(id, result). We call that here.
            if (window.iOS && window.iOS.resolve) {
                setTimeout(function () {
                    window.iOS.resolve(msg.id, '');
                }, 0);
            }
        }
    };
})();
