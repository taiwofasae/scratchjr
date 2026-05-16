# Requirements Document

## Introduction

The ScratchJr URL Viewer feature enables the ScratchJr web environment to load and display a `.sjr` project file by reading a URL parameter (`file_url`) on page load. Currently, the only way to open a project in the web client is to load it from the device's local filesystem via the native tablet interface. This feature adds a self-contained web page (`web-client/index.html`) that:

1. Renders the full ScratchJr editor/viewer UI without requiring a pre-existing project on disk.
2. Accepts a `file_url` query parameter pointing to a remotely hosted `.sjr` file.
3. Downloads the `.sjr` file from the given URL and loads it into the ScratchJr runtime.

All implementation work is scoped to the `web-client/` folder. The feature is intended for use in a browser served from `localhost:8000` (CORS is only permitted from that origin for the test file host).

## Glossary

- **SJR_File**: A `.sjr` file — a ZIP archive containing a ScratchJr project's JSON data and associated media assets.
- **Viewer**: The web page at `web-client/index.html` that hosts the ScratchJr environment and implements the URL-based loading feature.
- **URL_Loader**: The JavaScript module responsible for reading the `file_url` query parameter, fetching the remote `.sjr` file, and handing the binary data to the SJR_Parser.
- **SJR_Parser**: The JavaScript module responsible for unzipping a SJR_File and reconstructing the project data structure that the ScratchJr runtime can consume.
- **ScratchJr_Runtime**: The existing ScratchJr JavaScript engine (sourced from `src/`) that renders and runs ScratchJr projects.
- **Web_Client**: The `web-client/` directory where all new files for this feature are placed.
- **file_url**: The query parameter name used to pass the remote URL of a SJR_File to the Viewer, e.g. `?file_url=https://example.com/project.sjr`.

---

## Requirements

### Requirement 1: Viewer Page Initialization

**User Story:** As a developer or educator, I want the ScratchJr environment to load and display in a browser without requiring a pre-existing project file, so that I can embed or share the viewer as a standalone web page.

#### Acceptance Criteria

1. THE Viewer SHALL render the ScratchJr editor UI (stage, sprite area, block palette) when opened in a browser at `http://localhost:8000/web-client/index.html`.
2. WHEN the Viewer page loads without a `file_url` query parameter, THE Viewer SHALL display an empty project with a default blank stage and no sprites.
3. WHEN the Viewer page loads, THE ScratchJr_Runtime SHALL initialize all required subsystems (audio, block specs, paint editor, runtime engine) before rendering the UI.
4. IF the ScratchJr_Runtime fails to initialize a required subsystem, THEN THE Viewer SHALL display a human-readable error message in the browser and log the error to the browser console.
5. THE Viewer SHALL load all required CSS and JavaScript assets using paths relative to the `web-client/` directory.

---

### Requirement 2: URL Parameter Detection

**User Story:** As a developer or educator, I want the Viewer to detect a `file_url` query parameter on page load, so that I can link directly to a specific ScratchJr project.

#### Acceptance Criteria

1. WHEN the Viewer page loads with a `file_url` query parameter present, THE URL_Loader SHALL extract the value of `file_url` from the browser's query string.
2. THE URL_Loader SHALL accept `file_url` values that are absolute HTTPS URLs ending in `.sjr`.
3. IF the `file_url` value is not a valid absolute URL, THEN THE URL_Loader SHALL display a human-readable error message to the user and halt the loading process.
4. IF the `file_url` query parameter is absent, THE URL_Loader SHALL skip the remote loading process and leave the Viewer in its default empty-project state.

---

### Requirement 3: Remote SJR File Download

**User Story:** As a developer or educator, I want the Viewer to download the `.sjr` file from the provided URL, so that the project data is available for parsing and display.

#### Acceptance Criteria

1. WHEN a valid `file_url` is detected, THE URL_Loader SHALL fetch the file at that URL using the browser's `fetch` API with `mode: 'cors'`.
2. WHEN the fetch request succeeds, THE URL_Loader SHALL pass the response body as an `ArrayBuffer` to the SJR_Parser.
3. IF the fetch request returns an HTTP error status (4xx or 5xx), THEN THE URL_Loader SHALL display a human-readable error message that includes the HTTP status code and halt the loading process.
4. IF the fetch request fails due to a network error or CORS rejection, THEN THE URL_Loader SHALL display a human-readable error message describing the failure and halt the loading process.
5. WHILE the fetch request is in progress, THE Viewer SHALL display a loading indicator to the user.

---

### Requirement 4: SJR File Parsing

**User Story:** As a developer or educator, I want the downloaded `.sjr` file to be parsed into a ScratchJr project data structure, so that the ScratchJr runtime can render it.

#### Acceptance Criteria

1. WHEN the SJR_Parser receives an `ArrayBuffer` containing a valid SJR_File, THE SJR_Parser SHALL unzip the archive and extract the project JSON and all associated media assets.
2. WHEN the SJR_Parser successfully extracts the project JSON, THE SJR_Parser SHALL parse the JSON string into a project data object compatible with the ScratchJr_Runtime's `Project.loadData` interface.
3. IF the `ArrayBuffer` is not a valid ZIP archive, THEN THE SJR_Parser SHALL throw a descriptive error that the URL_Loader can catch and display to the user.
4. IF the extracted project JSON is malformed or missing required fields, THEN THE SJR_Parser SHALL throw a descriptive error that the URL_Loader can catch and display to the user.
5. FOR ALL valid SJR_File inputs, parsing the archive and re-serializing the extracted project JSON SHALL produce an equivalent JSON object when parsed again (round-trip property).

---

### Requirement 5: Project Rendering

**User Story:** As a developer or educator, I want the parsed ScratchJr project to be displayed in the Viewer, so that I can view and interact with the project in the browser.

#### Acceptance Criteria

1. WHEN the SJR_Parser successfully produces a project data object, THE ScratchJr_Runtime SHALL load and render the project using the existing `Project.loadData` mechanism.
2. WHEN the project is rendered, THE Viewer SHALL display all pages, sprites, and backgrounds defined in the project data.
3. WHEN the project is rendered, THE Viewer SHALL enable the green flag button so the user can run the project's scripts.
4. WHEN the project finishes loading, THE Viewer SHALL hide the loading indicator.
5. IF the ScratchJr_Runtime encounters an error while loading the project data, THEN THE Viewer SHALL display a human-readable error message and log the full error to the browser console.

---

### Requirement 6: Web-Client Asset Serving

**User Story:** As a developer, I want all Viewer assets to be self-contained in the `web-client/` directory and servable by a simple static file server, so that the feature can be tested and deployed without a build pipeline.

#### Acceptance Criteria

1. THE Web_Client SHALL include an `index.html` file that references all required JavaScript and CSS assets using relative paths.
2. THE Web_Client SHALL include or reference the compiled ScratchJr application bundle (`app.bundle.js`) and its associated assets.
3. WHEN the Viewer is served from `http://localhost:8000/web-client/`, THE Viewer SHALL load all assets without requiring server-side logic or authentication.
4. THE Web_Client SHALL include a `settings.json` configuration file compatible with the ScratchJr_Runtime's settings loading mechanism.
