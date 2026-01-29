#!/bin/bash
# AMERICA-D CAD System - Quick Start Server
# This starts a local web server so the CAD application can load properly

echo "========================================"
echo "  AMERICA-D CAD SYSTEM"
echo "  Starting local server..."
echo "========================================"
echo ""

# Try different server options
if command -v python3 &> /dev/null; then
    echo "Using Python 3 server on http://localhost:8000"
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "Using Python server on http://localhost:8000"
    python -m http.server 8000
elif command -v node &> /dev/null; then
    if command -v npx &> /dev/null; then
        echo "Using npx serve on http://localhost:3000"
        npx serve .
    else
        echo "Using Node.js http-server"
        node -e "const http = require('http'); const fs = require('fs'); const path = require('path'); const server = http.createServer((req, res) => { const file = req.url === '/' ? 'index.html' : req.url; const ext = path.extname(file); const types = {'.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript'}; try { res.writeHead(200, {'Content-Type': types[ext] || 'text/plain'}); res.end(fs.readFileSync(path.join('.', file))); } catch(e) { res.writeHead(404); res.end('Not found'); } }); server.listen(8000, () => console.log('Server running on http://localhost:8000'));"
    fi
else
    echo "ERROR: No suitable server found. Please install Python or Node.js."
    echo "Or use any static file server to serve this directory."
    exit 1
fi
