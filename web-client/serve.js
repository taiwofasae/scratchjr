const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;
const DIST = path.join(__dirname, 'dist');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.json': 'application/json',
    '.png':  'image/png',
    '.svg':  'image/svg+xml',
    '.mp3':  'audio/mpeg',
    '.wav':  'audio/wav',
    '.sjr':  'application/octet-stream',
    '.ttf':  'font/ttf',
    '.woff': 'font/woff',
    '.woff2':'font/woff2'
};

const server = http.createServer(function (req, res) {
    var urlPath = req.url.split('?')[0];

    if (urlPath === '/' || urlPath === '') {
        var qs = req.url.indexOf('?') !== -1 ? req.url.slice(req.url.indexOf('?')) : '';
        res.writeHead(302, { 'Location': '/index.html' + qs });
        res.end();
        return;
    }

    var filePath = path.join(DIST, urlPath);

    if (!filePath.startsWith(DIST)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, function (err, stat) {
        if (err || !stat.isFile()) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        var ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, function () {
    console.log('Serving dist/ at http://localhost:' + PORT);
    console.log('URL loading: http://localhost:' + PORT + '/?file_url=https://public.fasae.dev/stem-club/scratchjr/Classroom.sjr');
});
