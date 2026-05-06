# ScratchJr Web Client - URL Project Loader

> **Status: In Development / Partial Implementation** 
> - URL parameter detection working
> - ⚠️ Editor environment not rendering correctly
> - ⚠️ Blank page with upload button on first load
> - ❌ Project injection not yet functional

## 🎯 Current Project State

This is a **work in progress** to create a self-hosted ScratchJr web editor with URL-based project loading capability. The official ScratchJr web player doesn't support loading `.sjr` files via URL parameters - we're building that functionality.

### Currently Working
- URL parameter detection (`?sjr=` and `?file_url=`)
- Fetching `.sjr` files from remote URLs
- GitHub URL conversion (blob → raw)
- Base64 encoding of project data
- Asset directory structure (CSS, images, sounds)
- SQLite database initialization

### ❌ Broken / Not Working
- **Editor environment not rendering** - Blank page instead of ScratchJr interface
- **Project injection failure** - `.sjr` loads but doesn't display in editor
- **Missing UI elements** - Only upload button appears, no stage or blocks palette
- **Bundle initialization** - `window.ScratchJr` exists but has no methods

## 📋 Table of Contents
- [Current Issues](#current-issues)
- [Project Structure](#project-structure)
- [Testing Results](#testing-results)
- [Technical Analysis](#technical-analysis)
- [What We've Tried](#what-weve-tried)
- [Next Steps](#next-steps)
- [How to Reproduce](#how-to-reproduce)

## 🐛 Current Issues

### Issue #1: Blank Editor Interface
**Symptoms:**
- White/blank page on load 
- Only "Upload SJR" button appears (from custom upload modal)
- No stage, no block palette, no character area

**Console Output:**
Frame children: 0
window.ScratchJr: function
window.ScratchJr keys: []
window.ScratchJr prototype: []


**Status:** 🔴 Under investigation

### Issue #2: URL Loading Doesn't Inject Projects
**Symptoms:**
- URL parameter detected correctly
- `.sjr` file fetches successfully
- Base64 conversion works
- But project never appears in editor

**Console Output:**
[Auto-Loader] URL parameter found: https://...
[Web Bridge] Waiting for app instance... (Current state: function)
[Auto-Loader] No load method found on instance. Available methods: []


**Status:** 🔴 Root cause: Editor never initializes

### Issue #3: Bundle Doesn't Auto-Initialize
**Symptoms:**
- `app.bundle.js` loads but doesn't execute
- Manual instantiation creates empty object
- No UI elements are created

**Status:** 🔴 Likely missing initialization call

## 📁 Project Structure
scratchjr-web-client/
├── index.html # Main entry (blank page issue)
├── editor-test.html # Test version with debug code
├── index77.js # Built bundle (912KB)
├── index77.js.map # Source map
├── css/ # All present
├── assets/ # All present
├── svglibrary/ # Character/background SVGs
├── sounds/ # Sound effects
├── localizations/ # Language files (25 locales)
├── js/
│ ├── sql-wasm.js # SQLite engine
│ ├── sql-wasm.wasm # WebAssembly module
│ ├── web-bridge.js # Tablet interface mock
│ └── app.bundle.js # ⚠️ Broken symlink
└── vendors/
└── snap/ # Snap.svg library




## 🧪 Testing Results

### Test 1: Basic HTML Load
| Test | Result | Notes |
|------|--------|-------|
| CSS loading | PASS | All CSS files 200 OK |
| Asset loading | PASS | Images and SVGs load |
| Bundle loading | PASS | index77.js loads (912KB) |
| Editor rendering | ❌ FAIL | Frame has 0 children |

### Test 2: URL Parameter Detection
| Test | Result | Notes |
|------|--------|-------|
| Parameter parsing | PASS | `?sjr=` detected |
| GitHub URL conversion | PASS | blob → raw conversion works |
| File fetch | PASS | SJR file downloads |
| Base64 conversion | PASS | Data encoded correctly |

### Test 3: Project Injection
| Test | Result | Notes |
|------|--------|-------|
| Method detection | ❌ FAIL | No `loadProjectFromSjr` found |
| Alternative injection | ❌ FAIL | `window.OS` also empty |
| Manual injection | ❌ FAIL | Instance has no methods |

### Test 4: Bundle Initialization
| Test | Result | Notes |
|------|--------|-------|
| Auto-init on load | ❌ FAIL | Bundle doesn't execute |
| Manual instantiation | ❌ FAIL | New instance empty |
| `appinit` method | ❌ FAIL | Method doesn't exist |

## 🔍 Technical Analysis

### What We Know

1. **Bundle is valid** - Build succeeds, file size 912KB
2. **Assets are complete** - All CSS, images, sounds present
3. **DOM structure correct** - Required divs exist (`#frame`, `#libframe`, `#paintframe`)
4. **Page mode set** - `window.scratchJrPage = 'editor'` before bundle loads
5. **Settings configured** - `window.Settings` object exists

### What's Missing

The bundle exports a class but doesn't automatically instantiate it. Unlike the official Code.org version, our built bundle requires explicit initialization that we haven't found yet.

### Comparison with Working Version

| Aspect | Code.org (Working) | Our Build (Broken) |
|--------|-------------------|-------------------|
| Bundle name | `index77.js` | `index77.js` |
| Bundle size | Unknown | 912KB |
| Auto-initializes | YES | ❌ NO |
| Creates UI | YES | ❌ NO |
| Has methods | YES | ❌ NO |

## 🛠️ What We've Tried

### Failed Attempts

1. **Manual instantiation**

const app = new window.ScratchJr();
// Result: Empty object with no methods

2. **Calling appinit**
window.ScratchJr.appinit(window.Settings);
// Result: appinit doesn't exist

3. **window.onload initialization**
window.onload = () => { new window.ScratchJr(); }
// Result: Still empty

4. **Different page modes**
window.scratchJrPage = 'home'; // Also blank
window.scratchJrPage = 'index'; // Also blank

Using different bundle (app.bundle.js vs index77.js)
Both result in same issue - empty instance

Successful Tests
- All assets load (no 404 errors)
- SQLite initializes
- Web bridge creates mock tablet interface
- URL parameter detection works
- File fetching works


## How to Reproduce
1. Clone and Setup
bash
git clone [your-repo-url]
cd scratchjr-web-client
python3 -m http.server 8000
2. Open in Browser
http://localhost:8000/
Expected: ScratchJr editor interface
Actual: Blank page with upload button

3. Test URL Loading
http://localhost:8000/?sjr=https://raw.githubusercontent.com/.../project.sjr
Expected: Project loads in editor
Actual: URL detected but nothing loads

4. Check Console
javascript
// Run this to see current state
console.log({
  scratchJr: typeof window.ScratchJr,
  methods: window.ScratchJr ? Object.keys(window.ScratchJr) : [],
  frameChildren: document.getElementById('frame')?.children.length,
  settings: window.ScratchJrPage
});
Output:

javascript
{
  scratchJr: "function",
  methods: [],
  frameChildren: 0,
  settings: "editor"
}

### Next Steps
Immediate Priorities
- Find correct initialization method
- Search Code.org's working version for init pattern
- Compare bundle differences
- Check for hidden initialization in webpack bundle
- Debug bundle exports

javascript
// Run in console to inspect bundle
console.log(window.ScratchJr.toString());
// Look for any init-related code

- Compare with working version
- Download Code.org's index77.js
- Compare exports and initialization
- Identify missing startup code


### Alternative Approaches
- Use Code.org bundle directly
- Download their working index77.js
- Add URL loader wrapper around it
- Test if editor renders
- Extract initialization pattern
- Study their HTML structure
- Copy their exact script order
- Replicate their initialization sequence
- Build differently
- Modify webpack config for auto-execution
- Add self-initializing wrapper
- Test different library targets

### Debug Checklist
- Verify bundle exports the right interface
- Find what triggers UI creation in working version
- Compare bundle contents with working version
- Check for missing initialization scripts
- Test with different webpack configurations
- Try building without code splitting
- Examine network tab for missing dependencies

### Questions for Investigation
Does the official index77.js auto-execute or require a call?

What triggers the UI rendering - DOMContentLoaded or something else?

Is there a missing init() method we haven't found?

Does the bundle expect a different global variable name?

Are there CSS classes or IDs we're missing that trigger rendering?

### Helpful Commands
bash
# Check what's in the bundle
grep -o "window\.ScratchJr[^;]*" index77.js | head -20

# Look for init patterns
grep -i "init\|start\|run\|load" index77.js | head -30

# Compare with working version
diff our-index77.js working-index77.js | head -50

### Expected Future Contributions
- Understanding the correct initialization sequence
- Identifying why the bundle doesn't auto-execute
- Finding the method to trigger UI rendering

Last Updated: May 6, 2026
Current Status: 🔴 Blocked - Editor not rendering
Next Milestone: Get basic editor interface visible
Known Working: URL detection and file fetching

This is a development snapshot documenting ongoing work. Core functionality is not yet complete