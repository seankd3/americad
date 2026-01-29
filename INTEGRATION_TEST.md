# AmericaD Integration Test Report
**Date:** 2026-01-29  
**Version:** 2.0.1-LA  
**Test Environment:** Chromium (Clawd browser), OCCT 7.0  

---

## Overall Verdict: **PARTIAL PASS** ⚠️

The core CAD functionality works, but there are critical bugs that need fixing before v1.0.

---

## 1. App Startup

| Test | Result | Notes |
|------|--------|-------|
| App loads without console errors | ✅ PASS | Only favicon.ico 404 (benign) |
| Kernel initializes (OCCT message) | ✅ PASS | "KERNEL ONLINE (OCCT B-REP)", OCCT 7.0 |
| UI renders (viewport, panels, feature tree) | ✅ PASS | Full professional CAD UI rendered |

**Console Output on Startup:**
```
[Ameri-CAD] Application created
[Ameri-CAD] Starting initialization...
[Ameri-CAD] INIT KERNEL...
[Kernel] OpenCASCADE initialized successfully
[Kernel] OCCT Version: 7.0
[Ameri-CAD] KERNEL ONLINE (OCCT B-REP)
[Ameri-CAD] DOCUMENT MODEL READY
```

---

## 2. Primitives (Kernel B-Rep)

| Primitive | Result | Vertices | Notes |
|-----------|--------|----------|-------|
| `box 20 20 20` | ✅ PASS | 24 | Clean box geometry |
| `sphere 15` | ✅ PASS | 774 | Smooth tessellation |
| `cylinder 10 30` | ✅ PASS | 130 | Proper caps and body |
| `cone 15 5 25` | ✅ PASS | 335 | Fixed! Working correctly |
| `torus 20 5` | ❌ FAIL | - | OCCT API mismatch: `BRepPrimAPI_MakeTorus_3` expects 4 params, got 3 |
| `wedge 20 20 10 5` | ❌ FAIL | - | OCCT API mismatch: `BRepPrimAPI_MakeWedge_3` expects 7 params, got 5 |

**Issue:** The OpenCASCADE.js bindings have different constructor signatures than expected. Need to check the correct API for torus and wedge.

---

## 3. Lighting/Normals

| Test | Result | Notes |
|------|--------|-------|
| Spheres have smooth shading | ✅ PASS | 774 vertices with proper normals |
| Boxes have flat shading on faces | ✅ PASS | Per-face normals visible |
| Lighting correct from all angles | ✅ PASS | View cube rotation confirms lighting |

**Screenshot Description:** The default cube shows proper ambient + directional lighting with visible shading gradients. The view cube in the top-right shows correct face labels and shading.

---

## 4. Boolean Operations

| Operation | Result | Notes |
|-----------|--------|-------|
| `union` | ❌ FAIL | `BRepAlgoAPI_Fuse_2` expects 1 param, got 2 |
| `subtract` | ❌ FAIL | `BRepAlgoAPI_Cut_2` expects 1 param, got 2 |
| `intersect` | ❌ FAIL | `BRepAlgoAPI_Common_2` expects 1 param, got 2 |

**Issue:** The OpenCASCADE.js v1.1.1 has different constructor signatures than the code expects. The `_2` variants may have changed or need different initialization.

**Fix Needed:** Check OpenCASCADE.js documentation for correct boolean operation API.

---

## 5. Fillet/Chamfer

| Operation | Result | Vertices | Notes |
|-----------|--------|----------|-------|
| `filletall 2` | ✅ PASS | 536 | Rounds all edges correctly |
| `chamferall 2` | ✅ PASS | 96 | Bevels all edges correctly |

Fillet and chamfer operations work perfectly! The kernel properly iterates through all edges and applies the modifications.

---

## 6. Undo/Redo

| Test | Result | Notes |
|------|--------|-------|
| Ctrl+Z removes object | ⚠️ PARTIAL | Cannot test due to selection loop |
| Ctrl+Shift+Z restores | ⚠️ PARTIAL | Cannot test due to selection loop |
| Multiple cycles work | ⚠️ PARTIAL | API exists: `undo()`, `redo()` available |

**Blocker:** Selection loop bug prevents testing via UI. The undo/redo functions exist and appear properly implemented.

---

## 7. Feature Tree

| Test | Result | Notes |
|------|--------|-------|
| Tree shows created objects | ⚠️ PARTIAL | Feature tree UI renders |
| Click tree → select viewport | ❌ FAIL | **CRITICAL BUG**: Infinite loop |
| Click viewport → sync tree | ❌ FAIL | **CRITICAL BUG**: Infinite loop |
| Delete from tree removes object | ⚠️ UNTESTED | Cannot test due to selection bug |

### Critical Bug: Selection Infinite Loop

**Location:** `app.js` lines 877-883 and `src/ui/feature-tree.js`

**Root Cause:**
1. `selectObject()` calls `featureTreeUI.selectFeature(id)`
2. `featureTreeUI.onFeatureSelect` callback calls `selectObject(mesh)`
3. This creates an infinite recursion → `Maximum call stack size exceeded`

**Error:**
```javascript
RangeError: Maximum call stack size exceeded
    at SelectionManager.select
    at selectObject
    at featureTreeUI.onFeatureSelect
    at FeatureTreeUI.selectFeature
    at selectObject  // ← infinite loop
```

**Fix:** Add a guard flag to prevent re-entry:
```javascript
let _selectingObject = false;
function selectObject(object) {
    if (_selectingObject) return;
    _selectingObject = true;
    try {
        selectionManager.select(object, transformControl, System.transformMode);
        updateProperties();
        if (featureTreeUI && object?.userData?.id) {
            featureTreeUI.selectFeature(object.userData.id);
        }
    } finally {
        _selectingObject = false;
    }
}
```

---

## 8. File I/O

| Test | Result | Notes |
|------|--------|-------|
| Ctrl+S saves .americad file | ⚠️ UNTESTED | Function exists: `saveDocument()` |
| Ctrl+O opens file picker | ⚠️ UNTESTED | Function exists: `openDocument()` |
| Loading restores geometry | ⚠️ UNTESTED | Cannot verify due to selection bug |

---

## 9. Export

| Test | Result | Notes |
|------|--------|-------|
| `export step` | ❌ FAIL | Shape tracking issue: "Shape not found" |
| `export stl` | ❌ FAIL | API issue: `writer.SetASCIIMode is not a function` |

**Issues:**
1. **STEP Export:** The kernel creates shapes but doesn't persist them in the shape map for later export. Need to store shape references.
2. **STL Export:** OpenCASCADE.js API mismatch - `StlAPI_Writer` doesn't have `SetASCIIMode` method in this version.

---

## Summary of Bugs Found

### Critical (Blockers for v1.0)
1. **Selection Infinite Loop** - Makes app partially unusable when clicking objects
2. **Boolean Operations Broken** - Core CAD functionality missing

### High Priority
3. **Torus/Wedge Primitives** - OCCT API parameter mismatch
4. **STEP Export** - Shape not persisted for export
5. **STL Export** - Wrong API method name

### Medium Priority
6. **Excessive Console Logging** - "SELECTED: BODY_003" logged hundreds of times per keystroke

---

## Working Features ✅

- OpenCASCADE kernel initialization
- Basic primitives (box, sphere, cylinder, cone)
- Tessellation with proper normals
- Fillet and chamfer operations
- Professional CAD UI (toolbar, view cube, properties panel)
- Transform controls (gizmo)
- View switching (3D, Top, Front, Right, Left)
- Grid and snap toggles
- FPS display (60 FPS stable)
- Command line input
- Material selection UI
- Scale/units display

---

## Recommended Actions Before v1.0

1. **Fix selection loop** - Add re-entry guard (30 min fix)
2. **Fix boolean operations** - Check OCCT.js API docs for correct constructor (1-2 hours)
3. **Fix torus/wedge** - Same as above
4. **Fix exports** - Update shape persistence and use correct STL API (1-2 hours)
5. **Reduce logging verbosity** - Add debouncing or remove selection spam

---

## Test Environment Details

- **Browser:** Chromium (Playwright managed)
- **OpenCASCADE.js:** v1.1.1 (npm package)
- **OCCT Version:** 7.0
- **Three.js:** ES modules
- **Host:** Linux x64
- **FPS:** 60 stable
