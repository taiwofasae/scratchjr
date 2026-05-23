const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WEB_CLIENT = __dirname;
const ROOT       = path.join(WEB_CLIENT, '..');
const SRC_DIR    = path.join(ROOT, 'editions', 'free', 'src');
const BUNDLE_SRC = path.join(ROOT, 'src', 'build', 'bundles', 'app.bundle.js');
const DIST_DIR   = path.join(WEB_CLIENT, 'dist');

function log(msg) { console.log('[setup] ' + msg); }
function die(msg) { console.error('[setup] ERROR: ' + msg); process.exit(1); }

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) { fs.mkdirSync(dest, { recursive: true }); }
    fs.readdirSync(src).forEach(function (entry) {
        var srcPath  = path.join(src, entry);
        var destPath = path.join(dest, entry);
        if (fs.statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    });
}

log('Installing root dependencies...');
try {
    execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
    die('npm install failed.');
}

log('Building webpack bundle...');
try {
    execSync('npx webpack --mode=development --progress --hide-modules', {
        cwd: ROOT,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { NODE_OPTIONS: '--openssl-legacy-provider' })
    });
} catch (e) {
    if (!fs.existsSync(BUNDLE_SRC)) {
        die('Webpack build failed and bundle was not produced.');
    }
    log('Webpack finished with warnings (bundle was produced).');
}

if (!fs.existsSync(BUNDLE_SRC)) {
    die('Bundle not found at ' + BUNDLE_SRC);
}

log('Patching bundle...');
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
    log('  Applied: ' + patch.name);
});

content = content
    .replace(/home\.html/g, 'index.html')
    .replace(/'editor\.html/g, "'index.html")
    .replace(/"editor\.html/g, '"index.html')
    .replace(/index\.html\?back/g, 'index.html?back')
    .replace(/gettingstarted\.html/g, 'index.html');
log('  Applied: navigation redirect to index.html');

// Patch requestFromServer (Samples version) to add XHR timeout
var rfsOld1 = "function requestFromServer(pos, url, whenDone) {\n            var xmlrequest = new XMLHttpRequest();\n            xmlrequest.addEventListener('error', transferFailed, false);\n            xmlrequest.onreadystatechange = function () {\n                if (xmlrequest.readyState == 4) {\n                    whenDone(pos, xmlrequest.responseText);\n                }\n            };\n            xmlrequest.open('GET', url, true);\n            xmlrequest.send(null);\n            function transferFailed(e) {\n                e.preventDefault();\n                e.stopPropagation();\n                // Failed loading\n            }\n        }";
var rfsNew1 = "function requestFromServer(pos, url, whenDone) {\n            var xmlrequest = new XMLHttpRequest();\n            var done = false;\n            xmlrequest.addEventListener('error', transferFailed, false);\n            xmlrequest.onreadystatechange = function () {\n                if (xmlrequest.readyState == 4 && !done) { done = true; whenDone(pos, xmlrequest.responseText); }\n            };\n            xmlrequest.open('GET', url, true);\n            xmlrequest.timeout = 5000;\n            xmlrequest.ontimeout = function() { if (!done) { done = true; whenDone(pos, ''); } };\n            xmlrequest.send(null);\n            function transferFailed(e) { e.preventDefault(); e.stopPropagation(); if (!done) { done = true; whenDone(pos, ''); } }\n        }";
if (content.includes(rfsOld1)) {
    content = content.replace(rfsOld1, rfsNew1);
    log('  Applied: requestFromServer(pos) XHR timeout');
} else {
    log('  WARNING: requestFromServer(pos) patch target not found — skipping');
}

// Patch requestFromServer (IO version) to add XHR timeout
var rfsOld2 = "function requestFromServer(url, whenDone) {\n            var xmlrequest = new XMLHttpRequest();\n            xmlrequest.addEventListener('error', transferFailed, false);\n            xmlrequest.onreadystatechange = function () {\n                if (xmlrequest.readyState == 4) {\n                    whenDone(xmlrequest.responseText);\n                }\n            };";
var rfsNew2 = "function requestFromServer(url, whenDone) {\n            var xmlrequest = new XMLHttpRequest();\n            var done = false;\n            xmlrequest.addEventListener('error', transferFailed, false);\n            xmlrequest.onreadystatechange = function () {\n                if (xmlrequest.readyState == 4 && !done) { done = true; whenDone(xmlrequest.responseText); }\n            };\n            xmlrequest.timeout = 5000;\n            xmlrequest.ontimeout = function() { if (!done) { done = true; whenDone(''); } };";
if (content.includes(rfsOld2)) {
    content = content.replace(rfsOld2, rfsNew2);
    log('  Applied: requestFromServer(url) XHR timeout');
} else {
    log('  WARNING: requestFromServer(url) patch target not found — skipping');
}
var loadwaitOld = 'value: function loadwait(whenDone) {\n            if (interval != null) {\n                window.clearInterval(interval);\n            }\n            mediaCountBase = mediaCount;\n            if (mediaCount <= 0) {\n                Project.getStarted(whenDone);\n            } else {\n                interval = window.setInterval(function () {\n                    Project.loadTask(whenDone);\n                }, 32);\n            }\n        }';
var loadwaitNew = 'value: function loadwait(whenDone) {\n            if (interval != null) {\n                window.clearInterval(interval);\n            }\n            mediaCountBase = mediaCount;\n            if (mediaCount <= 0) {\n                Project.getStarted(whenDone);\n            } else {\n                var loadwaitStart = Date.now();\n                interval = window.setInterval(function () {\n                    if (Date.now() - loadwaitStart > 10000) {\n                        mediaCount = 0;\n                    }\n                    Project.loadTask(whenDone);\n                }, 32);\n            }\n        }';
if (content.includes(loadwaitOld)) {
    content = content.replace(loadwaitOld, loadwaitNew);
    log('  Applied: loadwait timeout patch');
} else {
    log('  WARNING: loadwait patch target not found — skipping');
}

log('Building dist/...');
if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

fs.writeFileSync(path.join(DIST_DIR, 'app.bundle.js'), content, 'utf8');
log('  Copied: app.bundle.js (patched)');

const skipFiles = new Set([
    'index.html', 'editor.html', 'home.html', 'gettingstarted.html',
    'app.bundle.js', 'app.bundle.js.map', 'app.bundle.v2.js',
    'viewer.html', 'media.json.new'
]);

fs.readdirSync(SRC_DIR).forEach(function (entry) {
    if (skipFiles.has(entry)) { return; }
    var srcPath  = path.join(SRC_DIR, entry);
    var destPath = path.join(DIST_DIR, entry);
    if (fs.statSync(srcPath).isDirectory()) {
        copyDir(srcPath, destPath);
        log('  Copied dir: ' + entry + '/');
    } else {
        fs.copyFileSync(srcPath, destPath);
        log('  Copied: ' + entry);
    }
});

const ownFiles = ['index.html', 'web-adapter.js', 'url-loader.js', 'jszip.min.js', 'settings.json'];
ownFiles.forEach(function (entry) {
    var srcPath  = path.join(WEB_CLIENT, entry);
    var destPath = path.join(DIST_DIR, entry);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        log('  Copied: ' + entry);
    }
});

log('');
log('dist/ is ready. Run "npm start" to serve it.');
log('Open: http://localhost:8000');
log('URL loading: http://localhost:8000/?file_url=https://public.fasae.dev/stem-club/scratchjr/Classroom.sjr');
