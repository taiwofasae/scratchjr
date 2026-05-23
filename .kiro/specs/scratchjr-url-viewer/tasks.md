# Implementation Plan: ScratchJr URL Viewer

## Overview

Three sequential phases build on each other: first get the ScratchJr UI rendering in a plain browser (the web adapter shim), then add local file loading via a file input, then add remote loading via the `file_url` query parameter. All files go in `web-client/`. The pre-compiled bundle at `editions/free/src/app.bundle.js` is never modified.

## Tasks

- [-] 1. Phase 1 — Display the ScratchJr UI on page load (no project file)
  - [x] 1.1 Copy `editions/free/src/settings.json` to `web-client/settings.json`
    - The runtime's `getsettings` call needs this file at a path relative to the web-client origin.
    - _Requirements: 6.4_

  - [x] 1.2 Create `web-client/web-adapter.js` — tablet interface shim
    - Install `window.tablet` before `app.bundle.js` loads so `isiOS` resolves to `true` in `lib.js`.
    - Implement `getsettings(fcn)`: fetch `settings.json` via `XMLHttpRequest`, call `fcn` with `"<path>,0"` format string.
    - Implement `getmedia(md5, fcn)`: look up `window.WebAdapter.assetStore[md5]`; call `fcn` with the base64 data URL.
    - Implement `setmedia(str, ext, fcn)`, `setmedianame(str, name, ext, fcn)`: store in `assetStore`; call `fcn`.
    - Implement `getmd5(str, fcn)`: compute a simple hash and call `fcn`.
    - Implement `query(json, fcn)`: call `fcn("[]")` — no SQLite.
    - Implement `stmt(json, fcn)`, `getfile(name, fcn)`, `setfile(name, str, fcn)`: no-ops that call `fcn` if provided.
    - Implement `hascamera()`: return `false`. `analyticsEvent()`: no-op.
    - All other methods: no-op stubs that call any callback argument exactly once.
    - Expose `window.WebAdapter = { assetStore: {} }` for use by `url-loader.js`.
    - _Requirements: 1.3, 1.4_

  - [ ]* 1.3 Write property test for adapter callback contract (P5)
    - **Property P5: Adapter transparency**
    - For every method on `window.tablet` that accepts a callback, the callback must be called exactly once for any input.
    - Use fast-check (or equivalent) to generate arbitrary inputs and verify the call count.
    - **Validates: Requirements 1.3**

  - [x] 1.4 Create `web-client/index.html` — viewer page skeleton
    - Mirror the DOM structure of `editions/free/src/editor.html`: include `#frame`, `#libframe`, `#paintframe` divs.
    - Set `window.scratchJrPage = 'editor'` in an inline `<script>` before any other script.
    - Load `web-adapter.js` synchronously (no `defer`, no `async`) so stubs are in place before the bundle runs.
    - Load `../editions/free/src/app.bundle.js` after the adapter.
    - Load `url-loader.js` with `defer` so it runs after the DOM and bundle globals are ready.
    - Link all required CSS from `../editions/free/src/` using relative paths.
    - Add a full-viewport loading overlay `#url-loader-overlay` with inline CSS (visible before external CSS loads); include a spinner and status text.
    - Add a hidden error banner `#url-loader-error`.
    - _Requirements: 1.1, 1.2, 1.5, 6.1, 6.2, 6.3_

  - [x] 1.5 Vendor JSZip: download `jszip.min.js` (v3.10.x) into `web-client/`
    - Download from the official JSZip CDN/release and save as `web-client/jszip.min.js`.
    - Add a `<script src="jszip.min.js">` tag in `index.html` before `url-loader.js`.
    - _Requirements: 6.1_

  - [x] 1.6 Create `web-client/url-loader.js` — stub (no-op for Phase 1)
    - Create the file with an empty entry function `initUrlLoader()` that returns immediately.
    - This ensures the `defer`-loaded script exists and the page loads without errors.
    - _Requirements: 2.4_

  - [x] 1.7 Checkpoint — verify Phase 1 manually
    - Serve `web-client/` from `localhost:8000` (e.g. `python3 -m http.server 8000`).
    - Open `http://localhost:8000/web-client/index.html` in a browser.
    - Confirm the ScratchJr editor UI renders (stage, sprite area, block palette visible) with an empty project.
    - Confirm no JavaScript errors appear in the browser console.
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 2. Phase 2 — Load a project from the local filesystem (file input)
  - [ ] 2.1 Add a file-input control to `web-client/index.html`
    - Add a styled `<input type="file" accept=".sjr">` button overlaid on the viewer (e.g. top-right corner).
    - The button should be visible when no project is loaded and hidden (or minimised) once a project loads.
    - _Requirements: 1.1_

  - [ ] 2.2 Implement `parseSjr(arrayBuffer)` in `web-client/url-loader.js`
    - Use `JSZip.loadAsync(arrayBuffer)` to unzip the archive.
    - Find the `*.json` entry; parse it as the project data object.
    - For every non-JSON entry, read it as base64 and store in `window.WebAdapter.assetStore[filename]`.
    - If the buffer is not a valid ZIP, throw a descriptive `Error`.
    - If no JSON entry is found or the JSON is malformed, throw a descriptive `Error`.
    - Return the parsed project data object.
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 2.3 Write property test for round-trip consistency (P1)
    - **Property P1: URL parameter round-trip**
    - For any valid `.sjr` `ArrayBuffer`, `parse(serialize(parse(bytes)))` must deep-equal `parse(bytes)` where `parse` calls `parseSjr` and extracts the JSON, and `serialize` is `JSON.stringify` + `JSON.parse`.
    - Use fast-check to generate synthetic ZIP buffers containing varied project JSON shapes.
    - **Validates: Requirements 4.5**

  - [ ]* 2.4 Write property test for asset completeness (P2)
    - **Property P2: Asset completeness**
    - For any valid `.sjr` `ArrayBuffer`, every `md5` field referenced in the project JSON (sprites and page backgrounds) must have a corresponding key in `window.WebAdapter.assetStore` after `parseSjr` completes.
    - Use fast-check to generate synthetic ZIPs with varying asset sets and project JSON referencing those assets.
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 2.5 Write property test for error isolation (P3)
    - **Property P3: Error isolation**
    - If `parseSjr` throws (invalid ZIP, missing JSON, malformed JSON), `assetStore` must remain empty and `Project.loadData` must not have been called.
    - Use fast-check to generate invalid `ArrayBuffer` inputs (random bytes, truncated ZIPs, ZIPs with no JSON entry).
    - **Validates: Requirements 4.3, 4.4**

  - [ ] 2.6 Implement `waitForRuntimeReady()` and `loadProjectIntoRuntime(projectData)` in `url-loader.js`
    - `waitForRuntimeReady()`: poll `window.Project` every 100 ms; resolve when defined; reject after 10 seconds with a timeout error.
    - `loadProjectIntoRuntime(projectData)`: call `Project.loadData(projectData, onDone)`; on `onDone`, hide the loading overlay.
    - _Requirements: 5.1, 5.4_

  - [ ] 2.7 Wire the file-input to `parseSjr` and `loadProjectIntoRuntime` in `url-loader.js`
    - On `change` event of the file input, read the selected file as `ArrayBuffer` using `FileReader`.
    - Show the loading overlay, call `parseSjr(arrayBuffer)`, then `waitForRuntimeReady()`, then `loadProjectIntoRuntime(projectData)`.
    - On any error, call `showError(message)` to display the error banner and hide the overlay.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.4, 5.5_

  - [ ] 2.8 Checkpoint — verify Phase 2 manually
    - Open `http://localhost:8000/web-client/index.html`.
    - Use the file input to select a local `.sjr` file.
    - Confirm the project loads and renders (pages, sprites, backgrounds visible).
    - Confirm the loading overlay appears during load and disappears when done.
    - Confirm that selecting an invalid file shows a human-readable error banner.
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Phase 3 — Load a project from a URL parameter (`file_url`)
  - [ ] 3.1 Implement `readFileUrlParam()` in `url-loader.js`
    - Parse `window.location.search` with `URLSearchParams` to extract `file_url`.
    - If absent, return `null` (no-op path).
    - Validate the value with `new URL(value)`; accept `https:` and `http:` protocols.
    - If the URL is invalid, call `showError(message)` and return.
    - Log a console warning (but continue) if the URL does not end in `.sjr`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 3.2 Write property test for no-parameter idempotence (P4)
    - **Property P4: No-parameter idempotence**
    - When `readFileUrlParam()` is called with no `file_url` in the query string, `assetStore` must remain unmodified, `Project.loadData` must not be called, and the error banner must remain hidden.
    - Use fast-check to generate arbitrary query strings that do not contain `file_url`.
    - **Validates: Requirements 2.4**

  - [ ] 3.3 Implement the remote fetch path in `url-loader.js`
    - When `readFileUrlParam()` returns a valid URL, show the loading overlay.
    - Call `fetch(fileUrl, { mode: 'cors' })`.
    - On network/CORS error, call `showError` with a descriptive message.
    - On HTTP 4xx/5xx, call `showError("HTTP <status>: <statusText>")`.
    - On success, call `response.arrayBuffer()`, then `parseSjr`, then `waitForRuntimeReady`, then `loadProjectIntoRuntime`.
    - On any downstream error, call `showError` and hide the overlay.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.1, 5.4, 5.5_

  - [ ] 3.4 Wire `initUrlLoader()` to call `readFileUrlParam()` on DOM ready
    - In `url-loader.js`, update `initUrlLoader()` to call `readFileUrlParam()` when the script runs (it already loads with `defer`, so the DOM is ready).
    - _Requirements: 2.1, 3.1_

  - [ ] 3.5 Final checkpoint — verify Phase 3 end-to-end
    - Open `http://localhost:8000/web-client/index.html?file_url=https://<test-host>/project.sjr`.
    - Confirm the loading overlay appears, the project downloads, and the ScratchJr UI renders the project.
    - Confirm the green flag button is enabled.
    - Confirm the loading overlay disappears after rendering.
    - Test error cases: invalid URL, unreachable host, non-ZIP file — confirm human-readable error banners appear.
    - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements for traceability.
- Checkpoints (1.7, 2.8, 3.5) are manual browser verification steps — they cannot be automated because they depend on the live ScratchJr runtime.
- Property tests (P1–P5) validate the pure JavaScript modules (`parseSjr`, `readFileUrlParam`, `web-adapter.js`) in isolation without needing the full runtime.
- `web-adapter.js` must be loaded synchronously before `app.bundle.js`; `url-loader.js` must be loaded with `defer` after the bundle.
- Do not modify any file outside `web-client/`.
