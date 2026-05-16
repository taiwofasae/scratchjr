// url-loader.js
// Phase 2: load a .sjr file from the local filesystem via a file input.
// Phase 3: load a .sjr file from a URL parameter (file_url).

(function () {

    // --- UI helpers ---

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
            // Auto-hide after 8 seconds
            setTimeout(function () {
                banner.style.display = 'none';
            }, 8000);
        }
        console.error('url-loader:', message);
    }

    // --- SJR parsing ---

    // Unzips an ArrayBuffer containing a .sjr file.
    // Populates window.WebAdapter.assetStore with all non-JSON assets.
    // Returns a Promise that resolves with the parsed project data object.
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

            // Load all assets into the store and parse the project JSON in parallel.
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
                    // Normalise keys to lowercase (same as IO.parseProjectData)
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
                return results[0]; // the parsed project JSON
            });
        }).catch(function (err) {
            if (err.message && err.message.indexOf('valid .sjr') !== -1) { throw err; }
            if (err.message && err.message.indexOf('corrupted') !== -1) { throw err; }
            throw new Error('Not a valid .sjr file: could not unzip archive.');
        });
    }

    // --- Runtime integration ---

    // Polls until window.Project and window.ScratchJr.stage are available.
    // Resolves when ready, rejects after 15 seconds.
    function waitForRuntimeReady() {
        return new Promise(function (resolve, reject) {
            var attempts = 0;
            var max = 150; // 150 * 100ms = 15 seconds
            var interval = setInterval(function () {
                attempts++;
                var ready = window.Project &&
                            window.ScratchJr &&
                            window.ScratchJr.stage &&
                            window.ScratchJr.stage.currentPage;
                if (ready) {
                    clearInterval(interval);
                    resolve();
                } else if (attempts >= max) {
                    clearInterval(interval);
                    reject(new Error('Timed out waiting for ScratchJr runtime to initialise.'));
                }
            }, 100);
        });
    }

    // Loads parsed project data into the running ScratchJr runtime.
    // The .sjr data.json is a metadata wrapper — the actual project is in the
    // 'json' field, which is what Project.loadData expects.
    function loadProjectIntoRuntime(projectData) {
        return new Promise(function (resolve, reject) {
            try {
                // Unwrap: data.json contains the real project (pages, sprites etc.)
                // It may be a string (needs parsing) or already an object.
                var projectJson = projectData.json;
                if (!projectJson) {
                    // No wrapper — assume projectData itself is the project.
                    projectJson = projectData;
                }
                if (typeof projectJson === 'string') {
                    projectJson = JSON.parse(projectJson);
                }

                if (!projectJson.pages) {
                    throw new Error('Project data is missing pages — unexpected format.');
                }

                window.Project.clear();
                window.Project.loadData(projectJson, function () {
                    hideOverlay();
                    resolve();
                });
            } catch (e) {
                reject(new Error('Failed to load project into runtime: ' + e.message));
            }
        });
    }

    // --- File input (Phase 2) ---

    function setupFileInput() {
        var input = document.getElementById('sjr-file-input');
        if (!input) { return; }

        input.addEventListener('change', function (evt) {
            var file = evt.target.files && evt.target.files[0];
            if (!file) { return; }

            // Reset so the same file can be re-selected after an error.
            input.value = '';

            showOverlay('Loading ' + file.name + '...');

            // Clear previous assets before loading a new project.
            window.WebAdapter.assetStore = {};

            var reader = new FileReader();
            reader.onload = function (e) {
                parseSjr(e.target.result)
                    .then(function (projectData) {
                        return waitForRuntimeReady().then(function () {
                            return loadProjectIntoRuntime(projectData);
                        });
                    })
                    .catch(function (err) {
                        showError(err.message);
                    });
            };
            reader.onerror = function () {
                showError('Could not read file: ' + file.name);
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // --- URL parameter loading (Phase 3) ---

    function readFileUrlParam() {
        var params = new URLSearchParams(window.location.search);
        var fileUrl = params.get('file_url');
        if (!fileUrl) { return; }

        var parsed;
        try {
            parsed = new URL(fileUrl);
        } catch (e) {
            showError('Invalid file_url parameter: "' + fileUrl + '" is not a valid URL.');
            return;
        }

        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            showError('Invalid file_url: only http and https URLs are supported.');
            return;
        }

        if (!fileUrl.toLowerCase().endsWith('.sjr')) {
            console.warn('url-loader: file_url does not end in .sjr — attempting to load anyway.');
        }

        showOverlay('Downloading project...');
        window.WebAdapter.assetStore = {};

        fetch(fileUrl, { mode: 'cors' })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }
                return response.arrayBuffer();
            })
            .then(function (buffer) {
                return parseSjr(buffer);
            })
            .then(function (projectData) {
                return waitForRuntimeReady().then(function () {
                    return loadProjectIntoRuntime(projectData);
                });
            })
            .catch(function (err) {
                showError('Could not load project: ' + err.message);
            });
    }

    // --- Entry point ---

    // Setup the file input listener immediately (DOM is ready since we use defer).
    setupFileInput();

    // Check for file_url query parameter and load if present.
    readFileUrlParam();

})();
