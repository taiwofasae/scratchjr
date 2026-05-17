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

    // Web Audio context for playing sounds
    var audioContext = null;
    var audioBuffers = {};

    function getAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioContext;
    }

    function loadAudioBuffer(url, name, fcn) {
        var ctx = getAudioContext();
        fetch(url)
            .then(function (r) { return r.arrayBuffer(); })
            .then(function (buf) { return ctx.decodeAudioData(buf); })
            .then(function (decoded) {
                audioBuffers[name] = decoded;
                if (fcn) { fcn(name); }
            })
            .catch(function () {
                if (fcn) { fcn('error'); }
            });
    }

    function playAudioBuffer(name) {
        var buffer = audioBuffers[name];
        if (!buffer) { return; }
        var ctx = getAudioContext();
        var source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        source.onended = function () {
            if (window.ScratchAudio) {
                window.ScratchAudio.soundDone(name);
            }
        };
    }

    window.tablet = {

        // Returning ',1' keeps OS.path undefined so the runtime uses relative asset paths
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
                try {
                    var q = JSON.parse(msg.params[0]);
                    var stmt = q.stmt || '';
                    result = stmt.indexOf('from projects') !== -1 ? emptyProjectRow() : '[]';
                } catch (e) {
                    result = '[]';
                }
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
            } else if (method === 'io_registersound') {
                // params: [dir, name]
                var dir = (msg.params && msg.params[0]) ? msg.params[0] : '';
                var sndName = (msg.params && msg.params[1]) ? msg.params[1] : '';

                // Check if the sound is in the asset store (from a loaded .sjr)
                var assetData = window.WebAdapter.assetStore[sndName];
                if (assetData) {
                    var base64 = assetData.split(',')[1];
                    var binary = atob(base64);
                    var bytes = new Uint8Array(binary.length);
                    for (var i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); }
                    var ctx = getAudioContext();
                    ctx.decodeAudioData(bytes.buffer, function (decoded) {
                        audioBuffers[sndName] = decoded;
                        window.iOS.resolve(msg.id, sndName + ',0');
                    }, function () {
                        window.iOS.resolve(msg.id, 'error');
                    });
                    return;
                } else {
                    // UI sound — ScratchAudio requests 'HTML5/sounds/cut.wav' but
                    // the files live at 'sounds/cut.wav' relative to viewer.html
                    var fetchUrl = dir.replace('HTML5/', '') + sndName;
                    loadAudioBuffer(fetchUrl, sndName, function (name) {
                        window.iOS.resolve(msg.id, name === 'error' ? 'error' : sndName + ',0');
                    });
                    return;
                }
            } else if (method === 'io_playsound') {
                var playName = (msg.params && msg.params[0]) ? msg.params[0] : '';
                playAudioBuffer(playName);
            } else if (method === 'io_stopsound') {
                // No-op — Web Audio sources can't be stopped by name easily
            }

            setTimeout(function () {
                window.iOS.resolve(msg.id, result);
            }, 0);
        }
    };

})();
