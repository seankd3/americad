# AmericaD Architecture Consolidation

## Status: PHASE 1-2 COMPLETE
Started: 2025-01-29

## Problem Summary
Two competing architectures:
- **app.js** (~2000+ lines): Monolithic, currently active, loaded by index.html
- **src/** (modular): Clean DocumentModel, Evaluator, Feature DAG - partially integrated

## Phase 1: Fix Kernel API Mismatches ✅ COMPLETE

### 1.1 Boolean Operations ✅
**Fixed**: Added `boolean(targetId, toolId, type)` dispatcher to bridge.js that routes to union/subtract/intersect.

### 1.2 Fillet Signature ✅
**Fixed**: Updated booleans.js command to extract shapeId from context and pass proper (shapeId, edgeIds, radius) to kernel.

### 1.3 Missing Kernel Methods ✅
Added to both worker.js and bridge.js:
- [x] `createTorus(params)`
- [x] `createWedge(params)`
- [x] `chamfer(shapeId, edgeIds, distance)`
- [x] `extrude(profileId, direction, distance)`
- [x] `revolve(profileId, axis, angle)`
- [x] `shell(shapeId, faceIds, thickness)`
- [x] `loft(profileIds)`
- [x] `sweep(profileId, pathId)`

### 1.4 deleteShape ✅
Verified implementation in worker.js. Added proper cleanup in evaluator.js.

---

## Phase 2: Fix Integration Bugs ✅ COMPLETE

### 2.1 CrashGuard API ✅
**Fixed**: Changed all `CrashGuard.log()` calls in main.js to `CrashGuard.recordCommand()` with proper type/data structure.

Also fixed initialization - CrashGuard doesn't have `onRecover` property. Changed to use `promptRecovery()` pattern.

### 2.2 Wire Deletion to Kernel ✅
**Fixed**: deleteFeature() in main.js now:
1. Gets kernelId from feature or evaluator
2. Calls kernel.deleteShape(kernelId) to free WASM memory
3. Handles errors gracefully

Also added `getKernelId(featureId)` method to evaluator.js.

---

## Phase 3: Integrate AmericaD Class ✅ COMPLETE

### Strategy Chosen: Integration over Replacement
Instead of replacing app.js, we integrated the modular architecture INTO it:
- app.js remains the entry point (handles UI/scene infrastructure)
- AmericaD class from src/main.js is initialized and wired to the scene
- DocumentModel tracks primitives created via legacy path

### 3.1 Import AmericaD ✅
Added import in app.js:
```javascript
import { AmericaD, app as americadApp } from './src/main.js';
```

### 3.2 Initialize in initKernelSystem ✅
AmericaD class now initializes alongside the existing system:
- Calls `americadApp.init(THREE)`
- Wires to scene via `setScene(scene, camera, renderer, controls, transformControl)`
- Stored in `System.americad` for access

### 3.3 Track External Features ✅
Added `trackExternalFeature()` to DocumentModel:
- When app.js creates a primitive via kernel, it registers with DocumentModel
- Maintains sync between legacy path and unified architecture
- Non-blocking - failures don't break primitive creation

### 3.4 Public API Access ✅
window.AmericaD now exposes:
- `app` - the AmericaD instance
- `document` - the DocumentModel
- `evaluator` - the geometry evaluator  
- `kernel` - direct kernel access

---

## Phase 4: Cleanup 🔮 FUTURE WORK

### Status: Deferred
The architecture is now unified. app.js is NOT deprecated - it serves as the UI/infrastructure layer. The "split personality" was actually a layered architecture all along:

```
┌─────────────────────────────────────────┐
│  index.html                              │
├─────────────────────────────────────────┤
│  app.js (UI Layer)                       │
│  - Three.js scene management             │
│  - DOM event handling                    │
│  - User interaction                      │
│  - Render loop                           │
├─────────────────────────────────────────┤
│  src/main.js (Application Layer)         │
│  - AmericaD class                        │
│  - Feature management                    │
│  - DocumentModel coordination            │
├─────────────────────────────────────────┤
│  src/kernel/ (Geometry Layer)            │
│  - KernelBridge                          │
│  - Web Worker with OpenCASCADE           │
│  - B-Rep operations                      │
└─────────────────────────────────────────┘
```

### 4.1 Recommended Future Work
- [ ] Migrate remaining direct kernel calls in app.js through AmericaD
- [ ] Update boolean operations in app.js to use AmericaD.booleanUnion/etc
- [ ] Wire feature tree UI to DocumentModel.features
- [ ] Consider splitting app.js into separate modules (scene.js, events.js, etc.)

### 4.2 Not Needed
- ❌ Archive app.js - it has a clear purpose as UI layer
- ❌ Delete code - nothing is truly redundant now that integration exists

---

## Findings & Notes

### API Fixes Made (Phase 1-2)
1. **bridge.js**: Added `boolean()` dispatcher, `chamfer()`, `extrude()`, `revolve()`, `shell()`, `loft()`, `sweep()`, `createTorus()`, `createWedge()`
2. **worker.js**: Added 8 new OCCT operation implementations
3. **booleans.js**: Fixed all command signatures to pass (shapeId, edgeIds, param)
4. **main.js**: Fixed CrashGuard API (log→recordCommand), fixed recovery init
5. **evaluator.js**: Added `getKernelId()` method
6. **document.js**: Added `trackExternalFeature()` for legacy integration

### Architecture Insight
The "split personality" was actually correct layered architecture:
- **app.js** = UI layer (scene, events, rendering)
- **src/main.js** = Application layer (AmericaD class, feature management)
- **src/kernel/** = Geometry layer (OpenCASCADE B-Rep)

The problem was incomplete integration between layers, not competing architectures.

### What Was Done
1. ✅ Fixed kernel API mismatches (boolean, fillet, etc.)
2. ✅ Added missing kernel operations (chamfer, extrude, revolve, shell, loft, sweep)
3. ✅ Fixed CrashGuard integration bugs
4. ✅ Wired feature deletion to kernel memory cleanup
5. ✅ Integrated AmericaD class into app.js initialization
6. ✅ Added DocumentModel tracking for legacy primitive creation
7. ✅ Exposed unified API through window.AmericaD

### Result
Both code paths now share the same DocumentModel and kernel. The architecture is unified. Future work is incremental improvement, not structural change.

---

## Commits Summary
1. `fix(kernel): Phase 1-2 API alignment and bug fixes`
2. `feat(arch): Phase 3 - Integrate AmericaD class into app.js`
