// serve.js
// Minimal static file server for local development.
// Serves the project root at http://localhost:8000
// Usage: node serve.js

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html',
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.json': 'application/json',
    '.png':  'image/png',
    '.svg':  'image/svg+xml',
    '.mp3':  'audio/mpeg',
    '.wav':  'audio/wav',
    '.sjr':  'application/octet-stream'
};

const server = http.createServer(function (req, res) {
    var urlPath = req.url.split('?')[0];
    var filePath = path.join(ROOT, urlPath);

    fs.stat(filePath, function (err, stat) {
        if (err || !stat.isFile()) {
            res.writeHead(404);
            res.end('Not found: ' + urlPath);
            return;
        }

        var ext = path.extname(filePath).toLowerCase();
        var contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, function () {
    console.log('Serving at http://localhost:' + PORT);
    console.log('Open: http://localhost:' + PORT + '/editions/free/src/viewer.html');
});
