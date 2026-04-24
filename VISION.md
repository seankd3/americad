# Ameri-CAD Vision

**Fusion 360-class parametric CAD, local-first, free, and open.**

Ameri-CAD exists for people who want professional mechanical CAD without a cloud
account, subscription lock-in, or disappearing files. It should feel as capable
as Fusion 360 for everyday modeling, but with a local document model, inspectable
data, offline operation, and a faster path from idea to editable solid.

## Product Promise

- **Local-first by default** — projects live on disk as human-readable `.americad`
  documents with embedded feature history, parameters, and references.
- **Real parametric CAD** — sketches, constraints, features, timeline edits, and
  regeneration are the core workflow, not an afterthought.
- **Open geometry pipeline** — OpenCASCADE B-Rep is the modeling truth; Three.js
  is the viewport, not the CAD kernel.
- **Powerful but calm** — command line, shortcuts, and palette for experts;
  discoverable toolbar, inspector, and timeline for normal use.
- **Free as in useful** — no forced cloud, no subscription, no artificial export
  limits, no dark patterns.

## Golden Workflow

This workflow must be excellent before advanced features count as done:

1. Create or open a local document.
2. Pick a construction plane.
3. Sketch a constrained profile with dimensions.
4. Finish sketch and create an extrude/revolve.
5. Edit sketch dimensions or feature parameters.
6. Regenerate downstream features predictably.
7. Save, reopen, and export STEP/STL without losing design intent.

## Architecture Rule

There is one source of truth:

`Document -> Parameters -> Sketches -> Features -> Bodies -> Evaluated Geometry`

UI tools and typed commands may create intent, but they do not own CAD state.
The document graph owns state. The evaluator rebuilds geometry from that graph.
The viewport renders evaluated geometry.

## From Fusion 360 (Precision CAD)

### Parametric Modeling

- [x] Feature-based timeline/history
- [x] Sketch constraints (H/V/dimension)
- [ ] Fully constrained sketches (over/under-constrained warnings)
- [ ] Design intent preservation
- [ ] Parameters & expressions (width = height \* 2)

### Manufacturing Features

- [x] Basic primitives
- [x] Boolean operations
- [x] Fillet/chamfer
- [ ] Hole wizard (counterbore, countersink, threads)
- [ ] Thread features
- [ ] Shell with variable thickness
- [ ] Draft angles
- [ ] Rib/web features

### Precision Tools

- [x] Dimension constraints
- [x] Measure tool
- [ ] Geometric tolerances (GD&T)
- [ ] Mass properties panel
- [ ] Center of gravity display
- [ ] Interference detection

### Assembly Mode

- [ ] Components & assemblies
- [ ] Joint constraints (rigid, revolute, slider, etc.)
- [ ] Motion study
- [ ] Exploded views

### Output

- [x] STEP export
- [x] STL export
- [ ] Drawing mode (2D views from 3D)
- [ ] Technical drawings with dimensions
- [ ] Bill of Materials (BOM)
- [ ] CAM toolpath generation (stretch)

## From Blender (Architecture & UX)

### Interaction Model

- [ ] Modal editing (G=grab, R=rotate, S=scale + axis lock)
- [ ] Numeric input during transforms (G X 10 = move 10 on X)
- [ ] Pie menus for quick tool access
- [x] Command palette / search
- [ ] Customizable keyboard shortcuts

### Viewport

- [x] Smooth 60 FPS navigation
- [ ] Multiple viewports (quad view)
- [ ] Orthographic presets (Front/Top/Right)
- [x] Transform gizmo
- [ ] Viewport shading modes (wireframe, solid, rendered)

### Non-Destructive Workflow

- [x] Feature tree / modifier stack
- [x] Parametric regeneration
- [ ] Feature suppression (temporarily disable)
- [ ] Feature reorder (drag in tree)
- [ ] Feature patterns (reference existing patterns)

### UI/UX

- [x] Property panel
- [x] Feature tree (Outliner)
- [ ] Collapsible/dockable panels
- [ ] Workspace presets (Modeling, Sketching, Assembly)
- [ ] Theme customization
- [ ] Splash screen with recent files

### Extensibility

- [ ] Python scripting API
- [ ] Add-on/plugin architecture
- [ ] Custom tool creation
- [ ] Macro recording

### Polish

- [x] Undo/redo
- [ ] Named undo steps ("Undo: Create Box")
- [ ] Auto-save with versioning
- [x] Crash recovery
- [ ] Tooltips on everything
- [ ] Context-sensitive help (F1)

## Core Principles

1. **Precision First** — Manufacturing-grade accuracy, proper B-Rep geometry
2. **Non-Destructive** — Everything is editable, nothing is baked
3. **Keyboard-Driven** — Power users can fly with shortcuts
4. **Progressive Disclosure** — Simple on surface, deep when needed
5. **Test Everything** — Every feature has comprehensive tests
6. **Learn from the Best** — Adopt proven UX patterns

## Target Users

- Mechanical engineers
- Product designers
- Makers/hobbyists
- Students learning CAD
- Anyone who wants professional CAD without the subscription

---

_"Fusion's precision, Blender's soul."_
