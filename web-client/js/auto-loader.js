// auto-loader.js
(function initializeUrlLoader() {
    window.addEventListener('DOMContentLoaded', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const sjrUrl = urlParams.get('sjr');

        if (sjrUrl) {
            console.log("[Auto-Loader] URL parameter found:", sjrUrl);

            fetch(sjrUrl)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
                    return res.blob();
                })
                .then(blob => {
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = function () {
                        const base64data = reader.result.split(',')[1];

                        // Keep checking for core iOS bridge initialization
                        const checkEngine = setInterval(() => {
                            if (window.iOS && typeof window.iOS.loadProjectFromSjr === 'function') {
                                clearInterval(checkEngine);
                                window.iOS.loadProjectFromSjr(base64data);
                                console.log("[Auto-Loader] Remote .sjr file loaded perfectly!");
                            }
                        }, 500);
                    };
                })
                .catch(err => console.error("[Auto-Loader] Failed to fetch or inject project:", err));
        }
    });
})();