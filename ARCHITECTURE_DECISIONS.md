# Ameri-CAD Architecture Decisions

*Deliberated by Council (Gemini, Claude, Codex, Kimi) on 2026-01-29*

## ADR-001: State Management

**Decision:** Event Sourcing with Hybrid Mutable Cache

**Context:** Parametric CAD inherently operates on a sequence of feature operations.

**Rationale:**
- The `.americad` file format already serializes features as a topologically sorted list — this IS an event log
- Each feature creation is an event; regeneration is event replay
- Undo becomes log truncation, collaboration becomes event stream merging
- Keeps mutable DocumentModel as "read projection" for fast UI updates

**Implementation:**
```javascript
// Events (append-only)
const events = [
  { type: 'FeatureAdded', feature: { type: 'box', params: {...} } },
  { type: 'ParameterChanged', featureId: 'f1', param: 'width', value: 100 },
  { type: 'FeatureDeleted', featureId: 'f2' }
];

// Projection (mutable, derived)
const documentModel = rebuildFromEvents(events);
const geometryCache = new Map(); // featureId → TopoDS_Shape

// Partial regen: invalidate from changed feature forward
function onParameterChange(featureId, param, value) {
  appendEvent({ type: 'ParameterChanged', featureId, param, value });
  invalidateDownstream(featureId);
  regenerateInvalidated();
}
```

**Optimization:**
- Partial regeneration (only replay from changed feature)
- Periodic snapshots (every N events or on save)
- Dependency-based invalidation tracking

---

## ADR-002: WebAssembly Threading Strategy

**Decision:** Hybrid - Single OCC Worker + SharedArrayBuffer + Optional Pool

**Context:** OpenCASCADE is fundamentally single-threaded for dependent B-Rep operations. Mesh transfer via postMessage causes structure cloning overhead.

**Architecture:**
```
Main Thread (UI)
     │
     ├──► 1 Persistent Worker: OpenCASCADE Session
     │    • Stateful (retains TopoDS_Shape map)
     │    • Serial execution (feature dependency order)
     │    • Cannot be parallelized
     │
     ├──► SharedArrayBuffer
     │    • Zero-copy mesh transfer
     │    • Vertices, indices, normals
     │
     └──► N Ephemeral Workers (optional)
          • Tessellation (parallel, stateless)
          • Mass properties calculation
          • STEP/STL export formatting
```

**Implementation:**
```javascript
// worker.js - single orchestrator
const shapeCache = new Map(); // featureId → TopoDS_Shape handle

// Use SAB for mesh output
const meshBuffer = new SharedArrayBuffer(MAX_MESH_SIZE);
const meshView = new Float32Array(meshBuffer);

// Parallel tessellation (future)
const tessWorker = new Worker('tessellate-worker.js');
tessWorker.postMessage({ shapeHandle, buffer: meshBuffer });
```

---

## ADR-003: Plugin/Extension Architecture

**Decision:** JavaScript API Primary, Pyodide Optional

**Rationale:**
- Browser environment favors JavaScript natively
- JS API covers 80%+ of extension use cases
- Pyodide adds complexity (WASM Python runtime)
- Power users can opt-in to Python scripting

**Implementation:**
```javascript
// Plugin API (JS)
AmeriCAD.registerPlugin({
  name: 'My Custom Tool',
  version: '1.0.0',
  
  activate(api) {
    api.commands.register('myCommand', (args) => {
      const box = api.primitives.createBox(10, 20, 30);
      api.document.addFeature(box);
    });
    
    api.ui.addToolbarButton({
      icon: 'custom-icon.svg',
      command: 'myCommand'
    });
  },
  
  deactivate() { /* cleanup */ }
});

// Pyodide bridge (optional)
if (window.pyodide) {
  pyodide.runPython(`
    import americad
    box = americad.create_box(10, 20, 30)
  `);
}
```

**Security:**
- Sandboxed execution (no direct DOM access)
- Capability-based permissions
- Versioned API contracts

---

## ADR-004: Assembly Data Model

**Decision:** Hybrid External References with Instance Transforms

**Rationale:**
- Components stored as separate .americad files
- Assembly references components by path + optional version
- Instance transforms (position, rotation) stored in assembly
- Supports simple "insert part" workflow initially
- Version pinning available but not required

**Data Model:**
```javascript
// assembly.americad
{
  "type": "assembly",
  "components": [
    {
      "id": "c1",
      "path": "./parts/bracket.americad",
      "version": null,  // latest, or "v1.2.3" for pinned
      "transform": {
        "position": [0, 0, 0],
        "rotation": [0, 0, 0],
        "scale": [1, 1, 1]
      }
    },
    {
      "id": "c2", 
      "path": "./parts/bolt.americad",
      "instanceOf": "c1_hole_pattern",  // pattern reference
      "count": 4
    }
  ],
  "joints": [
    {
      "type": "rigid",
      "componentA": "c1",
      "componentB": "c2",
      "mateA": { "face": "top" },
      "mateB": { "face": "bottom" }
    }
  ]
}
```

---

## ADR-005: Development Workflow

**Decision:** Structured Agent Coordination with CI Gates

**Rationale:** Parallel agent development requires coordination to avoid conflicts and ensure quality.

**Practices:**

### File Ownership Map
```yaml
# .agent-ownership.yml
agents:
  kernel-agent:
    owns: [src/kernel/*, tests/kernel-*]
  ui-agent:
    owns: [src/ui/*, tests/ui-*]
  sketch-agent:
    owns: [src/sketch/*, tests/sketch-*]
```

### Feature Flags
```javascript
// features.js
export const FEATURES = {
  ASSEMBLY_MODE: false,
  PYTHON_SCRIPTING: false,
  COLLABORATION: false
};
```

### CI Pipeline
```yaml
# .github/workflows/test.yml
jobs:
  test:
    steps:
      - run: npm test           # Unit tests
      - run: npm run test:smoke # Integration smoke tests
      - run: npm run lint       # Code style
  
  contract-test:
    steps:
      - run: npm run test:worker-api  # Worker contract tests
```

### Agent Prompt Template
```markdown
## Required Output
When complete, provide:
1. Files created/modified (list)
2. Tests written (count and names)
3. Tests passing (run them!)
4. Commit hash

## Required: Tests
Write tests FIRST or alongside implementation.
Feature is not complete until tests pass.
```

---

## Summary

| Decision | Choice | Status |
|----------|--------|--------|
| State Management | Event Sourcing + Hybrid Cache | Adopted |
| Threading | Single OCC Worker + SAB + Pool | Adopted |
| Plugins | JS API Primary + Pyodide Optional | Adopted |
| Assemblies | Hybrid External Refs | Planned |
| Dev Workflow | Agent Coordination + CI | Adopted |

*Council Session: 2026-01-29, 3 rounds, 4 agents*
