# Ameri-CAD Development Roadmap

**Generated:** 2026-01-29
**Goal:** Professional CAD app like Fusion 360, running locally

## Architecture (Council-Approved)

```
┌─────────────────────────────────────────┐
│         UI Layer (Main Thread)          │
│   Three.js viewport, panels, tree       │
└────────────────┬────────────────────────┘
                 │ postMessage
┌────────────────▼────────────────────────┐
│      Document Model (Feature DAG)       │
│  Source of truth: JSON recipe + params  │
│  Topology map: Face#1 → kernel ID       │
└────────────────┬────────────────────────┘
                 │ Transferable buffers
┌────────────────▼────────────────────────┐
│    Geometry Kernel (Web Worker)         │
│  OpenCASCADE.js WASM (~30MB)            │
│  B-Rep ops → tessellation → render mesh │
└─────────────────────────────────────────┘
```

## Phase 1: Foundation (Current)

- [x] Basic Three.js visualization
- [x] Primitive creation (mesh-based)
- [x] Transform controls
- [ ] **Module extraction** - Break app.js into ES modules
- [ ] **Command pattern** - Undo/redo system
- [ ] **Test harness** - Browser-native tests

## Phase 2: Kernel Integration

- [ ] OpenCASCADE.js setup in Web Worker
- [ ] Primitive creation via kernel (B-Rep)
- [ ] Tessellation pipeline (kernel → Three.js)
- [ ] Topology ID mapping

## Phase 3: Parametric Operations

- [ ] Feature tree / Document Model
- [ ] Extrude operation
- [ ] Boolean operations (Union/Subtract/Intersect)
- [ ] Fillet/Chamfer
- [ ] Parameter editing with regeneration

## Phase 4: File I/O & Polish

- [ ] Native JSON format save/load
- [ ] STEP export
- [ ] STL export
- [ ] Crash recovery system
- [ ] CI/CD pipeline

## v1.0 Feature Set

| Category | Features |
|----------|----------|
| **Primitives** | Box, Cylinder, Sphere, Cone (kernel-native) |
| **Operations** | Extrude, Booleans, Fillet/Chamfer |
| **Parametric** | Feature tree, editable dimensions, regeneration |
| **Export** | STL + STEP + Native JSON |

## File Structure (Target)

```
americad/
├── index.html
├── styles.css
├── src/
│   ├── app.js              # Main orchestration
│   ├── core/
│   │   ├── math.js         # Pure geometry functions
│   │   ├── transforms.js   # Matrix operations
│   │   └── primitives.js   # Shape generation
│   ├── state/
│   │   ├── document.js     # Feature tree / DAG
│   │   ├── history.js      # Command pattern undo/redo
│   │   └── selection.js    # Selection management
│   ├── kernel/
│   │   ├── worker.js       # Web Worker for OCCT
│   │   ├── bridge.js       # Main thread ↔ Worker comms
│   │   └── operations.js   # Kernel operation wrappers
│   └── ui/
│       ├── viewport.js     # Three.js setup
│       ├── panels.js       # UI panels
│       └── tree.js         # Feature tree UI
├── tests/
│   ├── runner.html         # Browser test harness
│   ├── math.test.js
│   ├── primitives.test.js
│   └── history.test.js
└── .github/
    └── workflows/
        └── test.yml        # CI pipeline
```
