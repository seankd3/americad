# Ameri-CAD Browser Smoke Test Report

**Date:** 2026-01-29  
**Tester:** Automated via Clawdbot  
**Environment:** Browser (Chromium), Python http.server on port 8765  
**Kernel Version:** OpenCASCADE 7.0

---

## Summary

| Category | Status |
|----------|--------|
| Application Load | ✅ PASS |
| Kernel Initialization | ✅ PASS |
| Basic Primitives | ⚠️ PARTIAL |
| New Primitives (Torus, Wedge) | ✅ PASS |
| Boolean Operations | ❌ FAIL |
| Fillet/Chamfer | ⚠️ PARTIAL (filletAll/chamferAll added) |
| Undo | ✅ PASS |
| Redo | ❌ FAIL |

---

## What Works ✅

### Application Loading
- Splash screen displays, loading bar animates
- App initializes within ~2 seconds
- Shows "DOCUMENT MODEL READY" when fully loaded
- FPS stable at 60-61

### Kernel Initialization  
- OpenCASCADE WASM loads successfully
- Worker thread initializes properly
- Kernel reports "OCCT Version: 7.0"
- B-REP mode enabled

### Primitives - Working

| Primitive | Kernel (B-REP) | Fallback (THREE.js) | Notes |
|-----------|----------------|---------------------|-------|
| **Box** | ✅ Works | ✅ Works | Returns BufferGeometry |
| **Sphere** | ✅ Works | ✅ Works | Proper tessellation |
| **Cylinder** | ✅ Works | ✅ Works | |
| **Torus** | ✅ Works | N/A | New op - works! |
| **Wedge** | ✅ Works | N/A | New op - works! |

### UI/UX
- Viewport renders correctly with grid
- Transform gizmo (translate/rotate/scale) displays on selection
- Properties panel updates with selected object info
- Command input bar functional
- View orientation cube (TOP/FRONT/LEFT/BOTTOM labels) works

### Undo
- `AmericaD.undo()` correctly removes last created object
- Object count decreases (8 → 7)
- History tracks canUndo/canRedo states

---

## What Breaks ❌

### 1. Cone Primitive - KERNEL BUG
**Symptom:** Falls back to THREE.js geometry  
**Console Error:**
```
Tried to invoke ctor of BRepPrimAPI_MakeCone_4 with invalid number of parameters (4) - expected (5) parameters instead!
```
**Impact:** Cone creates via fallback, not B-REP kernel  
**Root Cause:** Parameter mismatch in OCCT binding - the cone constructor expects 5 params, worker sends 4

### 2. Boolean Operations - ALL FAIL
**Symptom:** Union, Subtract, Intersect all throw same error  
**Console Error:**
```
oc.Message_ProgressRange_1 is not a constructor
```
**Impact:** Cannot perform any CSG operations  
**Root Cause:** OpenCASCADE.js binding issue - `Message_ProgressRange` class not properly exported in WASM module. This is likely an OCCT version mismatch or incomplete WASM build.

**Operations Tested:**
- `kernel.union(shapeA, shapeB)` → ❌ FAIL
- `kernel.subtract(shapeA, shapeB)` → ❌ FAIL  
- `kernel.intersect(shapeA, shapeB)` → ❌ FAIL

### 3. Fillet/Chamfer - WORKAROUND ADDED ⚠️
**Original Symptom:** Both threw TypeError (`edgeIds.includes is not a function`)  
**Root Cause:** API expected array of edge IDs, caller passed single shape ID

**Fix Applied:**
- Added `kernel.filletAll(shapeId, radius)` - fillets ALL edges at once
- Added `kernel.chamferAll(shapeId, distance)` - chamfers ALL edges at once
- Added `kernel.getEdges(shapeId)` - returns edge IDs for selective operations
- Added commands: `filletall`, `chamferall`, `getedges`

**Usage:**
```javascript
const box = await kernel.createBox({width:20, height:20, depth:20})
await kernel.filletAll(box.id, 2) // Fillet all edges with radius 2
```

**Original API still works** for selective edge operations when you have edge IDs.

### 4. Redo - SILENT FAILURE
**Symptom:** Redo command executes but doesn't restore object  
**Test Results:**
```
Before undo: 8 objects
After undo: 7 objects ✅
After redo: 7 objects ❌ (should be 8)
```
**Console Shows:** "REDO: Create Primitive" logged, History updates, but object not re-added to scene  
**Impact:** Undo is one-way - cannot recover accidentally removed work

---

## Console Errors Encountered

1. **Warning (expected):** Cone fallback message
2. **TypeError:** `oc.Message_ProgressRange_1 is not a constructor` (boolean ops)
3. **TypeError:** `edgeIds.includes is not a function` (fillet/chamfer)

No uncaught exceptions or crashes observed.

---

## Visual Observations

### Viewport After All Tests
- Multiple overlapping geometries at origin (0,0,0)
- All shapes render with correct materials (AL-6061-T6)
- Shaded view mode working
- Transform handles visible on selected objects
- Grid and axes display correctly

### What's Visible:
- Box primitives (2 overlapping at top)
- Sphere (large rounded shape)
- Cylinder (cylindrical shape on left)
- Cone (created via fallback)
- Torus (donut shape visible in front)
- Wedge (small tapered shape)

---

## Recommendations for Next Sprint

### Priority 1 (Blockers)
1. **Fix Boolean Operations** - Investigate `Message_ProgressRange` binding issue in OCCT WASM build. May need to rebuild with correct exports or downgrade OCCT version.

2. **Fix Redo** - The CreatePrimitiveCommand's `redo()` method needs debugging. Likely not properly re-adding mesh to scene or System.objects array.

### Priority 2 (Important)
3. **Fix Cone Parameters** - Update worker to pass 5 parameters to `BRepPrimAPI_MakeCone_4` constructor (likely needs axis parameter).

4. ~~**Fix Fillet/Chamfer API**~~ ✅ DONE - Added `filletAll` and `chamferAll` methods that apply to all edges. Added `getEdges` for selective operations.

### Priority 3 (Nice to Have)
5. **Test Extrude/Revolve** - Not tested due to sketch system dependency
6. **Test Export (STEP/STL)** - Not tested this round
7. **Spread primitives spatially** - Currently all spawn at origin, making visual verification difficult

---

## Test Commands Used

```javascript
// Basic primitives
window.AmericaD.createPrimitive('box', {width: 20, height: 20, depth: 20})
window.AmericaD.createPrimitive('sphere', {radius: 15})
window.AmericaD.createPrimitive('cylinder', {radius: 10, height: 30})
window.AmericaD.createPrimitive('cone', {radius1: 15, radius2: 5, height: 25})

// New primitives
window.AmericaD.createPrimitive('torus', {majorRadius: 20, minorRadius: 5})
window.AmericaD.createPrimitive('wedge', {width: 20, height: 15, depth: 10, ltx: 5})

// Kernel direct calls (for booleans)
const box1 = await window.AmericaD.kernel.createBox({width: 30, height: 30, depth: 30})
const box2 = await window.AmericaD.kernel.createBox({width: 20, height: 20, depth: 40})
await window.AmericaD.kernel.union(box1.id, box2.id)

// Undo/Redo
window.AmericaD.undo()
window.AmericaD.redo()
```

---

## Appendix: Kernel Methods Available

```
Primitives: createBox, createCylinder, createSphere, createCone, createTorus, createWedge
Booleans: boolean, union, subtract, intersect
Features: fillet, chamfer, filletAll, chamferAll, extrude, revolve, shell, loft, sweep
Query: getVolume, getBoundingBox, getEdges
Export: exportSTEP, exportSTL
Lifecycle: init, isReady, deleteShape, terminate
```

---

*End of Smoke Test Report*
