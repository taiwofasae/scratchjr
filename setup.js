const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const BUNDLE_SRC  = path.join(ROOT, 'src', 'build', 'bundles', 'app.bundle.js');
const BUNDLE_DEST = path.join(ROOT, 'editions', 'free', 'src', 'app.bundle.v2.js');

function log(msg) { console.log('[setup] ' + msg); }
function die(msg) { console.error('[setup] ERROR: ' + msg); process.exit(1); }

log('Installing dependencies...');
try {
    execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
    die('npm install failed.');
}

log('Building bundle...');
try {
    execSync('npm run dev', {
        cwd: ROOT,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { NODE_OPTIONS: '--openssl-legacy-provider' })
    });
} catch (e) {
    die('Build failed.');
}

if (!fs.existsSync(BUNDLE_SRC)) {
    die('Bundle not found at ' + BUNDLE_SRC);
}

let content = fs.readFileSync(BUNDLE_SRC, 'utf8');

const patches = [
    {
        name: 'IO.getObject null guard',
        from: 'getObject(md5, fcn) {\n            if (md5.indexOf',
        to:   'getObject(md5, fcn) {\n            if (md5 === undefined || md5 === null) { if (fcn) { fcn(JSON.stringify([{id:1,name:"Untitled",version:"iOSv01",deleted:"NO",mtime:Date.now().toString(),isgift:"0"}])); } return; }\n            if (md5.indexOf'
    },
    {
        name: 'expose window.Project',
        from: 'exports.default = Project;',
        to:   'exports.default = Project; window.Project = Project;'
    },
    {
        name: 'expose window.MediaLib',
        from: 'exports.default = MediaLib;',
        to:   'exports.default = MediaLib; window.MediaLib = MediaLib;'
    },
    {
        name: 'expose window.UI',
        from: 'exports.default = UI;',
        to:   'exports.default = UI; window.UI = UI;'
    }
];

patches.forEach(function (patch) {
    if (!content.includes(patch.from)) {
        die('Patch "' + patch.name + '" target not found — bundle format may have changed.');
    }
    content = content.replace(patch.from, patch.to);
    log('Applied: ' + patch.name);
});

// Redirect all internal navigation back to viewer.html instead of the
// native app pages (home.html, editor.html, index.html, gettingstarted.html)
content = content
    .replace(/home\.html/g, 'viewer.html')
    .replace(/'editor\.html/g, "'viewer.html")
    .replace(/"editor\.html/g, '"viewer.html')
    .replace(/index\.html\?back/g, 'viewer.html?back')
    .replace(/gettingstarted\.html/g, 'viewer.html');
log('Applied: navigation redirect to viewer.html');

fs.writeFileSync(BUNDLE_DEST, content, 'utf8');

log('Done. Run "npm start" then open:');
log('  http://localhost:8000/editions/free/src/viewer.html');
