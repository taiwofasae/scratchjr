(function () {

    function showOverlay(message) {
        var overlay = document.getElementById('url-loader-overlay');
        var status = document.getElementById('url-loader-status');
        if (overlay) { overlay.classList.remove('hidden'); }
        if (status) { status.textContent = message || 'Loading project...'; }
    }

    function hideOverlay() {
        var overlay = document.getElementById('url-loader-overlay');
        if (overlay) { overlay.classList.add('hidden'); }
    }

    function showError(message) {
        hideOverlay();
        var banner = document.getElementById('url-loader-error');
        if (banner) {
            banner.textContent = message;
            banner.style.display = 'block';
            setTimeout(function () { banner.style.display = 'none'; }, 8000);
        }
        console.error(message);
    }

    function parseSjr(arrayBuffer) {
        return JSZip.loadAsync(arrayBuffer).then(function (zip) {
            var jsonFile = null;
            var assetFiles = [];

            zip.forEach(function (relativePath, zipEntry) {
                if (!zipEntry.dir) {
                    var name = relativePath.split('/').pop();
                    if (name.match(/\.json$/i)) {
                        jsonFile = zipEntry;
                    } else {
                        assetFiles.push({ name: name, entry: zipEntry });
                    }
                }
            });

            if (!jsonFile) {
                throw new Error('Not a valid .sjr file: no project JSON found in archive.');
            }

            var assetPromises = assetFiles.map(function (item) {
                return item.entry.async('base64').then(function (b64) {
                    var ext = item.name.split('.').pop().toLowerCase();
                    var mime = ext === 'svg' ? 'image/svg+xml' :
                               ext === 'png' ? 'image/png' :
                               ext === 'wav' ? 'audio/wav' :
                               ext === 'mp3' ? 'audio/mpeg' : 'application/octet-stream';
                    window.WebAdapter.assetStore[item.name] = 'data:' + mime + ';base64,' + b64;
                });
            });

            var jsonPromise = jsonFile.async('string').then(function (str) {
                try {
                    var parsed = JSON.parse(str);
                    var normalised = {};
                    Object.keys(parsed).forEach(function (k) {
                        normalised[k.toLowerCase()] = parsed[k];
                    });
                    return normalised;
                } catch (e) {
                    throw new Error('Project data is corrupted: ' + e.message);
                }
            });

            return Promise.all([jsonPromise].concat(assetPromises)).then(function (results) {
                return results[0];
            });
        }).catch(function (err) {
            if (err.message && (err.message.indexOf('valid .sjr') !== -1 || err.message.indexOf('corrupted') !== -1)) {
                throw err;
            }
            throw new Error('Not a valid .sjr file: could not unzip archive.');
        });
    }

    function waitForRuntimeReady() {
        return new Promise(function (resolve, reject) {
            var attempts = 0;
            var interval = setInterval(function () {
                attempts++;
                if (window.Project && window.ScratchJr && window.ScratchJr.stage && window.ScratchJr.stage.currentPage) {
                    clearInterval(interval);
                    resolve();
                } else if (attempts >= 150) {
                    clearInterval(interval);
                    reject(new Error('Timed out waiting for ScratchJr to initialise.'));
                }
            }, 100);
        });
    }

    function loadProjectIntoRuntime(projectData) {
        return new Promise(function (resolve, reject) {
            try {
                var projectJson = projectData.json || projectData;
                if (typeof projectJson === 'string') {
                    projectJson = JSON.parse(projectJson);
                }
                if (!projectJson.pages) {
                    throw new Error('Project data is missing pages.');
                }
                window.Project.loadData(projectJson, function () {
                    hideOverlay();
                    resolve();
                });
            } catch (e) {
                reject(new Error('Failed to load project: ' + e.message));
            }
        });
    }

    function loadFromBuffer(buffer) {
        return parseSjr(buffer)
            .then(function (projectData) {
                return waitForRuntimeReady().then(function () {
                    return loadProjectIntoRuntime(projectData);
                });
            });
    }

    function setupFileInput() {
        var input = document.getElementById('sjr-file-input');
        if (!input) { return; }

        input.addEventListener('change', function (evt) {
            var file = evt.target.files && evt.target.files[0];
            if (!file) { return; }

            input.value = '';
            showOverlay('Loading ' + file.name + '...');
            window.WebAdapter.assetStore = {};

            var reader = new FileReader();
            reader.onload = function (e) {
                loadFromBuffer(e.target.result).catch(function (err) {
                    showError(err.message);
                });
            };
            reader.onerror = function () {
                showError('Could not read file: ' + file.name);
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // Injects the Open button next to the home/back button (#flip) in the
    // ScratchJr toolbar. Uses MutationObserver because the runtime builds
    // the toolbar asynchronously after page load.
    function injectOpenButton() {
        var input = document.getElementById('sjr-file-input');
        if (!input) { return; }

        function tryInject() {
            var flip = document.getElementById('flip');
            if (!flip || document.getElementById('sjr-open-btn')) { return; }

            var flipRect = flip.getBoundingClientRect();
            if (flipRect.width === 0) { return; }

            var btn = document.createElement('div');
            btn.id = 'sjr-open-btn';

            var btnHeight = Math.round(flipRect.height * 0.7);
            var btnTop = Math.round(flipRect.top + (flipRect.height - btnHeight) / 2);
            var btnLeft = Math.round(flipRect.right) + 8;

            btn.style.cssText = [
                'position: fixed',
                'top: ' + btnTop + 'px',
                'left: ' + btnLeft + 'px',
                'height: ' + btnHeight + 'px',
                'padding: 0 12px',
                'background: #4B8CC2',
                'color: #fff',
                'border-radius: 6px',
                'font-family: sans-serif',
                'font-size: 13px',
                'font-weight: bold',
                'cursor: pointer',
                'display: flex',
                'align-items: center',
                'justify-content: center',
                'z-index: 9000',
                'white-space: nowrap',
                'box-shadow: 0 2px 4px rgba(0,0,0,0.25)'
            ].join(';');
            btn.textContent = 'Open .sjr';

            btn.addEventListener('mousedown', function (e) {
                e.stopPropagation();
                input.click();
            });

            document.body.appendChild(btn);
            observer.disconnect();
        }

        var observer = new MutationObserver(tryInject);
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(tryInject, 500);
        tryInject();
    }

    // On a cloud server the fetch goes through /proxy to avoid CORS issues.
    // On localhost the test host allows direct requests.
    function resolveFileUrl(fileUrl) {
        var isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        return isLocalhost ? fileUrl : '/proxy?url=' + encodeURIComponent(fileUrl);
    }

    function readFileUrlParam() {
        var params = new URLSearchParams(window.location.search);
        var fileUrl = params.get('file_url');
        if (!fileUrl) { return; }

        try {
            var parsed = new URL(fileUrl);
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
                throw new Error('only http and https are supported');
            }
        } catch (e) {
            showError('Invalid file_url: ' + e.message);
            return;
        }

        showOverlay('Downloading project...');
        window.WebAdapter.assetStore = {};

        fetch(resolveFileUrl(fileUrl), { mode: 'cors' })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }
                return response.arrayBuffer();
            })
            .then(function (buffer) {
                return loadFromBuffer(buffer);
            })
            .catch(function (err) {
                showError('Could not load project: ' + err.message);
            });
    }

    setupFileInput();
    injectOpenButton();
    readFileUrlParam();

})();
