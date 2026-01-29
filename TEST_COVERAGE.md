# Ameri-CAD Test Coverage Audit

Generated: 2025-01-30

## Summary

| Metric | Count |
|--------|-------|
| Total Features Audited | 25 |
| Features with Tests | 11 |
| Partial Coverage | 3 |
| Missing Tests | 11 |
| **Overall Coverage** | **~44%** |

---

## Feature Coverage Matrix

| Feature | Test Status | Test File(s) | Notes |
|---------|------------|--------------|-------|
| **PRIMITIVES** | | | |
| Box | ✅ Tested | `kernel-primitives.test.js`, `primitives.test.js` | Both kernel B-Rep and THREE.js |
| Sphere | ✅ Tested | `kernel-primitives.test.js`, `primitives.test.js` | Both kernel and THREE.js |
| Cylinder | ✅ Tested | `kernel-primitives.test.js`, `primitives.test.js` | Both kernel and THREE.js |
| Cone | ✅ Tested | `kernel-primitives.test.js`, `primitives.test.js` | Both kernel and THREE.js |
| Torus | ✅ Tested | `kernel-primitives.test.js`, `primitives.test.js` | Both kernel and THREE.js |
| Wedge | ✅ Tested | `kernel-primitives.test.js` | Kernel only, no THREE.js fallback test |
| **BOOLEAN OPERATIONS** | | | |
| Union | ⚠️ Partial | `file-io.test.js` | Serialization only, no functional tests |
| Subtract | ⚠️ Partial | `file-io.test.js` | Serialization only, no functional tests |
| Intersect | ⚠️ Partial | `file-io.test.js` | Serialization only, no functional tests |
| **FEATURES** | | | |
| Fillet/Chamfer | ❌ Missing | — | Serialization exists in file-io, no kernel tests |
| Revolve | ❌ Missing | — | Command exists, no tests |
| Sweep | ❌ Missing | `sweep.test.js` | File exists but only has manual commands, no automated tests |
| Linear Pattern | ❌ Missing | — | Command exists in transforms.js |
| Circular Pattern | ❌ Missing | — | Command exists in transforms.js |
| Mirror | ❌ Missing | — | Command exists in transforms.js |
| **SKETCH MODE** | | | |
| Line | ❌ Missing | — | SketchManager has implementation |
| Rectangle | ❌ Missing | — | SketchManager has implementation |
| Circle | ❌ Missing | — | SketchManager has implementation |
| Arc | ❌ Missing | — | SketchManager has implementation |
| Spline | ❌ Missing | — | SketchManager has implementation |
| **SKETCH CONSTRAINTS** | | | |
| Horizontal | ✅ Tested | `dimension-constraint.test.mjs` | Constraint solver tested |
| Vertical | ❌ Missing | — | Not explicitly tested (similar to horizontal) |
| Dimension (Length) | ✅ Tested | `dimension-constraint.test.mjs` | Line length constraints |
| Radius | ✅ Tested | `dimension-constraint.test.mjs` | Circle radius constraints |
| **OPERATIONS** | | | |
| Extrude | ❌ Missing | — | Used in sketch workflow, no direct test |
| **FILE I/O** | | | |
| Save | ✅ Tested | `file-io.test.js` | Full serialization coverage |
| Load | ✅ Tested | `file-io.test.js` | Full deserialization coverage |
| **EXPORT** | | | |
| STEP | ❌ Missing | — | Export command exists, no test |
| STL | ❌ Missing | — | Export command exists, no test |
| **SYSTEM** | | | |
| Undo/Redo | ✅ Tested | `history.test.js` | CommandManager fully tested |
| Selection | ❌ Missing | — | SelectionManager has no tests |
| Transform (Move/Rotate/Scale) | ❌ Missing | — | Commands exist, no tests |
| Feature Tree | ❌ Missing | — | UI component, no tests |
| Property Panel | ❌ Missing | — | UI component, no tests |
| Measure Tool | ❌ Missing | — | MeasureTool class, no tests |
| Snap System | ✅ Tested | `snap-manager.test.js` | Grid, endpoint, midpoint, center snaps |

---

## Missing Tests - Priority Order

### 🔴 Critical Priority (Core Functionality)

1. **Boolean Operations (Functional)**
   - File: needs `booleans.test.js`
   - Test union, subtract, intersect with actual kernel
   - Verify mesh output, volume calculations
   - Edge cases: overlapping, tangent, disjoint shapes

2. **Extrude Operation**
   - File: needs `extrude.test.js`
   - Sketch profile → 3D solid workflow
   - Test various directions, distances
   - Test with different profile shapes

3. **Sketch Entity Creation**
   - File: needs `sketch-entities.test.js`
   - Line, rectangle, circle, arc, spline creation
   - Test point coordinates, entity properties
   - Test snap integration during creation

### 🟠 High Priority (Key Features)

4. **Fillet/Chamfer Operations**
   - File: needs `fillet-chamfer.test.js`
   - Test edge selection
   - Various radii/distances
   - Error cases (too large radius)

5. **Transform Operations**
   - File: needs `transforms.test.js`
   - Move: test displacement accuracy
   - Rotate: test angle, axis, center
   - Scale: test uniform and non-uniform

6. **Revolve Operation**
   - File: needs `revolve.test.js`
   - Sketch profile rotation
   - Different axes, partial angles

7. **Selection Manager**
   - File: needs `selection.test.js`
   - Single/multi selection
   - Selection highlighting
   - Deselection

### 🟡 Medium Priority (Advanced Features)

8. **Sweep Operation**
   - File: convert `sweep.test.js` to automated tests
   - Profile + path → solid
   - Linear, arc, helix paths
   - Pipe convenience command

9. **Pattern Operations**
   - File: needs `patterns.test.js`
   - Linear pattern: count, spacing, axis
   - Circular pattern: count, angle, axis

10. **Mirror Operation**
    - File: needs `mirror.test.js`
    - XY, XZ, YZ planes
    - Keep/replace original option

11. **Vertical Constraint**
    - Add to `dimension-constraint.test.mjs`
    - Should mirror horizontal tests

### 🟢 Lower Priority (UI/Export)

12. **STL Export**
    - File: needs `stl-export.test.js`
    - Binary vs ASCII format
    - Single/multiple bodies
    - File size validation

13. **STEP Export**
    - File: needs `step-export.test.js`
    - Requires kernel, integration test

14. **Measure Tool**
    - File: needs `measure-tool.test.js`
    - Point-to-point distance
    - Angle measurement

15. **Feature Tree UI**
    - File: needs `feature-tree.test.js`
    - Feature addition/removal
    - Visibility toggles
    - Renaming

16. **Property Panel UI**
    - File: needs `property-panel.test.js`
    - Property display
    - Property editing
    - Update propagation

---

## Existing Test Files Summary

| File | Tests | Focus |
|------|-------|-------|
| `kernel-primitives.test.js` | ~30+ | OCC kernel primitive creation, B-Rep validation |
| `primitives.test.js` | ~20+ | THREE.js geometry, volume, bounding box |
| `file-io.test.js` | ~50+ | Serialization, round-trip, validation |
| `history.test.js` | ~40+ | Command pattern, undo/redo, crash guard |
| `math.test.js` | ~30+ | Math utils, geometry utils, vectors |
| `snap-manager.test.js` | ~15+ | Snap types, priorities, settings |
| `dimension-constraint.test.mjs` | ~15 | Constraint solver algorithm |
| `sweep.test.js` | 0 | Manual commands only (NOT automated) |

---

## Recommendations

### Immediate Actions

1. **Convert sweep.test.js** to actual automated tests - the infrastructure is there but tests are just comments

2. **Create boolean operations test file** - critical functionality with zero functional tests

3. **Add sketch entity tests** - SketchManager is complex (~43KB) with no test coverage

### Test Infrastructure Improvements

1. **Mock kernel for unit tests** - Some tests require browser + OpenCASCADE; consider mocking for faster CI

2. **Add integration test suite** - End-to-end tests for full workflows (sketch → extrude → boolean → export)

3. **Golden file expansion** - Currently only `box_10x10x10.json`; add more reference geometries

### Code Coverage Tool

Consider adding Istanbul/nyc for JS code coverage metrics:
```json
{
  "scripts": {
    "test:coverage": "nyc mocha tests/**/*.test.js"
  }
}
```

---

## Test File Template

For new test files, follow this pattern (matches existing style):

```javascript
/**
 * Ameri-CAD [Feature] Tests
 * Tests for [description]
 */

import { /* imports */ } from '../src/[module].js';

describe('[Feature]', function() {
    
    describe('[Sub-feature]', function() {
        
        it('should [expected behavior]', function() {
            // Arrange
            // Act
            // Assert
            expect(result).to.equal(expected);
        });
        
    });
    
});
```

---

*This audit reflects the codebase as of January 2025. Update as tests are added.*
