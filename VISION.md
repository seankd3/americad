# Ameri-CAD Vision

**The best of Fusion 360 + Blender in one application.**

## From Fusion 360 (Precision CAD)

### Parametric Modeling
- [x] Feature-based timeline/history
- [x] Sketch constraints (H/V/dimension)
- [ ] Fully constrained sketches (over/under-constrained warnings)
- [ ] Design intent preservation
- [ ] Parameters & expressions (width = height * 2)

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

*"Fusion's precision, Blender's soul."*
