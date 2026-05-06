// ============================================ 
// ScratchJr Web Editor with URL Project Loader 
// ============================================ 

// Import the main ScratchJr module
// Based on src/entry/app.js which is the original entry point
import ScratchJr from '../editor/ScratchJr';
import OS from '../tablet/OS';

// Store original initialization 
let originalAppinit = ScratchJr.appinit; 
let pendingProject = null; 

// Override appinit to inject project after initialization 
ScratchJr.appinit = function(settings) { 
    console.log('[ScratchJr] Initializing with URL loader...'); 
    
    // Check URL for project parameter 
    const urlParams = new URLSearchParams(window.location.search); 
    const projectUrl = urlParams.get('sjr') || urlParams.get('file_url'); 
    
    if (projectUrl) { 
        console.log('[ScratchJr] Found project URL:', projectUrl); 
        pendingProject = projectUrl; 
    } 
    
    // Call original initialization 
    if (originalAppinit) { 
        originalAppinit.call(this, settings); 
    } 
    
    // Load pending project after initialization 
    if (pendingProject) { 
        setTimeout(() => { 
            loadProjectFromUrl(pendingProject); 
        }, 1500); // Give it a bit more time to settle
    } 
}; 

// Function to load project from URL 
async function loadProjectFromUrl(url) { 
    console.log('[ScratchJr] Loading project from:', url); 
    
    let finalUrl = url; 
    if (url.includes('github.com') && url.includes('/blob/')) { 
        finalUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/'); 
    } 
    
    try { 
        const response = await fetch(finalUrl); 
        const blob = await response.blob(); 
        const base64 = await new Promise((resolve) => { 
            const reader = new FileReader(); 
            reader.onloadend = () => resolve(reader.result.split(',')[1]); 
            reader.readAsDataURL(blob); 
        }); 
        
        // Find the instance and load 
        let attempts = 0; 
        const tryInject = setInterval(() => { 
            attempts++; 
            // In the source, OS.loadProjectFromSjr is the primary entry point
            if (OS && typeof OS.loadProjectFromSjr === 'function') { 
                OS.loadProjectFromSjr(base64); 
                clearInterval(tryInject); 
                console.log('[ScratchJr] ✓ Project loaded successfully!'); 
            } else if (attempts > 40) { 
                clearInterval(tryInject); 
                console.error('[ScratchJr] Failed to load project - OS.loadProjectFromSjr not found'); 
            } 
        }, 500); 
    } catch(err) { 
        console.error('[ScratchJr] Failed to fetch project:', err); 
    } 
} 

// Export the modified ScratchJr 
export default ScratchJr;