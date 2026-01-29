# Ameri-CAD Code Audit Report

**Audited:** 2025-01-29  
**Auditor:** Claude (via Codex)  
**Version:** 2.2.0-LA  
**Scope:** Full codebase review  

---

## Executive Summary

Ameri-CAD is an ambitious browser-based parametric CAD system with OpenCASCADE.js integration. The codebase demonstrates solid architectural thinking and follows professional CAD conventions. However, there are **several critical integration gaps** and **architectural inconsistencies** that prevent the modules from working together cohesively.

### Key Findings

| Priority | Count | Summary |
|----------|-------|---------|
| 🔴 Critical | 3 | Integration gaps that break core functionality |
| 🟠 High | 5 | Significant issues affecting reliability |
| 🟡 Medium | 8 | Code quality and maintainability concerns |
| 🟢 Low | 6 | Polish and optimization opportunities |

### Overall Assessment

**Architecture:** 7/10 - Good modular design, but modules don't fully integrate  
**Code Quality:** 7/10 - Well-documented, some dead code and inconsistencies  
**Kernel Integration:** 5/10 - Partial implementation, many gaps  
**Undo/Redo:** 6/10 - Pattern correct, but not wired to kernel operations  
**Test Coverage:** 4/10 - Tests exist but don't run against actual code  
**Performance:** 7/10 - Reasonable, some memory concerns  

---

## 1. Architecture Coherence

### Strengths ✅

1. **Clean separation of concerns**: The `src/` structure follows a logical pattern:
   - `core/` - Pure functions and utilities
   - `state/` - State management (document, history, selection)
   - `kernel/` - OpenCASCADE integration
   - `ui/` - UI components
   - `commands/` - Command definitions
   - `sketch/` - 2D sketch system

2. **Worker-based kernel**: OpenCASCADE runs in a Web Worker, preventing main thread blocking.

3. **Command pattern**: Commands are registered centrally and can be invoked via CLI or programmatically.

4. **Feature DAG model**: The document model correctly tracks feature dependencies for parametric regeneration.

### Issues 🔴

#### CRITICAL-1: Dual Document Systems

There are **two separate document systems** that don't communicate:

1. `src/state/document.js` - Full parametric DocumentModel with Feature DAG
2. `src/core/app-integration.js` - Simple Document class with `bodies` Map

**Problem:** The `app.js` and command system use the simple Document, while `main.js` uses the full DocumentModel. Features created via the command line never get proper feature tracking.

**Evidence:**
```javascript
// app-integration.js (line 34-47)
class Document {
    constructor() {
        this.bodies = new Map();  // Simple key-value store
        this.nextBodyNum = 1;
    }
}

// state/document.js (line 125-145)
export class DocumentModel {
    constructor() {
        this.features = new Map();  // Full feature graph
        this.rootFeatures = [];
        // ... proper DAG tracking
    }
}
```

**Fix:** Unify around `DocumentModel`, remove the simple Document class from app-integration.js.

#### CRITICAL-2: Evaluator Not Used in Main App

The `Evaluator` class in `kernel/evaluator.js` is beautifully designed but **never instantiated** in `app.js`. The app uses `app-integration.js` which has its own `addMeshToScene()` function that bypasses the evaluator.

**Evidence:**
```javascript
// app.js imports but never uses:
import { kernel, meshToThreeGeometry } from './src/kernel/bridge.js';
// Should import and use:
import { Evaluator } from './src/kernel/evaluator.js';
```

**Fix:** Refactor `app.js` to use the Evaluator pattern, which handles feature→kernel→mesh pipeline properly.

#### HIGH-1: Feature Tree UI Disconnected

`FeatureTreeUI` in `ui/feature-tree.js` binds to `document.onFeatureAdded` etc., but the actual app never triggers these because it uses the wrong Document class.

---

## 2. Code Quality

### Strengths ✅

1. **Excellent documentation**: JSDoc comments throughout
2. **Consistent naming**: camelCase functions, PascalCase classes
3. **Pure functions** in math/transforms modules
4. **Error handling** in kernel worker with graceful degradation

### Issues 🟠

#### HIGH-2: Dead Code - Transforms Commands Never Registered

`src/commands/transforms.js` defines `registerTransformCommands()` but it's **never called**.

**Evidence:**
```javascript
// app-integration.js line 81-85
function registerAllCommands() {
    registerPrimitiveCommands(wrappedKernel);
    registerBooleanCommands(wrappedKernel);
    registerGeneralCommands(appContext);
    // registerTransformCommands() - MISSING!
}
```

**Fix:** Add `import { registerTransformCommands } from '../commands/transforms.js'` and call it.

#### HIGH-3: Torus/Wedge Commands Reference Non-Existent Kernel Methods

The `primitives.js` registers `torus` and `wedge` commands that call `kernel.createTorus()` and `kernel.createWedge()`, but these methods don't exist in `bridge.js` or `worker.js`.

**Evidence:**
```javascript
// primitives.js line 111
const result = await kernel.createTorus(params.majorRadius, params.minorRadius, params.center);
// BUT bridge.js has no createTorus() method
```

**Fix:** Either implement the missing kernel methods or remove the command registrations.

#### MEDIUM-1: Inconsistent Async Patterns

Some commands return Promises, others return values synchronously, even when they claim to support async:

```javascript
// general.js - execute() is sync
execute(params) {
    return getHelp(params.command);  // sync return
}

// primitives.js - execute() is async
async execute(params, context) {
    const result = await kernel.createBox(...);  // async
}
```

Commands should consistently use async/await or the command system should normalize this.

#### MEDIUM-2: Duplicate generateId Functions

Three separate ID generators:
1. `src/core/math.js:generateId()` - Uses Math.random().toString(36)
2. `src/state/document.js:generateId()` - Uses incrementing counter
3. `src/sketch/sketch-manager.js:generateSketchId()` - Uses counter with prefix

**Fix:** Consolidate into a single ID generation strategy.

#### MEDIUM-3: Mixed Module Types

`package.json` has `"type": "commonjs"` but all source files use ES modules (`import`/`export`). This works in browsers but causes issues with tooling.

---

## 3. OpenCASCADE Integration

### Strengths ✅

1. **Correct Worker Architecture**: Heavy WASM work happens off main thread
2. **Transferable Arrays**: Mesh data uses proper buffer transfer
3. **Topology ID Mapping**: `topoIdMap` tracks stable IDs across operations
4. **Tessellation Pipeline**: Proper B-Rep to triangle mesh conversion

### Issues 🔴

#### CRITICAL-3: Kernel Mesh Normals Are Placeholder

The `tessellate()` function in `worker.js` has this comment:

```javascript
// Simplified - compute from face normal
// In production, use proper per-vertex normals
normals.push(0, 1, 0); // Placeholder ← WRONG!
```

All normals are set to `(0, 1, 0)` which causes incorrect lighting. The `meshToThreeGeometry()` calls `geometry.computeVertexNormals()` which helps, but doesn't give proper smooth/hard edge control.

**Fix:** Implement proper normal extraction from OpenCASCADE:
```javascript
// Get normals from triangulation properly
const normalArray = triangulation.get().Normals();
// Or compute from face orientation
```

#### HIGH-4: Missing Boolean Methods on Wrapped Kernel

The `createWrappedKernel()` in `app-integration.js` only wraps primitive creation methods. Boolean operations are defined in `commands/booleans.js` but call `kernel.boolean()` which doesn't exist - the bridge has `union()`, `subtract()`, `intersect()`.

**Evidence:**
```javascript
// booleans.js line 32
result = await kernel.boolean(result, shapes[i], 'union');  // WRONG

// bridge.js has:
async union(id1, id2) { ... }
async subtract(id1, id2) { ... }
// No generic boolean() method
```

#### HIGH-5: Kernel Shape Cleanup Not Automated

Shapes are stored in the worker's `shapes` Map but only cleaned up via explicit `deleteShape()` calls. If operations fail or meshes are deleted from the scene, kernel memory leaks.

**Fix:** Implement automatic cleanup when features are removed from the document.

#### MEDIUM-4: Missing STEP/STL Import

Only export is implemented. `general.js` has an `import` command that references `kernel.import()` and `kernel.importUrl()` - neither exists.

---

## 4. Command Pattern / Undo-Redo

### Strengths ✅

1. **Correct Command Pattern**: `Command` base class with `execute()`/`undo()`
2. **Matrix Serialization**: Transform commands properly serialize matrices
3. **History Limits**: Enforces max 50 commands
4. **State Change Callbacks**: UI can react to history changes

### Issues 🟠

#### HIGH-6: Kernel Operations Not Undoable

The `CommandManager` only tracks Three.js scene operations. Kernel operations (which are the actual B-Rep modifications) are **not recorded**.

**Evidence:**
```javascript
// CreatePrimitiveCommand in history.js
undo() {
    this.scene.remove(this.mesh);  // Only removes visual mesh
    // Kernel shape persists! kernel.deleteShape() never called
}
```

**Fix:** Each kernel operation needs a corresponding undo that:
1. Removes mesh from scene
2. Calls `kernel.deleteShape()` to free B-Rep
3. Updates the Document model

#### MEDIUM-5: Command System Separate from History

Two parallel systems:
1. `src/core/commands.js` - Command registry and execution
2. `src/state/history.js` - Undo/redo with Command pattern

These don't integrate. Executing a command via `commands.execute()` doesn't create a history entry.

**Evidence:**
```javascript
// commands.js execute() - records to commandHistory (a plain array)
commandHistory.push({
    command: cmd.name,
    params,
    timestamp: Date.now(),
    result
});

// But commandManager.execute() is the undo/redo system - separate!
```

**Fix:** Commands should optionally create undoable `Command` objects and push to `CommandManager`.

---

## 5. Test Coverage

### Current State

Tests exist in `/tests/` but have **major issues**:

1. **No test runner configured**: `package.json` has `"test": "echo \"Error: no test specified\""`
2. **Tests use undefined globals**: `THREE`, `GeometryUtils`, `expect`, `describe` are assumed to exist
3. **No imports**: Tests don't import the actual modules they're testing
4. **Tests run against Three.js, not actual code**: `primitives.test.js` tests `THREE.BoxGeometry`, not the kernel primitives

### Missing Test Coverage

| Module | Tests Exist | Actually Tested |
|--------|-------------|-----------------|
| math.js | ❌ | - |
| transforms.js | ❌ | - |
| commands.js | ❌ | - |
| document.js | ❌ | - |
| history.js | Partial | Three.js only |
| kernel/worker.js | ❌ | - |
| kernel/bridge.js | ❌ | - |
| constraint-solver.js | ❌ | - |
| sketch-manager.js | ❌ | - |

### Recommendations

1. **Add Vitest or Jest**: Modern test runners with ESM support
2. **Create golden files**: Already have structure in `tests/golden/`
3. **Integration tests**: Test kernel→mesh→scene pipeline
4. **Constraint solver tests**: The solver is untested

---

## 6. Performance Concerns

### Potential Bottlenecks

#### MEDIUM-6: Re-tessellation on Every Change

When a parameter changes, `Evaluator.reEvaluateFromFeature()` re-evaluates and re-tessellates all dependent features. For complex models, this could be slow.

**Mitigation:** This is correct parametric behavior. Consider caching tessellations.

#### MEDIUM-7: Large Shape Map in Worker

The `shapes` Map in `worker.js` never shrinks. Long sessions with many create/delete cycles will accumulate memory.

```javascript
// worker.js
const shapes = new Map(); // Grows forever if deleteShape() not called
```

#### MEDIUM-8: Sketch Renderer Creates New Materials Per Entity

In `sketch-renderer.js`:
```javascript
renderLine(line, sketch) {
    const material = isSelected ? this.materials.selected :
                    line.construction ? this.materials.construction :
                    this.materials.line;
    // Good - reuses materials
}

renderPoint(point, sketch) {
    const material = isSelected ? 
        new THREE.PointsMaterial({ ... }) :  // BAD - creates new
        this.materials.point;
}
```

**Fix:** Pre-create selected point material like others.

#### LOW-1: Feature Tree Re-renders Entire Tree

`FeatureTreeUI.render()` uses `innerHTML` to replace entire tree on any change. For large feature trees, this causes layout thrashing.

**Fix:** Use incremental DOM updates or virtual DOM.

---

## 7. File-by-File Notes

### `/src/core/`

| File | Status | Notes |
|------|--------|-------|
| math.js | ✅ Good | Clean pure functions |
| transforms.js | ✅ Good | Well-documented utilities |
| commands.js | ⚠️ Medium | Good system, needs history integration |
| app-integration.js | 🔴 Critical | Wrong Document class, bypasses Evaluator |

### `/src/state/`

| File | Status | Notes |
|------|--------|-------|
| document.js | ✅ Good | Proper feature DAG implementation |
| history.js | ⚠️ Medium | Pattern correct, not wired to kernel |
| selection.js | ✅ Good | Clean selection management |

### `/src/kernel/`

| File | Status | Notes |
|------|--------|-------|
| worker.js | ⚠️ Medium | Works but normals broken |
| bridge.js | ✅ Good | Clean async API |
| evaluator.js | ✅ Good | Well-designed, but unused |

### `/src/commands/`

| File | Status | Notes |
|------|--------|-------|
| primitives.js | ⚠️ Medium | Torus/Wedge don't work |
| transforms.js | 🔴 Dead | Never registered |
| booleans.js | 🔴 Broken | Wrong kernel method names |
| general.js | ⚠️ Medium | Import doesn't work |

### `/src/sketch/`

| File | Status | Notes |
|------|--------|-------|
| sketch-manager.js | ✅ Good | Full sketch implementation |
| sketch-renderer.js | ✅ Good | Clean Three.js rendering |
| constraint-solver.js | ⚠️ Medium | Untested, uses relaxation |

### `/src/ui/`

| File | Status | Notes |
|------|--------|-------|
| feature-tree.js | ⚠️ Medium | Disconnected from app |
| command-line.js | ✅ Good | Nice autocomplete |

### Root Files

| File | Status | Notes |
|------|--------|-------|
| app.js | ⚠️ Medium | Monolithic, needs refactoring |
| main.js | ⚠️ Medium | Duplicate of app.js patterns |
| crash-guard.js | ✅ Good | Solid recovery system |

---

## 8. Recommended Next Steps

### Immediate (Before Next Feature)

1. **🔴 Unify Document systems** - Use DocumentModel everywhere
2. **🔴 Wire up Evaluator** - Replace addMeshToScene in app-integration
3. **🔴 Fix kernel normals** - Implement proper normal extraction
4. **🟠 Register transform commands** - Add missing import/call
5. **🟠 Fix boolean commands** - Use correct kernel method names

### Short Term (1-2 weeks)

6. **🟠 Integrate history with kernel** - Add deleteShape() to undo
7. **🟠 Remove dead code** - Torus/Wedge commands, or implement them
8. **🟡 Set up test runner** - Vitest with browser-like environment
9. **🟡 Add kernel unit tests** - Test B-Rep operations

### Medium Term (1 month)

10. **🟡 Consolidate ID generators** - Single UUID strategy
11. **🟡 Add STEP import** - Complete file I/O
12. **🟡 Constraint solver tests** - Verify solver correctness
13. **🟢 Performance audit** - Memory profiling for long sessions

### Long Term

14. **🟢 Virtual DOM for feature tree** - Incremental updates
15. **🟢 WebGPU renderer option** - Future-proofing
16. **🟢 Collaborative editing** - CRDT-based document sync

---

## Appendix: Quick Fixes

### Fix CRITICAL-1: Unify Documents

```javascript
// In app-integration.js, replace Document class with:
import { DocumentModel } from '../state/document.js';

const appContext = {
    document: new DocumentModel(),
    // ...
};
```

### Fix HIGH-4: Boolean Commands

```javascript
// In booleans.js, change:
result = await kernel.boolean(result, shapes[i], 'union');
// To:
result = await kernel.union(result, shapes[i]);
```

### Fix HIGH-2: Register Transform Commands

```javascript
// In app-integration.js, add:
import { registerTransformCommands } from '../commands/transforms.js';

function registerAllCommands() {
    registerPrimitiveCommands(wrappedKernel);
    registerBooleanCommands(wrappedKernel);
    registerTransformCommands(wrappedKernel);  // ADD THIS
    registerGeneralCommands(appContext);
}
```

---

*End of Audit Report*
