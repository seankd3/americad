#!/usr/bin/env node
/**
 * Development server with Cross-Origin Isolation headers
 * Required for SharedArrayBuffer support
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT = process.cwd();

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Parse URL
    let filePath = req.url.split('?')[0];
    if (filePath === '/') filePath = '/index.html';
    
    const fullPath = path.join(ROOT, filePath);
    const ext = path.extname(fullPath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    // Read and serve file
    fs.readFile(fullPath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not found: ' + filePath);
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
            return;
        }
        
        // Set COOP/COEP headers for SharedArrayBuffer support
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        
        // Cache busting for development
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`\n  ╔════════════════════════════════════════════════════╗`);
    console.log(`  ║  AMERI-CAD Development Server                      ║`);
    console.log(`  ║  SharedArrayBuffer ENABLED                         ║`);
    console.log(`  ╠════════════════════════════════════════════════════╣`);
    console.log(`  ║  http://localhost:${PORT}                            ║`);
    console.log(`  ║                                                    ║`);
    console.log(`  ║  Headers:                                          ║`);
    console.log(`  ║    Cross-Origin-Opener-Policy: same-origin         ║`);
    console.log(`  ║    Cross-Origin-Embedder-Policy: require-corp      ║`);
    console.log(`  ╚════════════════════════════════════════════════════╝\n`);
});
