// auto-loader.js 
(function initializeUrlLoader() { 
    // Wait for both DOM and the ScratchJr bundle to be ready 
    function waitForScratchJrInstance(callback, retries = 0) { 
        // Try to find the instantiated app 
        if (window.ScratchJrInstance && (typeof window.ScratchJrInstance.loadProjectFromSjr === 'function' || typeof window.ScratchJrInstance.loadProject === 'function')) { 
            console.log("[Auto-Loader] ScratchJr instance found!"); 
            callback(window.ScratchJrInstance); 
            return; 
        } 
        
        // If the constructor exists but no instance, try to instantiate it 
        if (typeof window.ScratchJr === 'function' && !window.ScratchJrInstance) { 
            console.log("[Auto-Loader] Instantiating ScratchJr app..."); 
            try { 
                // Create an instance and store it globally 
                window.ScratchJrInstance = new window.ScratchJr(); 
                // Also try to attach to window.OS as the bridge expects 
                if (typeof window.OS === 'undefined' || window.OS === window.ScratchJr) { 
                    window.OS = window.ScratchJrInstance; 
                } 
                // Also ensure iOS is set 
                if (typeof window.iOS === 'undefined' || window.iOS === window.ScratchJr) { 
                    window.iOS = window.ScratchJrInstance; 
                } 
                console.log("[Auto-Loader] ScratchJr instantiated successfully!"); 
                callback(window.ScratchJrInstance); 
                return; 
            } catch(e) { 
                console.error("[Auto-Loader] Failed to instantiate:", e); 
            } 
        } 
        
        if (retries < 40) { // Retry for up to 20 seconds (40 * 500ms) 
            setTimeout(() => waitForScratchJrInstance(callback, retries + 1), 500); 
            if (retries % 10 === 0) { 
                console.log(`[Auto-Loader] Waiting for ScratchJr... (${retries/2}s)`); 
            } 
        } else { 
            console.error("[Auto-Loader] Timeout waiting for ScratchJr instance"); 
        } 
    } 
 
    window.addEventListener('DOMContentLoaded', () => { 
        const urlParams = new URLSearchParams(window.location.search); 
        const sjrUrl = urlParams.get('sjr'); 
 
        if (sjrUrl) { 
            console.log("[Auto-Loader] URL parameter found:", sjrUrl); 
 
            // GitHub URL Correction 
            let finalUrl = sjrUrl; 
            if (sjrUrl.includes('github.com') && sjrUrl.includes('/blob/')) { 
                finalUrl = sjrUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/'); 
                console.log("[Auto-Loader] Corrected GitHub URL to raw version:", finalUrl); 
            } 
 
            fetch(finalUrl) 
                .then(res => { 
                    if (!res.ok) { 
                        throw new Error(`HTTP ${res.status}: ${res.statusText}`); 
                    } 
                    return res.blob(); 
                }) 
                .then(blob => { 
                    const reader = new FileReader(); 
                    reader.readAsDataURL(blob); 
                    reader.onloadend = function () { 
                        const base64data = reader.result.split(',')[1]; 
                        
                        // Wait for ScratchJr instance then load the project 
                        waitForScratchJrInstance((instance) => { 
                            if (typeof instance.loadProjectFromSjr === 'function') { 
                                instance.loadProjectFromSjr(base64data); 
                                console.log("[Auto-Loader] Project loaded successfully!"); 
                            } else if (typeof instance.loadProject === 'function') { 
                                instance.loadProject(base64data); 
                                console.log("[Auto-Loader] Project loaded via loadProject!"); 
                            } else { 
                                console.error("[Auto-Loader] No load method found on instance. Available methods:", Object.keys(instance)); 
                            } 
                        }); 
                    }; 
                }) 
                .catch(err => { 
                    console.error("[Auto-Loader] Failed:", err.message); 
                }); 
        } 
    }); 
 })(); 
