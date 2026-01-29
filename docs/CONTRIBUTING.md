# Contributing to Ameri-CAD

Thank you for your interest in contributing to Ameri-CAD! This guide will help you get set up and understand our development practices.

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Code Style](#code-style)
4. [Testing](#testing)
5. [Pull Request Process](#pull-request-process)
6. [Architecture Decisions](#architecture-decisions)
7. [Common Tasks](#common-tasks)

---

## Development Setup

### Prerequisites

- **Node.js 18+** (for tooling, optional)
- **Python 3** (for local server)
- **Modern browser** (Chrome, Firefox, or Edge)
- **Git**

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/americad.git
   cd americad
   ```

2. **Install dependencies** (optional, for development tools)
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   ./start-server.sh
   # or
   python3 -m http.server 8000
   ```

4. **Open in browser**
   Navigate to `http://localhost:8000`

### Development Tools

The project uses minimal tooling to keep things simple:

- **No build step required** — ES modules load directly in browser
- **Hot reload** — Just refresh the browser after changes
- **Console debugging** — `window.AmericaD` exposes all internals

### Recommended IDE Setup

**VS Code:**
- Install "Live Server" extension for auto-reload
- Install "ESLint" for code style hints
- Install "Prettier" for formatting

**Settings:**
```json
{
  "editor.tabSize": 4,
  "editor.insertSpaces": true,
  "javascript.format.semicolons": "insert"
}
```

---

## Project Structure

```
americad/
├── index.html              # Main HTML entry point
├── app.js                  # Main application (UI, Three.js, events)
├── src/
│   ├── main.js             # AmericaD class (unified API)
│   ├── core/
│   │   ├── math.js         # Math utilities
│   │   ├── transforms.js   # Transform helpers
│   │   ├── commands.js     # Command registry
│   │   ├── app-integration.js  # Command system integration
│   │   └── geometry-utils.js   # Geometry helpers
│   ├── state/
│   │   ├── document.js     # DocumentModel, Feature classes
│   │   ├── selection.js    # Selection manager
│   │   └── history.js      # Undo/redo command stack
│   ├── kernel/
│   │   ├── bridge.js       # Main thread kernel API
│   │   ├── worker.js       # Web Worker (OpenCASCADE)
│   │   └── evaluator.js    # Feature → geometry conversion
│   ├── ui/
│   │   ├── feature-tree.js # Feature tree component
│   │   └── command-line.js # Command line component
│   ├── commands/
│   │   ├── primitives.js   # Primitive commands
│   │   ├── booleans.js     # Boolean/feature commands
│   │   ├── transforms.js   # Transform commands
│   │   ├── general.js      # General commands
│   │   └── export.js       # Export commands
│   ├── sketch/
│   │   ├── sketch-manager.js   # 2D sketch logic
│   │   ├── sketch-renderer.js  # Sketch visualization
│   │   └── constraint-solver.js # Constraint system
│   ├── io/
│   │   ├── file-format.js  # .americad format
│   │   └── stl-export.js   # STL export
│   └── crash-guard.js      # Crash recovery
├── lib/
│   └── opencascade/        # OpenCASCADE.js WASM build
├── tests/
│   ├── runner.html         # Test runner
│   ├── math.test.js        # Math tests
│   ├── primitives.test.js  # Primitive tests
│   ├── history.test.js     # History tests
│   └── golden/             # Golden files for comparison
└── docs/                   # Documentation
```

### Key Files

| File | Purpose |
|------|---------|
| `app.js` | Entry point, Three.js setup, event handling |
| `src/main.js` | AmericaD class, public API |
| `src/state/document.js` | Feature tree, parametric model |
| `src/kernel/worker.js` | OpenCASCADE operations |
| `src/kernel/bridge.js` | Worker communication |

---

## Code Style

### JavaScript Conventions

```javascript
// Use const/let, never var
const immutable = 'value';
let mutable = 0;

// Use async/await over .then()
async function doWork() {
    const result = await asyncOperation();
    return result;
}

// Use template literals
const message = `Created ${count} objects`;

// Use destructuring
const { width, height } = params;

// Use arrow functions for callbacks
array.map(item => item.value);

// Use ES modules
import { something } from './module.js';
export function myFunction() { }
```

### Naming Conventions

```javascript
// Classes: PascalCase
class DocumentModel { }

// Functions/methods: camelCase
function createPrimitive() { }

// Constants: UPPER_SNAKE_CASE
const FILE_FORMAT_VERSION = '1.0';

// Private methods: underscore prefix
_internalMethod() { }

// Event handlers: onEventName
onFeatureSelect(id) { }

// Boolean flags: is/has/can prefix
isKernelReady
hasUnsavedChanges
canUndo
```

### File Organization

Each file should have a clear purpose:

```javascript
/**
 * Module description
 * 
 * Explain what this module does and its responsibilities.
 */

// Imports (external first, then internal)
import * as THREE from 'three';
import { kernel } from './kernel/bridge.js';

// Constants
const DEFAULT_SIZE = 10;

// Main exports
export class MyClass { }

export function myFunction() { }

// Private helpers (not exported)
function helperFunction() { }
```

### Comments

```javascript
// Single line comment for quick notes

/**
 * JSDoc for public APIs
 * 
 * @param {number} width - Width in millimeters
 * @param {Object} options - Optional settings
 * @returns {Promise<Feature>} The created feature
 */
async function createBox(width, options = {}) { }

// TODO: Description of what needs to be done
// FIXME: Description of what's broken
// NOTE: Important context for future readers
```

---

## Testing

### Running Tests

Open `tests/runner.html` in your browser:

```bash
# Start server
python3 -m http.server 8000

# Open http://localhost:8000/tests/runner.html
```

### Writing Tests

Tests use a simple assertion framework:

```javascript
// tests/my-feature.test.js

import { test, assert, assertEqual } from './test-utils.js';

test('Feature creation', async () => {
    const feature = new BoxFeature({ width: 10 });
    
    assert(feature.id, 'Feature should have an ID');
    assertEqual(feature.type, 'box', 'Type should be box');
    assertEqual(feature.params.width, 10, 'Width should match');
});

test('Kernel integration', async () => {
    await kernel.init();
    
    const result = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
    
    assert(result.id, 'Result should have kernel ID');
    assert(result.mesh.vertices.length > 0, 'Should have vertices');
});
```

### Golden Tests

For geometry tests, we compare against known-good outputs:

```javascript
test('Box geometry', async () => {
    const result = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
    const golden = await loadGolden('box_10x10x10.json');
    
    assertMeshEquals(result.mesh, golden, 'Box mesh should match golden');
});
```

### Test Coverage Goals

- All kernel operations (primitives, booleans, features)
- Document model serialization/deserialization
- Command execution
- Undo/redo functionality

---

## Pull Request Process

### Before You Start

1. **Check existing issues** — Someone may already be working on it
2. **Create an issue first** for significant changes
3. **Discuss design** for architectural changes

### Branch Naming

```
feature/add-pattern-command
fix/boolean-intersection-crash
docs/update-api-reference
refactor/simplify-evaluator
```

### Commit Messages

Follow conventional commits:

```
feat: add circular pattern command
fix: prevent crash when kernel times out
docs: update architecture diagram
refactor: simplify feature evaluation
test: add golden tests for fillet
chore: update opencascade.js version
```

### Pull Request Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests added/updated
- [ ] Manual testing performed

## Screenshots (if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
```

### Review Process

1. Open PR against `main` branch
2. Automated checks run (if configured)
3. Maintainer reviews
4. Address feedback
5. Squash and merge when approved

---

## Architecture Decisions

### Why Web Workers for Kernel?

**Problem:** OpenCASCADE operations can take 100ms+ for complex booleans.

**Decision:** Run kernel in a Web Worker.

**Benefits:**
- UI remains responsive during heavy operations
- Progress reporting possible
- Prevents "not responding" warnings

**Trade-offs:**
- All kernel communication is async
- Data must be serializable (no Three.js objects)
- Debugging is harder

### Why JSON for File Format?

**Problem:** Need to persist parametric history.

**Decision:** JSON-based `.americad` format.

**Benefits:**
- Human-readable and editable
- Version control friendly (diff/merge)
- Easy to parse and validate
- Forward compatible with version field

**Trade-offs:**
- Larger files than binary formats
- No geometry caching (regenerates on load)

### Why DocumentModel vs Direct Scene Manipulation?

**Problem:** Need parametric editing with undo.

**Decision:** All operations go through DocumentModel.

**Benefits:**
- Single source of truth
- Clean dependency tracking
- Proper undo/redo
- Reliable save/load

**Trade-offs:**
- More indirection
- Slightly more complex code paths

### Why Feature-Based vs CSG Tree?

**Problem:** How to represent modeling history.

**Decision:** Feature list with explicit dependencies.

**Benefits:**
- Matches user mental model
- Easy to serialize
- Clear evaluation order
- Familiar to SolidWorks/Fusion users

**Trade-offs:**
- Some operations don't fit feature model well
- Boolean chains create deep trees

---

## Common Tasks

### Adding a New Primitive

1. **Worker** (`src/kernel/worker.js`):
   ```javascript
   function createMyPrimitive(param1, param2, center) {
       const shape = /* OpenCASCADE code */;
       return { shape, id: getTopoId(shape), type: 'myprimitive', params: {...} };
   }
   
   // In message handler:
   case 'createMyPrimitive':
       const prim = createMyPrimitive(params.param1, params.param2, params.center);
       shapes.set(prim.id, prim.shape);
       result = { id: prim.id, mesh: tessellate(prim.shape), params: prim.params };
       break;
   ```

2. **Bridge** (`src/kernel/bridge.js`):
   ```javascript
   async createMyPrimitive(param1, param2, center = { x: 0, y: 0, z: 0 }) {
       await this.init();
       return this._call('createMyPrimitive', { param1, param2, center });
   }
   ```

3. **Feature** (`src/state/document.js`):
   ```javascript
   export class MyPrimitiveFeature extends Feature {
       constructor(params) {
           super('myprimitive', {
               param1: params.param1 ?? 10,
               param2: params.param2 ?? 20,
               center: params.center ?? { x: 0, y: 0, z: 0 },
               ...params
           });
       }
   }
   ```

4. **AmericaD** (`src/main.js`):
   ```javascript
   async createMyPrimitive(params = {}) {
       const feature = new MyPrimitiveFeature(params);
       this.document.addFeature(feature);
       if (this.kernelReady) {
           await this.evaluator.evaluateFeature(feature.id);
       }
       return feature;
   }
   ```

5. **Command** (`src/commands/primitives.js`):
   ```javascript
   registerCommand('myprimitive', {
       aliases: ['mp'],
       params: [
           { name: 'param1', type: 'number', required: true },
           { name: 'param2', type: 'number', required: false, default: 20 }
       ],
       async execute(params, context) {
           return await context.americad.createMyPrimitive(params);
       }
   });
   ```

6. **Evaluator** (`src/kernel/evaluator.js`):
   ```javascript
   // In evaluateFeature switch:
   case 'myprimitive':
       return this.evaluateMyPrimitive(feature);
   
   async evaluateMyPrimitive(feature) {
       const { param1, param2, center } = feature.params;
       const result = await kernel.createMyPrimitive(param1, param2, center);
       // ... mesh creation, scene addition
   }
   ```

7. **Tests** (`tests/primitives.test.js`):
   ```javascript
   test('MyPrimitive creation', async () => {
       const result = await kernel.createMyPrimitive(10, 20, { x: 0, y: 0, z: 0 });
       assert(result.id, 'Should return ID');
       assert(result.mesh.vertices.length > 0, 'Should have geometry');
   });
   ```

### Adding a New Command

1. Create or update a file in `src/commands/`
2. Register with `registerCommand()`
3. Add to `src/core/app-integration.js` if needed
4. Update help text in `app.js`
5. Add to documentation

### Debugging the Kernel

```javascript
// In browser console:

// Check kernel status
window.AmericaD.kernel.isReady()

// List stored shapes
// (Add this to worker.js for debugging)
self.postMessage({ id: -1, action: 'listShapes', result: Array.from(shapes.keys()) });

// Get worker logs
// Check console for [Kernel] prefixed messages
```

### Performance Profiling

```javascript
// Wrap slow operations
console.time('boolean');
await kernel.subtract(id1, id2);
console.timeEnd('boolean');

// Profile tessellation
console.time('tessellate');
const mesh = tessellate(shape, 0.1);
console.timeEnd('tessellate');
```

---

## Getting Help

- **Documentation:** Check the `docs/` folder
- **Issues:** Search existing issues before creating new ones
- **Discussions:** Use GitHub Discussions for questions

---

## Recognition

Contributors are recognized in:
- Git history
- Release notes
- README acknowledgments

Thank you for contributing to Ameri-CAD! 🇺🇸
