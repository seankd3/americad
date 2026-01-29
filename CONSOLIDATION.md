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

## Phase 4: Cleanup ⏸️ PENDING PHASE 3

### 4.1 Migrate Needed Code
After Phase 3, identify any unique app.js code worth preserving.

### 4.2 Archive app.js
Only after full integration is verified working.

---

## Findings & Notes

### API Fixes Made
1. **bridge.js**: Added boolean() dispatcher method
2. **booleans.js**: Fixed all command signatures (fillet, chamfer, extrude, revolve, shell, loft)
3. **worker.js**: Added 8 new operation implementations (chamfer, torus, wedge, extrude, revolve, shell, loft, sweep)
4. **main.js**: Fixed all CrashGuard.log → recordCommand, fixed recovery initialization
5. **evaluator.js**: Added getKernelId() method

### Architecture Insight
The "split personality" is actually a layered architecture:
- app.js = UI layer
- src/main.js = Application layer (AmericaD class)
- src/kernel/ = Geometry layer

The problem isn't two architectures, it's incomplete integration. app.js should delegate CAD operations to AmericaD class.

### Recommended Next Steps
1. Modify app.js to instantiate AmericaD from src/main.js
2. Route createPrimitive, booleans, etc. through AmericaD class
3. Update app-integration.js to use proper DocumentModel
4. Test full pipeline: Command → AmericaD → DocumentModel → Evaluator → Kernel
