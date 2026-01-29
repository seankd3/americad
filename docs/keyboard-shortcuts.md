# ⌨️ Keyboard Shortcuts

> Complete reference for all Ameri-CAD keyboard shortcuts

Ameri-CAD uses Blender-inspired keyboard shortcuts for fast, efficient modeling.

---

## 📁 File Operations

| Action  | Shortcut       | Description            |
| ------- | -------------- | ---------------------- |
| Save    | `Ctrl+S`       | Save current document  |
| Save As | `Ctrl+Shift+S` | Save with new filename |
| Open    | `Ctrl+O`       | Open existing document |
| New     | `Ctrl+N`       | Create new document    |

---

## ✏️ Edit Operations

| Action     | Shortcut       | Description               |
| ---------- | -------------- | ------------------------- |
| Undo       | `Ctrl+Z`       | Undo last action          |
| Redo       | `Ctrl+Shift+Z` | Redo last undone action   |
| Redo (Alt) | `Ctrl+Y`       | Alternative redo shortcut |
| Delete     | `Delete`       | Delete selected objects   |
| Copy       | `Ctrl+C`       | Copy selection            |
| Paste      | `Ctrl+V`       | Paste from clipboard      |
| Cut        | `Ctrl+X`       | Cut selection             |
| Select All | `Ctrl+A`       | Select all objects        |
| Cancel     | `Escape`       | Cancel current operation  |

---

## 🔄 Transform (Blender-Style)

| Action        | Shortcut | Description                    |
| ------------- | -------- | ------------------------------ |
| **Grab/Move** | `G`      | Enter grab mode for selected   |
| **Rotate**    | `R`      | Enter rotate mode for selected |
| **Scale**     | `S`      | Enter scale mode for selected  |

### Transform Modifiers

When in transform mode, you can constrain the axis:

| Modifier  | Action                            |
| --------- | --------------------------------- |
| `X`       | Constrain to X axis               |
| `Y`       | Constrain to Y axis               |
| `Z`       | Constrain to Z axis               |
| `Shift+X` | Exclude X axis (move in YZ plane) |
| `Shift+Y` | Exclude Y axis (move in XZ plane) |
| `Shift+Z` | Exclude Z axis (move in XY plane) |

### Examples

- `G` `X` `50` `Enter` - Move 50 units along X
- `R` `Z` `45` `Enter` - Rotate 45° around Z axis
- `S` `2` `Enter` - Scale uniformly by 2×

---

## 🔧 Tools

| Action      | Shortcut | Description                  |
| ----------- | -------- | ---------------------------- |
| **Box**     | `B`      | Create default box primitive |
| **Sketch**  | `C`      | Enter sketch mode            |
| **Measure** | `M`      | Activate measure tool        |
| **Extrude** | `E`      | Extrude selected face/sketch |

---

## 👁️ View Presets

| View               | Shortcut | Alternative |
| ------------------ | -------- | ----------- |
| **Front**          | `1`      | `Ctrl+1`    |
| **Right**          | `3`      | `Ctrl+3`    |
| **Top**            | `7`      | `Ctrl+7`    |
| **Toggle Ortho**   | `5`      | `Ctrl+5`    |
| **Camera**         | `0`      | -           |
| **Focus Selected** | `.`      | -           |
| **Fit All (Home)** | `H`      | -           |

---

## 🔍 Zoom Controls

| Action   | Shortcut   | Description             |
| -------- | ---------- | ----------------------- |
| Zoom In  | `+` or `=` | Zoom in viewport        |
| Zoom Out | `-`        | Zoom out viewport       |
| Fit All  | `H`        | Fit all objects in view |

---

## ✏️ Sketch Mode Shortcuts

When in sketch mode, these additional shortcuts are available:

| Action         | Shortcut | Description               |
| -------------- | -------- | ------------------------- |
| Line Tool      | `L`      | Draw lines                |
| Rectangle      | `R`      | Draw rectangles           |
| Circle         | `C`      | Draw circles              |
| Arc            | `A`      | Draw 3-point arcs         |
| Spline         | `S`      | Draw spline curves        |
| **Horizontal** | `H`      | Constrain line horizontal |
| **Vertical**   | `V`      | Constrain line vertical   |
| Dimension      | `D`      | Add dimension constraint  |
| Exit Sketch    | `Escape` | Exit sketch mode          |

### Constraint Shortcuts

| Constraint | Shortcut | Description                   |
| ---------- | -------- | ----------------------------- |
| Horizontal | `H`      | Make selected line horizontal |
| Vertical   | `V`      | Make selected line vertical   |
| Dimension  | `D`      | Set length/radius value       |
| Fix        | `F`      | Fix point in place            |

---

## 📋 Quick Reference Card

```
╔══════════════════════════════════════════════════════════╗
║                  AMERI-CAD SHORTCUTS                      ║
╠══════════════════════════════════════════════════════════╣
║  FILE          TRANSFORM       VIEW          TOOLS       ║
║  ────          ─────────       ────          ─────       ║
║  Ctrl+S Save   G Grab          1 Front       B Box       ║
║  Ctrl+O Open   R Rotate        3 Right       C Sketch    ║
║  Ctrl+N New    S Scale         7 Top         E Extrude   ║
║                                5 Ortho       M Measure   ║
║  EDIT          ZOOM            H Home                    ║
║  ────          ────            . Focus                   ║
║  Ctrl+Z Undo   + Zoom In                                 ║
║  Ctrl+Y Redo   - Zoom Out                                ║
║  Delete Del    H Fit All                                 ║
║  Escape Cancel                                           ║
╠══════════════════════════════════════════════════════════╣
║  SKETCH MODE: L Line | R Rect | C Circle | A Arc        ║
║               H Horiz | V Vert | D Dimension            ║
╚══════════════════════════════════════════════════════════╝
```

---

## 🎮 Mouse Controls

| Action       | Input               | Description               |
| ------------ | ------------------- | ------------------------- |
| Select       | Left Click          | Select object/entity      |
| Multi-select | Shift + Left Click  | Add to selection          |
| Context Menu | Right Click         | Open context menu         |
| Orbit        | Middle Drag         | Rotate view around target |
| Pan          | Shift + Middle Drag | Move view laterally       |
| Zoom         | Scroll Wheel        | Zoom in/out               |
| Zoom Area    | Ctrl + Middle Drag  | Zoom to rectangle         |

---

## ⚙️ Customizing Shortcuts

Ameri-CAD supports customizable keymaps. Your customizations are saved to local storage.

### View Current Bindings

Press `:` and type:

```
help keymap
```

### Export Keymap

```javascript
// In browser console
keymapManager.exportKeymap();
```

### Import Keymap

```javascript
// In browser console
keymapManager.importKeymap(jsonString);
```

### Reset to Defaults

```javascript
// In browser console
keymapManager.reset();
```

---

## 💡 Tips for Efficiency

### Command Line Power User

1. Press `:` to open command line
2. Type commands directly: `box 50 30 20`
3. Use Tab for autocomplete
4. Press `↑` for command history

### Transform Tips

- **Type numbers directly** after starting a transform
- **Right-click** to cancel a transform
- **Enter** to confirm
- **Escape** to cancel and reset

### View Navigation

- **Numpad recommended** for view presets
- **Home (H)** is your friend - resets view to see everything
- **5 (Toggle Ortho)** helps with precise alignment

---

<div align="center">
  <em>Print this page for a handy reference! 🖨️</em>
</div>
