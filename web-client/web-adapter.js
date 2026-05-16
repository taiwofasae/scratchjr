// web-adapter.js
// Replaces the native iOS/Android tablet interface so the ScratchJr bundle
// can initialise in a plain browser context.
// Must be loaded synchronously before app.bundle.js.

(function () {

    window.WebAdapter = {
        assetStore: {}
    };

    function simpleHash(str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    function emptyProjectRow() {
        return JSON.stringify([{
            id: 1,
            name: 'Untitled',
            version: (window.Settings && window.Settings.scratchJrVersion) || 'iOSv01',
            deleted: 'NO',
            mtime: Date.now().toString(),
            isgift: '0'
        }]);
    }

    window.tablet = {

        // editor.js: OS.path = list[1]=='0' ? list[0]+'/' : undefined
        // Returning ',1' keeps OS.path = undefined so asset URLs stay relative.
        getsettings: function (fcn) {
            if (fcn) { fcn(',1'); }
        },

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
            if (fcn) { fcn(btoa('0')); }
        },

        setfile: function (name, str, fcn) {
            if (fcn) { fcn(); }
        },

        cleanassets: function (ft, fcn) {
            if (fcn) { fcn(); }
        },

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

        hascamera:    function ()          { return false; },
        startfeed:    function (data, fcn) { if (fcn) { fcn(); } },
        stopfeed:     function (fcn)       { if (fcn) { fcn(); } },
        choosecamera: function (mode, fcn) { if (fcn) { fcn(); } },
        captureimage: function (fcn)       { if (fcn) { fcn(); } },
        hidesplash:   function (fcn)       { if (fcn) { fcn(); } },

        createZipForProject:   function (data, meta, name, fcn) { if (fcn) { fcn(name); } },
        sendSjrToShareDialog:  function () {},
        registerLibraryAssets: function (v, assets, fcn) { if (fcn) { fcn(); } },
        duplicateAsset:        function (path, name, fcn) { if (fcn) { fcn(); } },
        deviceName:            function (fcn) { if (fcn) { fcn('Web Viewer'); } },

        analyticsEvent:        function () {},
        setAnalyticsPlacePref: function () {},
        setAnalyticsPref:      function () {},

        postMessage: function (msg) {
            if (!window.iOS || !window.iOS.resolve) { return; }
            var method = msg.method || '';
            var result = '';

            if (method === 'database_query') {
                // Parse the JSON statement to decide what to return.
                try {
                    var q = JSON.parse(msg.params[0]);
                    var stmt = q.stmt || '';
                    if (stmt.indexOf('from projects') !== -1) {
                        result = emptyProjectRow();
                    } else {
                        // All other queries (usershapes, userbkgs, etc.) return empty array.
                        result = '[]';
                    }
                } catch (e) {
                    result = '[]';
                }
            } else if (method === 'database_stmt') {
                result = '';
            } else if (method === 'io_getsettings') {
                result = ',1';
            } else if (method === 'io_getfile') {
                result = btoa('0');
            } else if (method === 'io_getmd5') {
                var s = (msg.params && msg.params[0]) ? String(msg.params[0]) : '';
                result = simpleHash(s);
            } else if (method === 'io_getmedialen') {
                result = 0;
            } else if (method === 'scratchjr_cameracheck') {
                result = false;
            }

            setTimeout(function () {
                window.iOS.resolve(msg.id, result);
            }, 0);
        }
    };

})();
