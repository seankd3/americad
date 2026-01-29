# Ameri-CAD User Guide

This guide covers everything you need to know to use Ameri-CAD effectively.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [UI Overview](#ui-overview)
3. [Creating Primitives](#creating-primitives)
4. [Selection and Transform](#selection-and-transform)
5. [Boolean Operations](#boolean-operations)
6. [Fillet and Chamfer](#fillet-and-chamfer)
7. [Sketch Mode](#sketch-mode)
8. [Feature Tree](#feature-tree)
9. [Undo/Redo](#undoredo)
10. [Save and Load](#save-and-load)
11. [Export](#export)
12. [Keyboard Shortcuts](#keyboard-shortcuts)
13. [Command Reference](#command-reference)

---

## Getting Started

### Starting the Application

1. Navigate to the americad directory
2. Start a local server:
   ```bash
   ./start-server.sh
   # or
   python3 -m http.server 8000
   ```
3. Open `http://localhost:8000` in your browser

### First Steps

When Ameri-CAD loads, you'll see:
- A 3D viewport with a grid and coordinate axes
- A default box primitive (`BODY_001`)
- The feature tree panel on the left
- A command line at the bottom

**Try these commands:**
```
box 30 20 10     # Create a 30x20x10 box
sphere 15        # Create a sphere with radius 15
fit              # Zoom to fit all objects
```

---

## UI Overview

### Main Viewport

The central 3D view where you interact with your model.

- **Rotate**: Click and drag (or middle-mouse)
- **Pan**: Right-click and drag (or Shift + middle-mouse)
- **Zoom**: Scroll wheel

### Feature Tree (Left Panel)

Shows all features in your document as a hierarchical list:

```
DESIGN
├── BODY_001 (Box)
├── BODY_002 (Cylinder)
└── Cut_003 (Boolean)
```

- **Click** to select a feature
- **Double-click** to edit parameters (coming soon)
- **Eye icon** to toggle visibility
- **Right-click** for context menu (rename, delete)

### Properties Panel (Right Panel)

When an object is selected, shows:
- **Position** (X, Y, Z)
- **Rotation** (degrees)
- **Scale** (uniform or per-axis)

### Command Line (Bottom)

Type commands directly:
- Press `` ` `` (backtick) to focus the command line
- Press `Enter` to execute
- Press `Escape` to cancel
- Press `?` or `help` for available commands

### Status Bar

Shows:
- Current cursor position (X, Y, Z coordinates)
- Active tool mode
- System status
- FPS counter

### View Cube (Top Right)

Interactive cube showing current orientation:
- Click faces to snap to standard views (Front, Top, Right, etc.)
- Rotates with the camera to show current orientation

---

## Creating Primitives

### Using the UI

Click the primitive buttons in the toolbar:
- **Box** (cube icon)
- **Sphere** (circle icon)
- **Cylinder**
- **Cone**
- **Torus**

### Using Commands

Type in the command line:

| Command | Description | Example |
|---------|-------------|---------|
| `box [w] [h] [d]` | Create box | `box 20 30 10` |
| `sphere [r]` | Create sphere | `sphere 15` |
| `cylinder [r] [h]` | Create cylinder | `cyl 8 20` |
| `cone [r] [h]` | Create cone | `cone 10 16` |
| `torus [R] [r]` | Create torus | `torus 10 3` |
| `wedge [dx] [dy] [dz]` | Create wedge | `wedge 20 10 30` |

### Default Dimensions

If you omit dimensions, defaults are used:
- `box` → 20×20×20
- `sphere` → radius 10
- `cylinder` → radius 8, height 20
- `cone` → radius 8, height 16
- `torus` → major 10, minor 3

---

## Selection and Transform

### Selecting Objects

**Method 1: Click in Viewport**
- Click on an object to select it
- Click empty space to deselect
- Selected objects show a highlight color and transform gizmo

**Method 2: Click in Feature Tree**
- Click any feature name to select it in both tree and viewport

### Transform Gizmo

When an object is selected, the transform gizmo appears:

| Mode | Key | Description |
|------|-----|-------------|
| **Translate** | `T` | Move object along axes |
| **Rotate** | `R` | Rotate around axes |
| **Scale** | `G` | Scale along axes |

**Using the Gizmo:**
1. Select an object
2. Press `T`, `R`, or `G` to set transform mode
3. Drag the colored arrows/rings:
   - **Red** = X axis
   - **Green** = Y axis
   - **Blue** = Z axis
4. Drag the center (white) to move freely

### Snapping

Toggle grid snapping with the `snap` command or the SNAP button in the toolbar.

---

## Boolean Operations

Boolean operations combine two or more solid bodies.

### Union (Add)

Combines shapes into one solid:

```
# 1. Create two overlapping shapes
box 20 20 20
sphere 15

# 2. Select both (feature tree or viewport)
# 3. Execute union
union
```

**Aliases:** `add`, `join`, `fuse`, `u`

### Subtract (Cut)

Cuts the tool shape from the target:

```
# Creates a box with a cylindrical hole
box 30 30 30
cylinder 10 40    # Position to intersect box

# Select box first (target), then cylinder (tool)
subtract
```

**Aliases:** `sub`, `cut`, `difference`, `s`

### Intersect (Common)

Keeps only the overlapping region:

```
box 20 20 20
sphere 15

# Select both
intersect
```

**Aliases:** `int`, `common`, `i`

### Important Notes

- Boolean operations create a **new feature** in the tree
- Original bodies are preserved (hidden by default)
- The first selected object is the **target**, second is the **tool**

---

## Fillet and Chamfer

### Fillet (Round Edges)

Adds rounded edges to a solid:

```
fillet [radius]
```

1. Select a body
2. (Future: select specific edges)
3. Run `fillet 3` to apply 3mm radius fillet

**Aliases:** `round`, `fil`

### Chamfer (Bevel Edges)

Adds angled cuts to edges:

```
chamfer [distance]
```

**Aliases:** `bevel`, `cham`

> **Note:** Edge selection for fillet/chamfer is planned. Currently applies to all edges.

---

## Sketch Mode

Sketch mode lets you draw 2D profiles that can be extruded into 3D solids.

### Entering Sketch Mode

```bash
sketch          # Enter on XY plane (default)
sketch xz       # Enter on XZ plane
sketch yz       # Enter on YZ plane
```

Or press `C` to enter sketch mode.

### Sketch Tools

| Key | Tool | Description |
|-----|------|-------------|
| `L` | Line | Draw connected line segments |
| `R` | Rectangle | Draw rectangle from corner to corner |
| `O` | Circle | Draw circle (center + radius) |
| `S` | Select | Select sketch entities |

### Drawing Workflow

1. **Enter sketch mode:** `sketch` or press `C`
2. **Select a tool:** `L` for line, `R` for rectangle, `O` for circle
3. **Click to draw:**
   - Line: Click start point, click end point (repeat for chain)
   - Rectangle: Click first corner, click opposite corner
   - Circle: Click center, click to set radius
4. **Finish drawing:** Press `Enter` or `Escape`
5. **Exit sketch:** Press `Escape` or click "FINISH SKETCH" button

### Extruding a Sketch

After creating a closed profile (rectangle, circle):

```bash
exit            # Exit sketch mode first
extrude 25      # Extrude by 25mm
```

**Aliases:** `ext`

### Example: Creating a Custom Part

```bash
# 1. Enter sketch mode on XY plane
sketch xy

# 2. Draw a rectangle
# (press R, click two corners)

# 3. Draw a circle inside it
# (press O, click center, click to set radius)

# 4. Exit sketch
exit

# 5. Extrude the rectangle
extrude 30

# This creates a block - to add the hole, you would
# extrude the circle and subtract it
```

---

## Feature Tree

The feature tree is the heart of parametric CAD. It tracks:
- Every operation you perform (primitives, booleans, features)
- Dependencies between features
- The order of operations

### Tree Structure

```
DESIGN
├── BODY_001 (Box)           ← Independent primitive
├── BODY_002 (Cylinder)      ← Independent primitive
└── Cut_003 (Boolean)        ← Depends on BODY_001, BODY_002
    ├── [target: BODY_001]
    └── [tool: BODY_002]
```

### Feature Operations

| Action | How To |
|--------|--------|
| **Select** | Click feature name |
| **Hide/Show** | Click eye icon (👁) |
| **Rename** | Right-click → Rename |
| **Delete** | Right-click → Delete, or select + `Delete` key |

### Regeneration

When you modify a feature, all dependent features automatically regenerate. This is the power of parametric modeling — change a dimension, and everything downstream updates.

---

## Undo/Redo

Ameri-CAD tracks your entire editing history.

| Action | Shortcut | Command |
|--------|----------|---------|
| **Undo** | `Ctrl+Z` | `undo` |
| **Redo** | `Ctrl+Y` | `redo` |

The history includes:
- Primitive creation
- Transforms (move, rotate, scale)
- Boolean operations
- Feature modifications
- Deletions

---

## Save and Load

### Saving Your Work

**Keyboard:** `Ctrl+S`
**Command:** `save`

This downloads a `.americad` file containing your parametric feature tree. The file is human-readable JSON.

### Opening a File

**Keyboard:** `Ctrl+O`
**Command:** `open` or `load`

This opens a file picker. Select a `.americad` file to load.

When loaded, all features are regenerated through the kernel, so you get exact B-Rep geometry.

### File Format

The `.americad` format stores:
- Document metadata (name, version, timestamps)
- Feature list in dependency order
- Feature parameters (dimensions, positions)
- Dependencies between features

It does **not** store:
- Raw mesh data
- Rendering state
- UI preferences

---

## Export

### STEP Export (Recommended for CAD)

```bash
export          # Export all visible features to STEP
```

STEP (ISO 10303-21, AP214) is the standard interchange format for CAD:
- Opens in Fusion 360, SolidWorks, FreeCAD, etc.
- Preserves exact B-Rep geometry
- Best for manufacturing workflows

### STL Export (for 3D Printing)

STL is a mesh format suitable for 3D printing:
- ASCII or binary format
- Tessellated triangles (not exact geometry)
- Supported by all slicer software

To export STL, select an object and use the File menu → Export.

### Comparison

| Format | Geometry | Use Case |
|--------|----------|----------|
| `.americad` | Parametric | Continue editing later |
| `.step` | Exact B-Rep | CAD interoperability |
| `.stl` | Mesh | 3D printing |

---

## Keyboard Shortcuts

### Global

| Key | Action |
|-----|--------|
| `Ctrl+S` | Save document |
| `Ctrl+O` | Open document |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete selected |
| `Escape` | Deselect / Cancel |
| `` ` `` | Focus command line |

### Tools

| Key | Tool |
|-----|------|
| `S` | Select |
| `C` | Sketch mode |
| `M` / `T` | Move |
| `R` | Rotate (or Rectangle in sketch) |
| `G` | Scale |

### Sketch Mode

| Key | Tool |
|-----|------|
| `L` | Line |
| `R` | Rectangle |
| `O` | Circle |
| `Enter` | Finish current operation |
| `Escape` | Cancel / Exit sketch |

### View

| Key | View |
|-----|------|
| `1` | Front |
| `2` | Top |
| `3` | Right |
| `4` | Isometric |
| `F` | Zoom to fit |

---

## Command Reference

### Primitives

| Command | Description |
|---------|-------------|
| `box [w] [h] [d]` | Create box |
| `sphere [r]` | Create sphere |
| `cylinder [r] [h]` | Create cylinder |
| `cone [r] [h]` | Create cone |
| `torus [R] [r]` | Create torus |
| `wedge [dx] [dy] [dz]` | Create wedge |

### Boolean Operations

| Command | Description |
|---------|-------------|
| `union` | Combine selected shapes |
| `subtract` | Cut tool from target |
| `intersect` | Keep only overlap |

### Features

| Command | Description |
|---------|-------------|
| `fillet [r]` | Round edges |
| `chamfer [d]` | Bevel edges |
| `extrude [h]` | Extrude sketch |

### Sketch

| Command | Description |
|---------|-------------|
| `sketch [plane]` | Enter sketch mode (xy/xz/yz) |
| `exit` / `finish` | Exit sketch mode |

### Edit

| Command | Description |
|---------|-------------|
| `undo` | Undo last action |
| `redo` | Redo undone action |
| `delete` / `del` | Delete selected |
| `clear` | Clear entire scene |

### View

| Command | Description |
|---------|-------------|
| `fit` | Zoom to fit all |
| `grid` | Toggle grid |
| `snap` | Toggle snapping |

### File

| Command | Description |
|---------|-------------|
| `save` | Save document |
| `open` / `load` | Open document |
| `info` | Show document info |

### System

| Command | Description |
|---------|-------------|
| `status` | Show system status |
| `kernel` | Show kernel status |
| `help` / `?` | Show help |

---

## Tips and Best Practices

### Workflow Tips

1. **Name your features** — Right-click and rename to keep track of what's what
2. **Use the command line** — It's faster than clicking once you learn the commands
3. **Save often** — `Ctrl+S` is your friend
4. **Check kernel status** — If operations fail, type `kernel` to verify it's online

### Performance Tips

1. **Keep feature count reasonable** — Each feature requires kernel evaluation
2. **Use booleans sparingly** — They're computationally expensive
3. **Hide unused features** — Improves viewport performance

### Troubleshooting

| Problem | Solution |
|---------|----------|
| Stuck on loading | Press F12 and check console for errors |
| Kernel offline | Refresh the page; ensure you're using HTTP server |
| Export fails | Check kernel status; try exporting fewer objects |
| Boolean fails | Ensure shapes actually overlap |

---

## Next Steps

- Check out the [Architecture Guide](ARCHITECTURE.md) to understand how Ameri-CAD works
- See the [API Reference](API.md) if you want to extend or script Ameri-CAD
- Read [Contributing](CONTRIBUTING.md) to help improve Ameri-CAD
