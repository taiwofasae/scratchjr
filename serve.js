const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8000;
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

function handleProxy(req, res) {
    var parsed = url.parse(req.url, true);
    var targetUrl = parsed.query.url;

    if (!targetUrl) {
        res.writeHead(400);
        res.end('Missing url parameter');
        return;
    }

    var parsedTarget;
    try {
        parsedTarget = url.parse(targetUrl);
    } catch (e) {
        res.writeHead(400);
        res.end('Invalid url parameter');
        return;
    }

    if (parsedTarget.protocol !== 'https:' && parsedTarget.protocol !== 'http:') {
        res.writeHead(400);
        res.end('Only http and https URLs are supported');
        return;
    }

    var client = parsedTarget.protocol === 'https:' ? https : http;
    var options = {
        hostname: parsedTarget.hostname,
        port: parsedTarget.port,
        path: parsedTarget.path,
        method: 'GET',
        headers: { 'User-Agent': 'ScratchJr-Viewer/1.0' }
    };

    var proxyReq = client.request(options, function (proxyRes) {
        if (proxyRes.statusCode >= 400) {
            res.writeHead(proxyRes.statusCode);
            res.end('Remote server returned HTTP ' + proxyRes.statusCode);
            return;
        }
        res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
        });
        proxyRes.pipe(res);
    });

    proxyReq.on('error', function (err) {
        res.writeHead(502);
        res.end('Could not reach remote server: ' + err.message);
    });

    proxyReq.end();
}

function handleStatic(req, res) {
    var urlPath = req.url.split('?')[0];
    var filePath = path.join(ROOT, urlPath);

    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, function (err, stat) {
        if (err || !stat.isFile()) {
            res.writeHead(404);
            res.end('Not found: ' + urlPath);
            return;
        }

        var ext = path.extname(filePath).toLowerCase();
        var contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        fs.createReadStream(filePath).pipe(res);
    });
}

const server = http.createServer(function (req, res) {
    var parsedUrl = url.parse(req.url);
    if (parsedUrl.pathname === '/proxy') {
        handleProxy(req, res);
    } else {
        handleStatic(req, res);
    }
});

server.listen(PORT, function () {
    console.log('Server running at http://localhost:' + PORT);
    console.log('Viewer: http://localhost:' + PORT + '/editions/free/src/viewer.html');
    console.log('URL loading: http://localhost:' + PORT + '/editions/free/src/viewer.html?file_url=https://public.fasae.dev/stem-club/scratchjr/Classroom.sjr');
});
