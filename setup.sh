#!/bin/bash
# AMERICA-D Setup Script
# Downloads OpenCASCADE.js WASM kernel

set -e

echo "🔧 AMERICA-D Setup"
echo "=================="

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy WASM files to lib
echo "📁 Setting up OpenCASCADE kernel..."
mkdir -p lib/opencascade
cp node_modules/opencascade.js/dist/opencascade.wasm.js lib/opencascade/
cp node_modules/opencascade.js/dist/opencascade.wasm.wasm lib/opencascade/

echo ""
echo "✅ Setup complete!"
echo ""
echo "To run AMERICA-D:"
echo "  python3 -m http.server 8000"
echo "  Open http://localhost:8000"
