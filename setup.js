const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const BUNDLE_SRC  = path.join(ROOT, 'src', 'build', 'bundles', 'app.bundle.js');
const BUNDLE_DEST = path.join(ROOT, 'editions', 'free', 'src', 'app.bundle.v2.js');

function log(msg) {
    console.log('[setup] ' + msg);
}

function die(msg) {
    console.error('[setup] ERROR: ' + msg);
    process.exit(1);
}

// Step 1: Install dependencies
log('Installing npm dependencies...');
try {
    execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
    die('npm install failed.');
}

// Step 2: Build the webpack bundle
log('Building app bundle (this takes ~30 seconds)...');
try {
    execSync('npm run dev', {
        cwd: ROOT,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { NODE_OPTIONS: '--openssl-legacy-provider' })
    });
} catch (e) {
    die('webpack build failed. Check the output above.');
}

if (!fs.existsSync(BUNDLE_SRC)) {
    die('Bundle not found at ' + BUNDLE_SRC + ' after build.');
}

// Step 3: Copy bundle to editions/free/src/
log('Copying bundle to editions/free/src/...');
let content = fs.readFileSync(BUNDLE_SRC, 'utf8');

// Step 4: Apply patches

// Patch 1: Guard IO.getObject against undefined currentProject.
// Without this, opening the viewer with no saved project crashes immediately.
const getObjectOld = 'getObject(md5, fcn) {\n            if (md5.indexOf';
const getObjectNew = 'getObject(md5, fcn) {\n            if (md5 === undefined || md5 === null) { if (fcn) { fcn(JSON.stringify([{id:1,name:"Untitled",version:"iOSv01",deleted:"NO",mtime:Date.now().toString(),isgift:"0"}])); } return; }\n            if (md5.indexOf';

if (!content.includes(getObjectOld)) {
    die('Patch 1 target not found — the bundle format may have changed.');
}
content = content.replace(getObjectOld, getObjectNew);
log('Patch 1 applied: IO.getObject null guard');

// Patch 2: Expose Project on window so url-loader.js can call Project.loadData.
const projectExportOld = 'exports.default = Project;';
const projectExportNew = 'exports.default = Project; window.Project = Project;';

if (!content.includes(projectExportOld)) {
    die('Patch 2 target not found — the bundle format may have changed.');
}
content = content.replace(projectExportOld, projectExportNew);
log('Patch 2 applied: window.Project exposed');

// Patch 3: Expose MediaLib on window (used for future extensibility).
const mediaLibExportOld = 'exports.default = MediaLib;';
const mediaLibExportNew = 'exports.default = MediaLib; window.MediaLib = MediaLib;';

if (!content.includes(mediaLibExportOld)) {
    die('Patch 3 target not found — the bundle format may have changed.');
}
content = content.replace(mediaLibExportOld, mediaLibExportNew);
log('Patch 3 applied: window.MediaLib exposed');

// Write patched bundle
fs.writeFileSync(BUNDLE_DEST, content, 'utf8');
log('Bundle written to ' + BUNDLE_DEST);

log('');
log('Setup complete.');
log('');
log('To start the development server:');
log('  npm start');
log('');
log('Then open:');
log('  http://localhost:8000/editions/free/src/viewer.html');
log('');
log('To load a project from a URL:');
log('  http://localhost:8000/editions/free/src/viewer.html?file_url=https://public.fasae.dev/stem-club/scratchjr/Classroom.sjr');
