# Ameri-CAD API Reference

This document covers the public APIs available for scripting and extending Ameri-CAD.

---

## Table of Contents

1. [Global API](#global-api)
2. [AmericaD Class](#americad-class)
3. [DocumentModel](#documentmodel)
4. [Kernel Bridge](#kernel-bridge)
5. [Commands](#commands)
6. [Events](#events)
7. [Code Examples](#code-examples)

---

## Global API

When Ameri-CAD loads, it exposes a global `window.AmericaD` object with access to all subsystems.

### window.AmericaD

```javascript
// Access the main application
const app = window.AmericaD.app;

// Access subsystems
window.AmericaD.scene           // Three.js Scene
window.AmericaD.camera          // Three.js PerspectiveCamera
window.AmericaD.renderer        // Three.js WebGLRenderer
window.AmericaD.controls        // OrbitControls
window.AmericaD.kernel          // KernelBridge instance
window.AmericaD.document        // DocumentModel instance
window.AmericaD.evaluator       // Evaluator instance
window.AmericaD.featureTree     // FeatureTreeUI instance

// State
window.AmericaD.System          // System state object
window.AmericaD.selectionManager
window.AmericaD.commandManager
window.AmericaD.sketchManager
```

### Quick Actions

```javascript
// Create primitives
await AmericaD.createPrimitive('box', { size: [20, 30, 10] });
await AmericaD.createPrimitive('sphere', { radius: 15 });

// Tools
AmericaD.setTool('select');
AmericaD.setTool('move');

// Views
AmericaD.setView('front');
AmericaD.setView('iso');
AmericaD.zoomToFit();

// Selection
AmericaD.selectObject(mesh);
AmericaD.deselectObject();
AmericaD.deleteSelected();

// History
AmericaD.undo();
AmericaD.redo();

// Files
AmericaD.saveDocument();
await AmericaD.openDocument();
await AmericaD.exportScene();

// Sketch
AmericaD.enterSketchMode('xy');
AmericaD.exitSketchMode();
await AmericaD.extrudeSketch(25);

// Logging
AmericaD.log('Hello', 'info');    // types: 'info', 'success', 'warn', 'error'
```

---

## AmericaD Class

The main application class (`src/main.js`).

### Constructor

```javascript
const app = new AmericaD({
  container: '#viewport',       // Viewport container selector
  treeContainer: '#feature-tree' // Feature tree container selector
});
```

### Initialization

```javascript
// Initialize with Three.js reference
await app.init(THREE);

// Set up scene references
app.setScene(scene, camera, renderer, controls, transformControl);
```

### Primitive Creation

All primitive methods return a `Feature` object.

```javascript
// Box
const box = await app.createBox({
  width: 20,
  height: 10,
  depth: 30,
  center: { x: 0, y: 5, z: 0 },
  name: 'MyBox'  // optional
});

// Cylinder
const cyl = await app.createCylinder({
  radius: 8,
  height: 20,
  center: { x: 0, y: 0, z: 0 }
});

// Sphere
const sphere = await app.createSphere({
  radius: 10,
  center: { x: 0, y: 10, z: 0 }
});

// Cone
const cone = await app.createCone({
  radius1: 10,    // base radius
  radius2: 0,     // top radius (0 = point)
  height: 20,
  center: { x: 0, y: 0, z: 0 }
});
```

### Boolean Operations

All boolean methods require kernel-evaluated features and return a new `BooleanFeature`.

```javascript
// Union - combine shapes
const union = await app.booleanUnion(targetId, toolId, {
  name: 'Combined'
});

// Subtract - cut tool from target
const cut = await app.booleanSubtract(targetId, toolId, {
  name: 'Cut'
});

// Intersect - keep only overlap
const common = await app.booleanIntersect(targetId, toolId);
```

### Feature Management

```javascript
// Select a feature
app.selectFeature('feature_1');
app.selectFeature(null);  // deselect

// Delete a feature (and dependents)
await app.deleteFeature('feature_1');

// Update feature parameters (triggers regeneration)
await app.updateFeature('feature_1', {
  width: 30,
  height: 40
});

// Toggle visibility
app.setFeatureVisibility('feature_1', false);

// Rename
app.renameFeature('feature_1', 'New Name');
```

### File Operations

```javascript
// Save to .americad file (triggers download)
app.saveDocument('my-design');

// Open file picker and load
const success = await app.openDocument();

// Load from JSON string or object
await app.loadDocument(jsonString, 'filename.americad');

// Check for unsaved changes
if (app.hasUnsavedChanges()) {
  // prompt user
}

// Get document info
const info = app.getDocumentInfo();
// { name, featureCount, created, modified }
```

### Export

```javascript
// STEP export (recommended for CAD)
const result = await app.exportSTEP();  // all visible features
// or
const result = await app.exportSTEP('feature_1');  // single feature
// or
const result = await app.exportSTEP(['feature_1', 'feature_2']);  // multiple
// result: { success: boolean, count: number, error?: string }

// STL export
const result = await app.exportSTL('feature_1', {
  binary: true,         // binary format (smaller)
  filename: 'part',
  useKernel: true       // try kernel export first
});
// result: { success, method: 'kernel'|'mesh', stats? }

// Export multiple to single STL
const result = await app.exportMultipleSTL(['f1', 'f2'], {
  binary: true,
  filename: 'assembly'
});

// Get STL stats without exporting
const stats = app.getSTLExportStats('feature_1');
// { triangleCount, vertexCount, minBounds, maxBounds }
```

### Properties

```javascript
app.kernelReady         // boolean: is kernel initialized?
app.selectedFeatureId   // string | null: currently selected feature
app.document            // DocumentModel instance
app.evaluator           // Evaluator instance
app.treeUI              // FeatureTreeUI instance
```

---

## DocumentModel

The parametric feature tree (`src/state/document.js`).

### Creating Features

```javascript
import { 
  BoxFeature, 
  CylinderFeature, 
  SphereFeature,
  ConeFeature,
  BooleanFeature,
  FilletFeature,
  ChamferFeature
} from './src/state/document.js';

// Create a feature
const box = new BoxFeature({
  width: 20,
  height: 20,
  depth: 20,
  center: { x: 0, y: 10, z: 0 },
  name: 'My Box'
});

// Add to document
document.addFeature(box);

// Create a boolean (with dependencies)
const booleanFeature = new BooleanFeature(
  'subtract',      // operation: 'union' | 'subtract' | 'intersect'
  'feature_1',     // target ID
  'feature_2',     // tool ID
  { name: 'Cut' }
);
document.addFeature(booleanFeature);
```

### Querying Features

```javascript
// Get a feature by ID
const feature = document.getFeature('feature_1');

// Get all features in dependency order
const ordered = document.getTopologicalOrder();
// ['feature_1', 'feature_2', 'feature_3', ...]

// Get features that depend on a given feature
const dependents = document.getDependents('feature_1');

// Get leaf features (no children)
const leaves = document.getLeafFeatures();

// Iterate all features
for (const [id, feature] of document.features) {
  console.log(id, feature.type, feature.params);
}
```

### Modifying Features

```javascript
// Update parameters
document.updateFeature('feature_1', { width: 40 });

// Remove (cascades to children)
document.removeFeature('feature_1');

// Clear all
document.clear();
```

### Serialization

```javascript
// To JSON object
const json = document.toJSON();

// From JSON object
const newDoc = DocumentModel.fromJSON(json);
```

### Events

```javascript
// Listen for changes
document.onFeatureAdded = (feature) => {
  console.log('Added:', feature.name);
};

document.onFeatureRemoved = (feature) => {
  console.log('Removed:', feature.name);
};

document.onFeatureModified = (feature) => {
  console.log('Modified:', feature.name);
};

document.onDocumentChanged = () => {
  console.log('Document changed');
};
```

---

## Kernel Bridge

Low-level access to the geometry kernel (`src/kernel/bridge.js`).

### Initialization

```javascript
import { kernel } from './src/kernel/bridge.js';

// Initialize (loads WASM)
await kernel.init();

// Check status
kernel.isReady()  // boolean
```

### Primitives

All methods return `{ id, mesh, params }`.

```javascript
const box = await kernel.createBox(20, 10, 30, { x: 0, y: 0, z: 0 });
const cyl = await kernel.createCylinder(5, 20, { x: 0, y: 0, z: 0 });
const sphere = await kernel.createSphere(10, { x: 0, y: 0, z: 0 });
const cone = await kernel.createCone(10, 0, 20, { x: 0, y: 0, z: 0 });
const torus = await kernel.createTorus(10, 3, { x: 0, y: 0, z: 0 });
const wedge = await kernel.createWedge(20, 10, 30, 5, { x: 0, y: 0, z: 0 });
```

### Booleans

All methods return `{ id, mesh }`.

```javascript
const union = await kernel.union(id1, id2);
const cut = await kernel.subtract(id1, id2);
const common = await kernel.intersect(id1, id2);

// Or use unified method
const result = await kernel.boolean(id1, id2, 'subtract');
```

### Features

```javascript
// Fillet edges
const filleted = await kernel.fillet(shapeId, ['edge_1', 'edge_2'], 3);

// Chamfer edges
const chamfered = await kernel.chamfer(shapeId, ['edge_1'], 2);

// Extrude profile
const extruded = await kernel.extrude(profileId, { x: 0, y: 0, z: 1 }, 25);

// Revolve profile
const revolved = await kernel.revolve(
  profileId,
  { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 1, z: 0 } },
  360  // degrees
);

// Shell (hollow out)
const shelled = await kernel.shell(shapeId, ['face_1'], 2);  // thickness

// Loft between profiles
const lofted = await kernel.loft(['profile_1', 'profile_2'], true);  // solid

// Sweep along path
const swept = await kernel.sweep(profileId, pathId);
```

### Export

```javascript
// STEP
const { content, format } = await kernel.exportSTEP(shapeId);
const { content, format, count } = await kernel.exportSTEPMultiple([id1, id2]);
const { content, format, count } = await kernel.exportSTEPAll();

// STL
const { content, format } = await kernel.exportSTL(shapeId);
```

### Analysis

```javascript
const { volume } = await kernel.getVolume(shapeId);
const { min, max } = await kernel.getBoundingBox(shapeId);
// min/max: { x, y, z }
```

### Memory Management

```javascript
// Delete a shape from kernel memory
await kernel.deleteShape(shapeId);

// Terminate the worker
kernel.terminate();
```

### Mesh Conversion

```javascript
import { meshToThreeGeometry } from './src/kernel/bridge.js';

// Convert kernel mesh to Three.js BufferGeometry
const geometry = meshToThreeGeometry(result.mesh, THREE);
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);
```

---

## Commands

Register and execute CLI commands (`src/core/commands.js`).

### Register a Command

```javascript
import { registerCommand } from './src/core/commands.js';

registerCommand('mycommand', {
  aliases: ['mc', 'mycmd'],
  description: 'Does something cool',
  category: 'custom',
  params: [
    { name: 'size', type: 'number', required: true, description: 'Size in mm' },
    { name: 'name', type: 'string', required: false, default: 'default' }
  ],
  validate(params) {
    if (params.size <= 0) return 'Size must be positive';
    return true;  // validation passed
  },
  async execute(params, context) {
    // context.kernel - KernelBridge
    // context.document - DocumentModel
    // context.selection - selected IDs
    // context.log - log function
    
    const result = await doSomething(params.size, params.name);
    return result;
  }
});
```

### Execute Commands Programmatically

```javascript
import { executeCommand } from './src/core/app-integration.js';

const result = await executeCommand('box 20 30 10');
if (result.success) {
  console.log('Created:', result.result);
}
```

### Get Suggestions

```javascript
import { getCommandSuggestions } from './src/core/app-integration.js';

const suggestions = getCommandSuggestions('bo');
// [{ name: 'box', description: 'Create a box primitive' }]
```

---

## Events

### Selection Events

```javascript
import { selectionManager } from './src/state/selection.js';

selectionManager.onSelectionChange((selected) => {
  if (selected) {
    console.log('Selected:', selected.userData.name);
  } else {
    console.log('Deselected');
  }
});
```

### History Events

```javascript
import { commandManager } from './src/state/history.js';

commandManager.onStateChange((canUndo, canRedo) => {
  undoButton.disabled = !canUndo;
  redoButton.disabled = !canRedo;
});
```

### Document Events

```javascript
document.onFeatureAdded = (feature) => { /* ... */ };
document.onFeatureRemoved = (feature) => { /* ... */ };
document.onFeatureModified = (feature) => { /* ... */ };
document.onDocumentChanged = () => { /* ... */ };
```

### Feature Tree Events

```javascript
const treeUI = window.AmericaD.featureTree;

treeUI.onFeatureSelect = (featureId) => { /* ... */ };
treeUI.onFeatureDoubleClick = (featureId) => { /* ... */ };
treeUI.onVisibilityToggle = (featureId, visible) => { /* ... */ };
treeUI.onFeatureDelete = (featureId) => { /* ... */ };
treeUI.onFeatureRename = (featureId, newName) => { /* ... */ };
```

---

## Code Examples

### Create a Custom Part

```javascript
async function createBracket() {
  const app = window.AmericaD.app;
  
  // Create main body
  const body = await app.createBox({
    width: 50,
    height: 10,
    depth: 30,
    center: { x: 0, y: 5, z: 0 },
    name: 'Base'
  });
  
  // Create mounting holes
  const hole1 = await app.createCylinder({
    radius: 3,
    height: 20,
    center: { x: -15, y: 0, z: 0 },
    name: 'Hole1'
  });
  
  const hole2 = await app.createCylinder({
    radius: 3,
    height: 20,
    center: { x: 15, y: 0, z: 0 },
    name: 'Hole2'
  });
  
  // Cut holes from body
  const withHole1 = await app.booleanSubtract(body.id, hole1.id);
  const bracket = await app.booleanSubtract(withHole1.id, hole2.id, {
    name: 'Bracket'
  });
  
  // Hide intermediate features
  app.setFeatureVisibility(body.id, false);
  app.setFeatureVisibility(hole1.id, false);
  app.setFeatureVisibility(hole2.id, false);
  app.setFeatureVisibility(withHole1.id, false);
  
  return bracket;
}
```

### Batch Create Parts

```javascript
async function createGrid(rows, cols, spacing) {
  const app = window.AmericaD.app;
  const features = [];
  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const box = await app.createBox({
        width: 10,
        height: 10,
        depth: 10,
        center: {
          x: j * spacing,
          y: 5,
          z: i * spacing
        },
        name: `Box_${i}_${j}`
      });
      features.push(box);
    }
  }
  
  return features;
}
```

### Export Workflow

```javascript
async function exportForManufacturing(featureIds) {
  const app = window.AmericaD.app;
  
  // Save parametric version first
  app.saveDocument('design-backup');
  
  // Export STEP for CAM
  const stepResult = await app.exportSTEP(featureIds);
  if (!stepResult.success) {
    console.error('STEP export failed:', stepResult.error);
    return;
  }
  
  // Export STL for visualization
  const stlResult = await app.exportMultipleSTL(featureIds, {
    binary: true,
    filename: 'design-stl'
  });
  
  console.log(`Exported ${stepResult.count} parts`);
}
```

### Listen for Changes

```javascript
function setupChangeTracking() {
  const doc = window.AmericaD.document;
  let unsavedChanges = false;
  
  doc.onDocumentChanged = () => {
    unsavedChanges = true;
    updateTitleBar();
  };
  
  // Warn before leaving with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (unsavedChanges) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes.';
    }
  });
  
  function updateTitleBar() {
    document.title = unsavedChanges 
      ? '* Ameri-CAD - Untitled' 
      : 'Ameri-CAD - Untitled';
  }
}
```

### Custom Command

```javascript
// Add a "duplicate" command
registerCommand('duplicate', {
  aliases: ['dup', 'copy'],
  description: 'Duplicate the selected feature',
  params: [
    { name: 'offset', type: 'number', required: false, default: 20 }
  ],
  async execute(params, context) {
    const app = window.AmericaD.app;
    const selectedId = app.selectedFeatureId;
    
    if (!selectedId) {
      throw new Error('Nothing selected');
    }
    
    const original = app.document.getFeature(selectedId);
    if (!original) {
      throw new Error('Feature not found');
    }
    
    // Clone parameters with offset
    const newParams = { ...original.params };
    if (newParams.center) {
      newParams.center = {
        ...newParams.center,
        x: newParams.center.x + params.offset
      };
    }
    
    // Create duplicate based on type
    let newFeature;
    switch (original.type) {
      case 'box':
        newFeature = await app.createBox(newParams);
        break;
      case 'cylinder':
        newFeature = await app.createCylinder(newParams);
        break;
      case 'sphere':
        newFeature = await app.createSphere(newParams);
        break;
      default:
        throw new Error(`Cannot duplicate ${original.type}`);
    }
    
    return newFeature;
  }
});
```

---

## TypeScript Definitions

For TypeScript users, here are the key interfaces:

```typescript
interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Feature {
  id: string;
  type: string;
  params: Record<string, any>;
  dependencies: string[];
  children: string[];
  kernelId: string | null;
  meshId: string | null;
  valid: boolean;
  visible: boolean;
  name: string;
  createdAt: number;
  modifiedAt: number;
}

interface BoxParams {
  width?: number;
  height?: number;
  depth?: number;
  center?: Point3D;
  name?: string;
}

interface CylinderParams {
  radius?: number;
  height?: number;
  center?: Point3D;
  name?: string;
}

interface KernelMesh {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  faceIds: string[];
}

interface KernelResult {
  id: string;
  mesh: KernelMesh;
  params?: Record<string, any>;
}

interface ExportResult {
  success: boolean;
  count?: number;
  error?: string;
}
```
