# Ameri-CAD Architecture

This document describes the internal architecture of Ameri-CAD, intended for developers who want to understand, extend, or contribute to the codebase.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Layer Architecture](#layer-architecture)
3. [Data Flow](#data-flow)
4. [Key Classes](#key-classes)
5. [The Kernel](#the-kernel)
6. [Document Model](#document-model)
7. [Command System](#command-system)
8. [Feature Evaluation](#feature-evaluation)
9. [File Format](#file-format)

---

## System Overview

Ameri-CAD is a parametric CAD system with three distinct layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                          UI LAYER                               │
│  Three.js Viewport │ Feature Tree │ Command Line │ Panels      │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     APPLICATION LAYER                           │
│  AmericaD │ DocumentModel │ Evaluator │ History │ Selection    │
└────────────────────────────┬────────────────────────────────────┘
                             │ (async postMessage)
┌────────────────────────────▼────────────────────────────────────┐
│                       KERNEL LAYER                              │
│            Web Worker + OpenCASCADE.js (WASM)                   │
└─────────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Separation of Concerns** — UI knows nothing about geometry; kernel knows nothing about rendering
2. **Non-blocking Operations** — Heavy geometry operations run in a Web Worker
3. **Parametric History** — The document stores operations, not geometry
4. **Single Source of Truth** — DocumentModel is authoritative; everything else derives from it

---

## Layer Architecture

### UI Layer

**Files:** `app.js`, `index.html`, `src/ui/*`

Responsibilities:
- Three.js scene setup and rendering
- User input handling (mouse, keyboard)
- DOM manipulation (panels, buttons, command line)
- Visual feedback (selection highlighting, transform gizmo)

Key Components:
| Component | File | Purpose |
|-----------|------|---------|
| Viewport | `app.js` | Three.js renderer, camera, controls |
| Feature Tree | `src/ui/feature-tree.js` | Hierarchical feature display |
| Command Line | `src/ui/command-line.js` | Text command input |
| Sketch Renderer | `src/sketch/sketch-renderer.js` | 2D sketch visualization |

### Application Layer

**Files:** `src/main.js`, `src/state/*`, `src/core/*`

Responsibilities:
- Business logic and coordination
- Document state management
- Command execution and history
- Feature evaluation orchestration

Key Components:
| Component | File | Purpose |
|-----------|------|---------|
| AmericaD | `src/main.js` | Main application class |
| DocumentModel | `src/state/document.js` | Parametric feature DAG |
| Evaluator | `src/kernel/evaluator.js` | Feature → geometry conversion |
| History | `src/state/history.js` | Undo/redo command stack |
| Selection | `src/state/selection.js` | Selection state management |

### Kernel Layer

**Files:** `src/kernel/worker.js`, `src/kernel/bridge.js`

Responsibilities:
- B-Rep geometry operations (create, boolean, modify)
- Tessellation for display
- Export to STEP/STL
- Shape storage and management

Key Components:
| Component | File | Purpose |
|-----------|------|---------|
| KernelBridge | `src/kernel/bridge.js` | Main thread API |
| Worker | `src/kernel/worker.js` | OpenCASCADE operations |

---

## Data Flow

### Creating a Primitive

```
User clicks "Box"
       │
       ▼
   app.js: createPrimitive('box', {...})
       │
       ▼
   KernelBridge.createBox(w, h, d)
       │
       ├─── postMessage ───┐
       │                   ▼
       │            Worker: createBox()
       │                   │
       │            OpenCASCADE: BRepPrimAPI_MakeBox
       │                   │
       │            Worker: tessellate()
       │                   │
       │                   ▼
       │◄── postMessage ───┤
       │    {id, mesh}     │
       ▼
   meshToThreeGeometry(mesh)
       │
       ▼
   scene.add(mesh)
       │
       ▼
   DocumentModel.addFeature(BoxFeature)
       │
       ▼
   FeatureTree.render()
```

### Boolean Operation

```
User selects two bodies, types "subtract"
       │
       ▼
   app.js: executeCommand('subtract')
       │
       ▼
   AmericaD.booleanSubtract(targetId, toolId)
       │
       ├── Create BooleanFeature
       │   dependencies: [targetId, toolId]
       │
       ▼
   Evaluator.evaluateFeature(featureId)
       │
       ├── Get kernel IDs for dependencies
       │
       ▼
   KernelBridge.subtract(kernelId1, kernelId2)
       │
       ├─── postMessage ───┐
       │                   ▼
       │            Worker: booleanSubtract()
       │                   │
       │            OpenCASCADE: BRepAlgoAPI_Cut
       │                   │
       │◄── postMessage ───┤
       │
       ▼
   Update feature.kernelId
   Update mesh in scene
```

### Saving a Document

```
User presses Ctrl+S
       │
       ▼
   AmericaD.saveDocument(filename)
       │
       ▼
   serialize(documentModel)
       │
       ├── Get topological order of features
       │
       ├── For each feature:
       │   └── Extract id, type, params, dependencies
       │
       ▼
   JSON.stringify() → .americad file
```

### Loading a Document

```
User opens .americad file
       │
       ▼
   AmericaD.loadDocument(json)
       │
       ▼
   validate(data) → check format version
       │
       ▼
   deserialize(data)
       │
       ├── Sort features by dependencies
       │
       ├── Create Feature objects
       │
       ▼
   DocumentModel populated
       │
       ▼
   Evaluator.evaluateAll()
       │
       ├── For each feature in topo order:
       │   └── Call kernel to create geometry
       │
       ▼
   All meshes in scene
```

---

## Key Classes

### AmericaD (`src/main.js`)

The main application facade. Coordinates between all subsystems.

```javascript
class AmericaD {
  constructor(options)
  async init(THREE)                    // Initialize all subsystems
  setScene(scene, camera, ...)         // Wire up Three.js
  
  // Primitive creation
  async createBox(params)
  async createCylinder(params)
  async createSphere(params)
  async createCone(params)
  
  // Boolean operations
  async booleanUnion(targetId, toolId)
  async booleanSubtract(targetId, toolId)
  async booleanIntersect(targetId, toolId)
  
  // Feature management
  selectFeature(featureId)
  deleteFeature(featureId)
  updateFeature(featureId, params)
  
  // File operations
  saveDocument(filename)
  async loadDocument(json)
  async exportSTEP(featureIds)
  async exportSTL(featureId)
}
```

### DocumentModel (`src/state/document.js`)

The parametric feature tree. Stores the complete history of modeling operations.

```javascript
class DocumentModel {
  features: Map<string, Feature>       // All features by ID
  rootFeatures: string[]               // Features with no dependencies
  
  addFeature(feature)                  // Add to DAG
  removeFeature(featureId)             // Remove + cascade to children
  updateFeature(featureId, params)     // Modify parameters
  
  getTopologicalOrder()                // Features in dependency order
  getDependents(featureId)             // Features that depend on this
  
  toJSON()                             // Serialize for save
  static fromJSON(json)                // Deserialize for load
}
```

### Feature Classes (`src/state/document.js`)

Base class and specialized feature types:

```javascript
class Feature {
  id: string                           // Unique identifier
  type: string                         // 'box', 'boolean_subtract', etc.
  params: object                       // Type-specific parameters
  dependencies: string[]               // IDs of parent features
  children: string[]                   // IDs of dependent features
  kernelId: string                     // Shape ID in kernel
  meshId: string                       // Three.js mesh UUID
  valid: boolean                       // Evaluation success
  visible: boolean
  name: string
}

class BoxFeature extends Feature {
  params: { width, height, depth, center }
}

class BooleanFeature extends Feature {
  operation: 'union' | 'subtract' | 'intersect'
  // dependencies[0] = target, dependencies[1] = tool
}

class FilletFeature extends Feature {
  params: { edgeIds, radius }
  // dependencies[0] = parent shape
}
```

### KernelBridge (`src/kernel/bridge.js`)

Main-thread interface to the geometry kernel.

```javascript
class KernelBridge {
  worker: Worker
  pending: Map<number, Promise>
  
  async init()                         // Load WASM, start worker
  
  // Primitives
  async createBox(w, h, d, center)
  async createCylinder(r, h, center)
  async createSphere(r, center)
  async createCone(r1, r2, h, center)
  async createTorus(R, r, center)
  async createWedge(dx, dy, dz, ltx)
  
  // Booleans
  async union(id1, id2)
  async subtract(id1, id2)
  async intersect(id1, id2)
  
  // Features
  async fillet(shapeId, edgeIds, radius)
  async chamfer(shapeId, edgeIds, distance)
  async extrude(profileId, direction, distance)
  async revolve(profileId, axis, angle)
  async shell(shapeId, faceIds, thickness)
  async loft(profileIds, solid)
  async sweep(profileId, pathId)
  
  // Export
  async exportSTEP(id)
  async exportSTEPMultiple(ids)
  async exportSTL(id)
  
  // Analysis
  async getVolume(id)
  async getBoundingBox(id)
  
  // Management
  async deleteShape(id)
}
```

### Evaluator (`src/kernel/evaluator.js`)

Converts features to geometry via the kernel.

```javascript
class Evaluator {
  document: DocumentModel
  scene: THREE.Scene
  meshes: Map<string, THREE.Mesh>
  
  async evaluateFeature(featureId)     // Single feature
  async evaluateAll()                  // All features in order
  async reEvaluateFromFeature(id)      // Feature + all dependents
  
  getMesh(featureId)
  setVisibility(featureId, visible)
  highlight(featureId, on)
  
  async exportSTEP(featureId)
  async exportSTL(featureId)
}
```

---

## The Kernel

### Why a Web Worker?

OpenCASCADE operations can take 100ms+ for complex booleans. Running in a Worker:
- Keeps the UI responsive
- Allows progress reporting
- Prevents browser "not responding" warnings

### Worker Protocol

Communication uses structured messages:

```javascript
// Main → Worker
{
  id: 42,                    // Request ID for response matching
  action: 'createBox',       // Operation name
  params: {                  // Operation parameters
    width: 20,
    height: 10,
    depth: 30,
    center: {x: 0, y: 0, z: 0}
  }
}

// Worker → Main
{
  id: 42,                    // Matching request ID
  success: true,
  result: {
    id: 'topo_17',           // Kernel shape ID
    mesh: {                  // Tessellated mesh
      vertices: Float32Array,
      normals: Float32Array,
      indices: Uint32Array,
      faceIds: string[]
    },
    params: {...}
  }
}
```

### Shape Storage

The worker maintains a `Map<string, TopoDS_Shape>` of all shapes:

```javascript
const shapes = new Map();

// After createBox():
shapes.set('topo_17', boxShape);

// Boolean uses stored shapes:
const result = booleanSubtract(
  shapes.get('topo_17'),   // target
  shapes.get('topo_23')    // tool
);
shapes.set('topo_42', result);
```

### Tessellation

B-Rep geometry must be tessellated (converted to triangles) for Three.js display:

```javascript
function tessellate(shape, linearDeflection = 0.1) {
  // Create mesh
  new oc.BRepMesh_IncrementalMesh_2(shape, linearDeflection, ...);
  
  // Extract triangles from each face
  const explorer = new oc.TopExp_Explorer_2(shape, TopAbs_FACE, ...);
  while (explorer.More()) {
    const face = oc.TopoDS.Face_1(explorer.Current());
    const triangulation = oc.BRep_Tool.Triangulation(face, ...);
    
    // Extract vertices, normals, indices
    // Track face IDs for selection
  }
  
  return { vertices, normals, indices, faceIds };
}
```

---

## Document Model

### Feature DAG (Directed Acyclic Graph)

Features form a dependency graph:

```
     ┌─────────┐
     │  Box_1  │
     └────┬────┘
          │
          ▼
   ┌──────────────┐      ┌─────────┐
   │  Fillet_2    │◄─────│ Cyl_3   │
   └──────┬───────┘      └────┬────┘
          │                   │
          ▼                   │
     ┌────────────────────────┘
     │
     ▼
┌─────────────┐
│   Cut_4     │
└─────────────┘
```

- **Dependencies** point upward (child → parent)
- **Children** point downward (parent → child)
- **Roots** have no dependencies
- **Leaves** have no children

### Topological Sort

Features must be evaluated in dependency order:

```javascript
getTopologicalOrder() {
  const visited = new Set();
  const order = [];
  
  function visit(id) {
    if (visited.has(id)) return;
    
    const feature = this.features.get(id);
    
    // Visit dependencies first
    for (const depId of feature.dependencies) {
      visit(depId);
    }
    
    visited.add(id);
    order.push(id);
  }
  
  for (const id of this.features.keys()) {
    visit(id);
  }
  
  return order;  // [Box_1, Cyl_3, Fillet_2, Cut_4]
}
```

### Cascade Deletion

Deleting a feature removes all its descendants:

```javascript
removeFeature(featureId) {
  const feature = this.features.get(featureId);
  
  // Recursively remove children first
  for (const childId of [...feature.children]) {
    this.removeFeature(childId);
  }
  
  // Remove from parent's children list
  for (const depId of feature.dependencies) {
    const parent = this.features.get(depId);
    parent.children = parent.children.filter(id => id !== featureId);
  }
  
  this.features.delete(featureId);
}
```

---

## Command System

### Command Pattern

All editing operations are encapsulated as commands:

```javascript
class CreatePrimitiveCommand {
  constructor(scene, objects, mesh)
  
  execute() {
    scene.add(this.mesh);
    objects.push(this.mesh);
  }
  
  undo() {
    scene.remove(this.mesh);
    objects.splice(objects.indexOf(this.mesh), 1);
  }
}

class TransformCommand {
  constructor(object, startMatrix, endMatrix)
  
  execute() {
    object.matrix.copy(this.endMatrix);
  }
  
  undo() {
    object.matrix.copy(this.startMatrix);
  }
}
```

### Command Manager

Maintains undo/redo stacks:

```javascript
class CommandManager {
  undoStack: Command[]
  redoStack: Command[]
  
  execute(cmd) {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack = [];  // Clear redo after new action
  }
  
  undo() {
    const cmd = this.undoStack.pop();
    cmd.undo();
    this.redoStack.push(cmd);
  }
  
  redo() {
    const cmd = this.redoStack.pop();
    cmd.execute();
    this.undoStack.push(cmd);
  }
}
```

### Command Registration

Commands are registered for CLI access:

```javascript
registerCommand('box', {
  aliases: ['cube', 'block'],
  params: [
    { name: 'width', type: 'number', required: true },
    { name: 'height', type: 'number', default: null },
    { name: 'depth', type: 'number', default: null }
  ],
  async execute(params, context) {
    return await context.kernel.createBox(...);
  }
});
```

---

## Feature Evaluation

### Evaluation Process

When a feature needs geometry:

```javascript
async evaluateFeature(featureId) {
  const feature = this.document.getFeature(featureId);
  
  switch (feature.type) {
    case 'box':
      return this.evaluateBox(feature);
    case 'boolean_subtract':
      return this.evaluateBoolean(feature, 'subtract');
    case 'fillet':
      return this.evaluateFillet(feature);
    // ...
  }
}

async evaluateBox(feature) {
  const { width, height, depth, center } = feature.params;
  
  // Create geometry via kernel
  const result = await kernel.createBox(width, height, depth, center);
  
  // Store kernel ID for future reference
  feature.kernelId = result.id;
  
  // Create Three.js mesh
  const geometry = meshToThreeGeometry(result.mesh, THREE);
  const mesh = new THREE.Mesh(geometry, material);
  
  // Add to scene and tracking
  this.scene.add(mesh);
  this.meshes.set(feature.id, mesh);
  
  return result;
}
```

### Re-evaluation

When a feature changes, dependents must update:

```javascript
async reEvaluateFromFeature(featureId) {
  // Get all features that depend on this one
  const dependents = this.document.getDependents(featureId);
  
  // Include the changed feature itself
  const toEvaluate = [featureId, ...dependents];
  
  // Sort in dependency order
  const order = this.document.getTopologicalOrder();
  toEvaluate.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  
  // Re-evaluate each
  for (const id of toEvaluate) {
    await this.evaluateFeature(id);
  }
}
```

---

## File Format

### Structure

The `.americad` format is JSON:

```json
{
  "version": "1.0",
  "name": "My Design",
  "created": "2024-01-15T10:30:00.000Z",
  "modified": "2024-01-15T11:45:00.000Z",
  "features": [
    {
      "id": "feature_1",
      "type": "box",
      "params": {
        "width": 20,
        "height": 20,
        "depth": 20,
        "center": {"x": 0, "y": 10, "z": 0}
      },
      "dependencies": [],
      "name": "BODY_001",
      "visible": true
    },
    {
      "id": "feature_2",
      "type": "cylinder",
      "params": {
        "radius": 5,
        "height": 30,
        "center": {"x": 0, "y": 0, "z": 0}
      },
      "dependencies": [],
      "name": "BODY_002",
      "visible": false
    },
    {
      "id": "feature_3",
      "type": "boolean_subtract",
      "params": {},
      "dependencies": ["feature_1", "feature_2"],
      "name": "Cut_003",
      "visible": true
    }
  ]
}
```

### Key Points

1. **Features in dependency order** — A feature never appears before its dependencies
2. **No geometry stored** — Regenerated on load via kernel
3. **Human-readable** — Can be hand-edited if needed
4. **Forward compatible** — Version field allows migration

### Serialization

```javascript
export function serialize(documentModel, options) {
  const orderedIds = documentModel.getTopologicalOrder();
  
  return JSON.stringify({
    version: FILE_FORMAT_VERSION,
    name: documentModel.name,
    created: documentModel.createdAt,
    modified: new Date().toISOString(),
    features: orderedIds.map(id => serializeFeature(
      documentModel.getFeature(id)
    ))
  }, null, 2);
}
```

### Deserialization

```javascript
export function deserialize(json) {
  const data = JSON.parse(json);
  const doc = new DocumentModel();
  
  // Sort by dependencies (should already be sorted, but be safe)
  const sorted = sortByDependencies(data.features);
  
  for (const featureData of sorted) {
    const feature = deserializeFeature(featureData);
    doc.features.set(feature.id, feature);
  }
  
  // Rebuild children relationships
  for (const feature of doc.features.values()) {
    for (const depId of feature.dependencies) {
      doc.features.get(depId).children.push(feature.id);
    }
  }
  
  return doc;
}
```

---

## Extension Points

### Adding a New Primitive

1. **Kernel Worker** (`src/kernel/worker.js`):
   ```javascript
   function createHexagon(radius, height, center) {
     // Use OpenCASCADE to create geometry
     const shape = new oc.BRepPrimAPI_MakePrism_1(...);
     return { shape, id: getTopoId(shape), type: 'hexagon' };
   }
   
   // Add to message handler
   case 'createHexagon':
     const hex = createHexagon(params.radius, params.height, params.center);
     shapes.set(hex.id, hex.shape);
     result = { id: hex.id, mesh: tessellate(hex.shape) };
     break;
   ```

2. **Kernel Bridge** (`src/kernel/bridge.js`):
   ```javascript
   async createHexagon(radius, height, center) {
     await this.init();
     return this._call('createHexagon', { radius, height, center });
   }
   ```

3. **Feature Class** (`src/state/document.js`):
   ```javascript
   export class HexagonFeature extends Feature {
     constructor(params) {
       super('hexagon', {
         radius: params.radius ?? 10,
         height: params.height ?? 20,
         center: params.center ?? { x: 0, y: 0, z: 0 },
         ...params
       });
     }
   }
   ```

4. **AmericaD API** (`src/main.js`):
   ```javascript
   async createHexagon(params = {}) {
     const feature = new HexagonFeature(params);
     this.document.addFeature(feature);
     await this.evaluator.evaluateFeature(feature.id);
     return feature;
   }
   ```

5. **Command Registration** (`src/commands/primitives.js`):
   ```javascript
   registerCommand('hexagon', {
     aliases: ['hex'],
     params: [
       { name: 'radius', type: 'number', required: true },
       { name: 'height', type: 'number', required: true }
     ],
     async execute(params, context) {
       return await context.americad.createHexagon(params);
     }
   });
   ```

### Adding a New Feature Operation

Follow the same pattern, but for the feature type (fillet, chamfer, etc.):

1. Implement in worker using appropriate OpenCASCADE API
2. Add bridge method
3. Create feature class with dependencies
4. Add AmericaD method
5. Register command

---

## Performance Considerations

### Kernel Operations

- Boolean operations are O(n×m) where n, m are face counts
- Fillet/chamfer complexity depends on edge count
- Tessellation time scales with surface area

### Memory Management

- Worker maintains shape references indefinitely
- Call `deleteShape(id)` to free kernel memory
- Three.js geometries should be disposed when features are deleted

### Optimization Tips

1. Batch multiple primitives before booleans
2. Use appropriate tessellation deflection
3. Limit feature tree depth when possible
4. Clean up deleted shapes promptly
