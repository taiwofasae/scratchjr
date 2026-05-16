# Design Document

## Overview

The ScratchJr URL Viewer is a self-contained web page served from `web-client/index.html`. It bootstraps the existing ScratchJr editor runtime (compiled into `editions/free/src/app.bundle.js`) inside a plain browser context, replacing the native iOS/Android tablet layer with a thin web shim. On page load it reads a `file_url` query parameter, fetches the `.sjr` file over CORS, unzips it in the browser using JSZip, and feeds the extracted project JSON into the runtime's existing `Project.loadData` path.

No changes are made to the compiled bundle or to any file outside `web-client/`.

---

## Architecture

```
Browser (localhost:8000)
│
└── web-client/index.html
    ├── <link> ../editions/free/src/css/base.css  (and other editor CSS)
    ├── <script> jszip.min.js                      (third-party, bundled locally)
    ├── <script> web-adapter.js                    (new — replaces tablet layer)
    ├── <script> url-loader.js                     (new — fetch + parse + inject)
    └── <script> ../editions/free/src/app.bundle.js
```

### Component responsibilities

| Component | File | Role |
|---|---|---|
| Viewer page | `web-client/index.html` | DOM skeleton, asset wiring, boot sequence |
| Web adapter | `web-client/web-adapter.js` | Stubs out the native OS/tablet interface so the bundle initialises without a WebView |
| URL loader | `web-client/url-loader.js` | Reads `file_url`, fetches the `.sjr`, unzips it, calls `Project.loadData` |
| JSZip | `web-client/jszip.min.js` | In-browser ZIP decompression |
| Settings | `web-client/settings.json` | Copy of `editions/free/src/settings.json` consumed by the runtime |

---

## Detailed Design

### 1. `web-client/index.html`

The page mirrors the structure of `editions/free/src/editor.html` — the runtime expects `#frame`, `#libframe`, and `#paintframe` divs to exist before the bundle runs.

Boot order:

1. Set `window.scratchJrPage = 'editor'` before the bundle loads (the bundle reads this to decide which entry point to run).
2. Load `web-adapter.js` synchronously before `app.bundle.js` so the stubs are in place when the bundle executes.
3. Load `app.bundle.js`.
4. Load `url-loader.js` with `defer` so it runs after the DOM is ready and after the bundle has registered its globals.

A loading overlay (`#url-loader-overlay`) is added to the DOM. It is shown while the `.sjr` is being fetched and hidden once the project is rendered or an error occurs. It sits above the ScratchJr UI using `z-index`.

An error banner (`#url-loader-error`) is hidden by default and made visible on failure.

### 2. `web-client/web-adapter.js`

The ScratchJr bundle calls into a native tablet interface through `OS`, which delegates to either `iOS` or `Android` objects injected by the WebView. In a plain browser neither exists, so the bundle would crash during `OS.waitForInterface`.

The adapter runs before the bundle and installs stubs on `window`:

```
window.tablet = <stub object>   // makes isiOS = true in lib.js
```

The stub object implements every method the editor entry point calls during initialisation. Methods that the web viewer does not need (camera, audio recording, native sharing, SQLite) are no-ops or return safe defaults. Methods that the runtime genuinely needs are implemented:

| Method | Web implementation |
|---|---|
| `getsettings(fcn)` | Fetches `settings.json` via `XMLHttpRequest` and calls `fcn` with a comma-separated string matching the format the editor entry point expects: `"<path>,0"` |
| `getmedia(md5, fcn)` | Looks up the md5 in an in-memory asset store populated by the URL loader; calls `fcn` with a base64 data URL |
| `setmedia(str, ext, fcn)` | Stores the asset in the in-memory store; calls `fcn` |
| `setmedianame(str, name, ext, fcn)` | Stores the asset; calls `fcn` |
| `getmd5(str, fcn)` | Computes a simple hash of the string and calls `fcn` |
| `query(json, fcn)` | Returns an empty result set `"[]"` — no SQLite in the browser |
| `stmt(json, fcn)` | No-op; calls `fcn` if provided |
| `getfile(name, fcn)` | Returns `btoa("0")` for scroll-state files; no-op otherwise |
| `setfile(name, str, fcn)` | No-op; calls `fcn` if provided |
| `hascamera()` | Returns `false` |
| `analyticsEvent()` | No-op |
| All other methods | No-op stubs |

The adapter also exposes a global `window.WebAdapter` object with an `assetStore` map (`md5 → base64DataUrl`) that `url-loader.js` populates before triggering project load.

### 3. `web-client/url-loader.js`

Runs after the DOM and bundle are ready. Execution flow:

```
readFileUrlParam()
  │
  ├── no file_url → return (leave empty project)
  │
  └── valid URL detected
        │
        showLoadingOverlay()
        │
        fetch(fileUrl, { mode: 'cors' })
          │
          ├── network/CORS error → showError(message)
          ├── HTTP 4xx/5xx → showError("HTTP <status>: <statusText>")
          │
          └── response.arrayBuffer()
                │
                parseSjr(arrayBuffer)
                  │
                  JSZip.loadAsync(arrayBuffer)
                    │
                    ├── not a ZIP → showError("Not a valid .sjr file")
                    │
                    └── extract files
                          │
                          find "*.json" entry → parse as project JSON
                          │
                          ├── malformed JSON → showError("Project data corrupted")
                          │
                          for each non-JSON entry:
                            populate window.WebAdapter.assetStore[filename] = base64DataUrl
                          │
                          waitForRuntimeReady()
                            │
                            Project.loadData(projectJson, onDone)
                              │
                              hideLoadingOverlay()
```

**URL validation:** A URL is accepted if `new URL(value)` does not throw and the protocol is `https:` or `http:`. The `.sjr` extension check is advisory (a warning is logged but loading proceeds) to handle URLs without extensions.

**`waitForRuntimeReady`:** The bundle initialises asynchronously. `url-loader.js` polls for `window.Project` to be defined (set by the bundle) before calling `Project.loadData`. It polls every 100 ms with a 10-second timeout.

**Asset injection:** The `.sjr` ZIP contains SVG and PNG assets alongside the project JSON. Each asset is extracted as a base64 string and stored in `window.WebAdapter.assetStore` keyed by filename (the md5 the runtime uses to request it). When the runtime later calls `tablet.getmedia(md5, fcn)`, the adapter looks up the store and returns the data URL.

**Project JSON format:** The `.sjr` project JSON is the same object that `Project.loadData` already accepts. The loader passes it directly without transformation.

### 4. `web-client/settings.json`

A copy of `editions/free/src/settings.json`. The web adapter's `getsettings` stub fetches this file and returns its content in the format the editor entry point expects.

### 5. Loading overlay

A full-viewport `div` with a centred spinner and status text. Implemented with inline CSS in `index.html` so it is visible before any external stylesheet loads. Hidden by setting `display: none` once loading completes or fails.

---

## Data Flow: URL Parameter to Rendered Project

```
URL: http://localhost:8000/web-client/index.html?file_url=https://...Classroom.sjr
  │
  url-loader.js reads window.location.search
  │
  fetch("https://...Classroom.sjr", { mode: 'cors' })
  │
  ArrayBuffer → JSZip.loadAsync()
  │
  ┌─────────────────────────────────────────┐
  │  ZIP contents                           │
  │  ├── project.json  → projectData object │
  │  ├── abc123.svg    → assetStore entry   │
  │  ├── def456.png    → assetStore entry   │
  │  └── ...                                │
  └─────────────────────────────────────────┘
  │
  Project.loadData(projectData)
  │
  runtime calls tablet.getmedia("abc123.svg", fcn)
  │
  web-adapter looks up assetStore["abc123.svg"] → base64 data URL
  │
  fcn(base64DataUrl) → sprite renders on stage
```

---

## Correctness Properties

These properties define what it means for the implementation to be correct. They are expressed as testable invariants.

### P1 — URL parameter round-trip

For any valid `.sjr` file fetched from a URL, the project JSON extracted from the ZIP and passed to `Project.loadData` must be structurally equivalent to the JSON that would be produced by re-serialising the same project from the runtime.

Formally: `parse(serialize(parse(sjrBytes))) ≡ parse(sjrBytes)` where `parse` extracts the project JSON object from the ZIP and `serialize` is `JSON.stringify` followed by `JSON.parse`.

### P2 — Asset completeness

For any valid `.sjr` file, every asset filename referenced in the project JSON (sprite `md5` fields, page background `md5` fields) must have a corresponding entry in `window.WebAdapter.assetStore` after `parseSjr` completes.

### P3 — Error isolation

If `fetch` fails, or the response is not a valid ZIP, or the ZIP does not contain a JSON file, the ScratchJr runtime must remain in its initialised empty-project state — no partial state must be written to `assetStore` and `Project.loadData` must not be called.

### P4 — No-parameter idempotence

When the page loads without a `file_url` parameter, the runtime initialises to an empty project. Calling `url-loader.js`'s entry function in this state must be a no-op: it must not modify `assetStore`, must not call `Project.loadData`, and must not show the error banner.

### P5 — Adapter transparency

Every method on the `window.tablet` stub that accepts a callback must call that callback exactly once (not zero times, not more than once) for any input, so the runtime's callback-based initialisation chain always completes.

---

## File Layout

```
web-client/
├── index.html          (viewer page)
├── web-adapter.js      (tablet interface shim)
├── url-loader.js       (fetch, unzip, inject)
├── jszip.min.js        (JSZip library, vendored)
└── settings.json       (copy of editions/free/src/settings.json)
```

All paths in `index.html` that reference the bundle and CSS use relative paths (`../editions/free/src/...`).

---

## Dependencies

| Dependency | Version | Source | Reason |
|---|---|---|---|
| JSZip | 3.10.x | CDN download, vendored as `jszip.min.js` | In-browser ZIP decompression of `.sjr` files |

No build step, no package manager, no bundler. All files are plain JavaScript served statically.

---

## Constraints and Assumptions

- The viewer is served from `http://localhost:8000`. The test `.sjr` host (`public.fasae.dev`) only allows CORS from this origin.
- `app.bundle.js` is the pre-compiled bundle from `editions/free/src/`. It is not recompiled as part of this feature.
- The runtime's `Project.loadData` interface is treated as stable. If the bundle is rebuilt with a breaking change to that interface, `url-loader.js` will need to be updated.
- The web adapter stubs out SQLite entirely. The viewer is read-only — it does not save projects back to any database.
- Audio playback depends on the browser's Web Audio API. The adapter's `ScratchAudio`-related stubs are no-ops; sounds in the project will not play unless the bundle's own Web Audio path works without the native layer.
