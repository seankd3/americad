# Ameri-CAD QA Audit Report

**Date:** January 29, 2025  
**Auditor:** QA Subagent  
**Codebase:** ~/Projects/americad

---

## Executive Summary

Ameri-CAD is a well-architected parametric CAD system with solid foundational components. However, there are several **architectural inconsistencies**, **incomplete integrations**, and **testing gaps** that need attention before the system can be considered production-ready.

**Overall Health Score: 7/10** (Good foundation, integration work needed)

---

## Critical Issues (P0)

### 1. Dual Document Model Architecture Conflict

**Files:** `src/state/document.js`, `src/core/app-integration.js`

**Problem:** Two competing document management systems exist:

- `DocumentModel` (feature-tree based, in `state/document.js`) - used by `main.js`
- `Document` (body-based, in `app-integration.js`) - used by command system

**Impact:** Commands call `context.document.addBody()` but when used via `main.js`, the DocumentModel doesn't have `addBody()` method - it has `addFeature()`. This API mismatch will cause runtime errors when CLI commands are used with the main app.

**Location:**

```
src/commands/primitives.js:45  - context.document.addBody(...)
src/commands/transforms.js:*   - context.document.addBody(...)
src/commands/sweep.js:*        - context.document.addBody(...)
```

**Recommendation:**

- Unify to a single document model
- Either add `addBody()` as an alias to `DocumentModel.addFeature()`
- Or refactor commands to use the feature-based API consistently

---

### 2. Evaluator Missing Feature Type Handlers

**File:** `src/kernel/evaluator.js`

**Problem:** The `evaluateFeature()` method has a switch statement for feature types, but several important types are missing:

- `extrude` - ExtrudeFeature exists in document.js but not handled in evaluator
- `sweep` - SweepFeature exists but not handled
- `sketch` - SketchFeature exists but not handled
- `transform` - TransformFeature exists but not handled

**Impact:** Creating these features via the document model will result in:

```javascript
console.warn(`[Evaluator] Unknown feature type: extrude`);
return null;
```

**Recommendation:** Add cases for all defined feature types:

```javascript
case 'extrude':
    const sketchId = this.kernelIds.get(feature.dependencies[0]);
    result = await kernel.extrudeSketchProfile(...);
    break;
// etc.
```

---

## High Priority Issues (P1)

### 3. Crash Recovery Not Implemented

**File:** `src/main.js:544`

```javascript
recoverFromCrash(data) {
    console.log('[Ameri-CAD] Recovering from crash:', data);
    // TODO: Replay commands from crash log
}
```

**Impact:** CrashGuard records commands but recovery never replays them. Users lose work after crashes.

**Recommendation:** Implement command replay from the crash log, similar to undo/redo:

```javascript
async recoverFromCrash(data) {
    for (const cmd of data.commands) {
        await this[cmd.type](cmd.params);
    }
}
```

---

### 4. Normal Calculation Fallback in Kernel

**File:** `src/kernel/worker.js:62`

```javascript
// TODO: Use BRepGProp_Face for proper surface normals
nx = 0;
ny = 0;
nz = 1; // Hard-coded fallback!
```

**Impact:** When tessellation doesn't provide normals, all faces render with z-up normals, causing incorrect lighting on angled faces.

**Recommendation:** Implement proper normal calculation from face surface or use `BRepGProp_Face::Normal()`.

---

### 5. Test Runner Only Validates Syntax

**File:** `tests/run-tests.mjs`

**Problem:** The test runner counts `describe()`/`it()` patterns but never actually executes tests. It even admits this:

```javascript
// Since tests use browser APIs (Three.js, OpenCASCADE),
// we can't run them directly in Node.js without mocking.
// This runner validates test file syntax and structure.
```

**Impact:**

- 570 tests exist but 0 are actually verified
- Tests could be completely broken and CI would pass
- No protection against regressions

**Recommendation:**

1. Set up Playwright or Puppeteer for browser-based test execution
2. Add proper mocking for kernel operations
3. Create a minimal test harness that can run core logic without OpenCASCADE

---

## Medium Priority Issues (P2)

### 6. ESM/CommonJS Configuration Mismatch

**File:** `package.json`

```json
"type": "commonjs"
```

**Problem:** Package declares CommonJS but all source files use ESM (`import`/`export`). The test runner flags syntax errors on every file with `import`:

```
⚠️ Potential syntax issue: Unexpected identifier 'from'
```

**Recommendation:** Change to `"type": "module"` or add `.mjs` extensions consistently.

---

### 7. Console.log Statements in Production Code

**Count:** 50+ instances across source files

**Key Locations:**

- `src/kernel/worker.js` - 4 instances
- `src/kernel/bridge.js` - 1 instance
- `src/kernel/evaluator.js` - 4 instances
- `src/main.js` - 15+ instances
- `src/ui/*.js` - 10+ instances

**Recommendation:**

- Replace with a proper logging utility
- Use debug levels (verbose/info/warn/error)
- Disable debug logs in production builds

---

### 8. holes.test.js Uses Non-Standard Test Framework

**File:** `tests/holes.test.js`

**Problem:** Uses a custom test framework instead of Mocha/Chai like other tests:

```javascript
// Custom assert and runTest functions
function assert(condition, message) { ... }
async function runTest(name, testFn) { ... }
```

**Impact:** Test runner detects "0 suites, 0 tests" because it looks for `describe()`/`it()`.

**Recommendation:** Convert to standard Mocha/Chai format for consistency.

---

### 9. Missing Import in document.js File Format Handler

**File:** `src/io/file-format.js`

The `deserializeFeature()` function references `SketchFeature` and `ExtrudeFeature` but these aren't imported:

```javascript
import {
  DocumentModel,
  Feature,
  BoxFeature,
  CylinderFeature,
  SphereFeature,
  ConeFeature,
  BooleanFeature,
  FilletFeature,
  ChamferFeature,
  TransformFeature,
} from '../state/document.js';
// Missing: SketchFeature, ExtrudeFeature, SweepFeature
```

**Impact:** Loading files with sketch/extrude features will create generic `Feature` instances instead of proper typed features.

---

## Low Priority Issues (P3)

### 10. Feature Type Inconsistency

**Files:** `src/state/document.js`, `src/kernel/evaluator.js`

Document uses: `boolean_union`, `boolean_subtract`, `boolean_intersect`  
Some commands use: `union`, `subtract`, `intersect`

This inconsistency could cause issues when saving/loading documents.

---

### 11. Unused trackExternalFeature Pattern

**File:** `src/state/document.js:279-304`

The `trackExternalFeature()` and `untrackExternalFeature()` methods exist but are only used in one place. This suggests incomplete migration to the unified architecture.

---

### 12. Hardcoded Measure Tool Keyboard Shortcut

**File:** `src/main.js`

Measure tool is bound to 'M' key without configuration. Should be part of a configurable keybindings system.

---

## Test Quality Assessment

### Test Coverage Summary

| Test File                 | Tests   | Status                     |
| ------------------------- | ------- | -------------------------- |
| math.test.js              | 41      | ✅ Syntax OK (ESM flagged) |
| primitives.test.js        | 25      | ✅ Well-structured         |
| history.test.js           | 38      | ✅ Good coverage           |
| boolean.test.js           | 40      | ✅ Comprehensive           |
| extrude.test.js           | 49      | ✅ Good coverage           |
| file-io.test.js           | 61      | ✅ Comprehensive           |
| holes.test.js             | 0\*     | ⚠️ Custom framework        |
| kernel-primitives.test.js | 47      | ✅ Golden file tests       |
| sketch-entities.test.js   | 63      | ✅ Good coverage           |
| modal-transform.test.js   | 50      | ✅ Syntax OK               |
| viewport-\*.test.js       | 68      | ✅ Syntax OK               |
| **Total**                 | **570** | **Need execution**         |

### Tests That Would Never Fail

None found - tests appear to make proper assertions.

### Edge Cases Missing

1. **Boolean operations** - No tests for coplanar faces edge case
2. **Fillet/Chamfer** - No tests for radius larger than edge length
3. **File I/O** - No tests for corrupted file recovery
4. **Undo/Redo** - No tests for redo after save

---

## Feature Completeness Matrix

| Feature           | Implementation | Commands | UI Wired   | Tests | Docs |
| ----------------- | -------------- | -------- | ---------- | ----- | ---- |
| Box               | ✅             | ✅       | ✅         | ✅    | ✅   |
| Cylinder          | ✅             | ✅       | ✅         | ✅    | ✅   |
| Sphere            | ✅             | ✅       | ✅         | ✅    | ✅   |
| Cone              | ✅             | ✅       | ✅         | ✅    | ✅   |
| Torus             | ✅             | ✅       | ⚠️ Partial | ⚠️    | ⚠️   |
| Boolean Union     | ✅             | ✅       | ✅         | ✅    | ✅   |
| Boolean Subtract  | ✅             | ✅       | ✅         | ✅    | ✅   |
| Boolean Intersect | ✅             | ✅       | ✅         | ✅    | ✅   |
| Fillet            | ✅             | ✅       | ⚠️         | ✅    | ⚠️   |
| Chamfer           | ✅             | ✅       | ⚠️         | ⚠️    | ⚠️   |
| Extrude           | ✅             | ✅       | ⚠️         | ✅    | ⚠️   |
| Sketch            | ⚠️ Partial     | ✅       | ⚠️         | ✅    | ⚠️   |
| Sweep             | ✅             | ✅       | ❌         | ⚠️    | ⚠️   |
| Hole Wizard       | ✅             | ✅       | ❌         | ✅\*  | ⚠️   |
| Linear Pattern    | ✅             | ✅       | ❌         | ❌    | ⚠️   |
| Circular Pattern  | ✅             | ✅       | ❌         | ❌    | ⚠️   |
| Mirror            | ✅             | ✅       | ❌         | ❌    | ⚠️   |
| STEP Export       | ✅             | ✅       | ✅         | ⚠️    | ✅   |
| STL Export        | ✅             | ✅       | ✅         | ⚠️    | ✅   |
| Save/Load         | ✅             | ✅       | ✅         | ✅    | ✅   |
| Undo/Redo         | ✅             | ✅       | ✅         | ✅    | ✅   |
| Measure Tool      | ✅             | ✅       | ✅         | ⚠️    | ⚠️   |

Legend: ✅ Complete | ⚠️ Partial | ❌ Missing

---

## Critical Path Testing (Manual Trace)

### 1. Create Box → Fillet → Export STEP

**Status:** ⚠️ Partially Working

- ✅ `createBox()` in main.js → kernel.createBox() → tessellate() → mesh
- ⚠️ Fillet requires edge IDs - not exposed in UI, only via command line
- ✅ `exportSTEP()` works when kernel ID exists

**Gap:** No UI for selecting edges for fillet.

### 2. Sketch → Extrude → Boolean Subtract

**Status:** ❌ Broken Path

- ⚠️ Sketch creation works but sketch-to-extrude evaluator path missing
- ❌ `ExtrudeFeature` case not in evaluator.js switch statement
- ⚠️ Boolean would work if extrude produced geometry

**Gap:** Evaluator needs to handle 'extrude' feature type.

### 3. Save → Load → Verify Intact

**Status:** ✅ Working

- ✅ `serialize()` produces valid JSON
- ✅ `validate()` checks structure
- ✅ `deserialize()` rebuilds document
- ✅ Feature tree re-renders
- ⚠️ Missing imports for SketchFeature, ExtrudeFeature could cause data loss

### 4. Undo → Redo → Verify State

**Status:** ✅ Working

- ✅ CommandManager properly maintains undo/redo stacks
- ✅ TransformCommand serializes/deserializes matrix
- ✅ CreatePrimitiveCommand restores mesh to scene
- ✅ Named undo shows descriptive action names

---

## Recommendations Summary

### Immediate (This Sprint)

1. ⚠️ Fix evaluator to handle all feature types (extrude, sweep, sketch, transform)
2. ⚠️ Unify document models or create compatibility layer
3. ⚠️ Add missing imports to file-format.js

### Short-term (Next Sprint)

4. Set up proper browser-based test execution
5. Implement crash recovery command replay
6. Fix normal calculation fallback in kernel

### Medium-term

7. Add proper logging utility with levels
8. Standardize all test files to Mocha/Chai
9. Add UI for edge selection (fillet/chamfer)
10. Change package.json to ESM mode

### Nice-to-have

11. Add configurable keybindings
12. Complete pattern features (linear/circular) UI
13. Add missing edge case tests

---

## Files Needing Immediate Attention

1. **`src/kernel/evaluator.js`** - Add missing feature type handlers
2. **`src/io/file-format.js`** - Add missing feature imports
3. **`src/core/app-integration.js`** - Reconcile with DocumentModel
4. **`src/main.js`** - Implement crash recovery
5. **`tests/run-tests.mjs`** - Set up actual test execution

---

_Report generated by automated QA audit. Manual verification recommended for critical paths._
