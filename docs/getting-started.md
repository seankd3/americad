# 🎯 Getting Started

> Create your first part in 5 minutes!

This tutorial will guide you through creating a simple part using Ameri-CAD's core features.

---

## 📋 What You'll Learn

1. Create a basic box primitive
2. Add a fillet to round edges
3. Enter sketch mode and draw a circle
4. Extrude the sketch to create a hole
5. Export your part

---

## Step 1: Create a Box

Let's start by creating a simple box as our base.

### Using the Command Line

Press `:` to open the command line, then type:

```
box 100 50 25
```

This creates a box with:

- **Width (X):** 100mm
- **Height (Y):** 50mm
- **Depth (Z):** 25mm

### Using the Keyboard Shortcut

Alternatively, press `B` to create a default 10×10×10 box.

> 💡 **Tip:** The box is created centered at the origin (0, 0, 0).

---

## Step 2: Add a Fillet

Let's round all edges of the box to make it look more professional.

### Command

```
filletall 3
```

This applies a 3mm radius fillet to **all** edges of the selected box.

### Alternative: Fillet Specific Edges

1. Select specific edges by clicking on them
2. Run `fillet 5` for a 5mm radius on selected edges

> ⚠️ **Warning:** Large fillet radii may fail if they intersect. Start small and increase gradually.

---

## Step 3: Enter Sketch Mode

Now let's add a hole by sketching on the top face.

### Enter Sketch Mode

Press `C` or type:

```
sketch xy
```

This enters sketch mode on the XY plane. The viewport will show:

- A **grid** for alignment
- **Snap indicators** at key points
- **Blue construction lines** for the plane

### Draw a Circle

1. Type `circle` or press the circle tool button
2. Click at position (30, 0) to set the center
3. Drag outward and click at radius 10mm

Or use the command:

```
circle
```

Then click to place a circle with 10mm radius.

### Add a Dimension Constraint

Select the circle and constrain its radius:

```
radius 8
```

This sets the circle radius to exactly 8mm.

---

## Step 4: Extrude the Sketch

Now let's cut the circle through the box to create a hole.

### Exit Sketch Mode

Press `Escape` or type:

```
exit
```

### Extrude (Cut)

With the sketch profile selected:

```
extrude -30
```

The **negative value** cuts through the material (boolean subtract).

A positive value would add material (boolean union).

> 💡 **Tip:** Use `extrude 30` on an external sketch to add a boss/protrusion.

---

## Step 5: Export Your Part

Your part is complete! Let's export it.

### Export to STEP (CAD Exchange)

```
export step mypart
```

Downloads `mypart.step` - perfect for sharing with other CAD software.

### Export to STL (3D Printing)

```
export stl mypart
```

Downloads `mypart.stl` - ready for your 3D printer slicer.

### Check Export Stats

Before exporting, see the mesh statistics:

```
stl stats
```

Shows triangle count, file size estimate, and bounding box.

---

## 🎉 Congratulations!

You've created your first parametric part! Here's what you learned:

| Feature      | Command         | Shortcut |
| ------------ | --------------- | -------- |
| Create box   | `box 100 50 25` | `B`      |
| Fillet all   | `filletall 3`   | -        |
| Enter sketch | `sketch xy`     | `C`      |
| Draw circle  | `circle`        | -        |
| Exit sketch  | `exit`          | `Escape` |
| Extrude      | `extrude -30`   | `E`      |
| Export STEP  | `export step`   | `Ctrl+S` |

---

## 🚀 What's Next?

### Try These Challenges

1. **Add more holes** - Create a bolt pattern with `pattern circular`
2. **Create a pocket** - Sketch a rectangle and extrude negatively
3. **Add chamfers** - Use `chamfer 2` on select edges
4. **Mirror the part** - Use `mirror yz keep` for symmetry

### Explore More Features

- [📦 Primitives](features/primitives.md) - All basic shapes
- [✏️ Sketching](features/sketching.md) - Complete sketch reference
- [⚙️ Operations](features/operations.md) - Boolean and features
- [⌨️ Keyboard Shortcuts](keyboard-shortcuts.md) - Work faster

---

## 💡 Pro Tips

### Navigation

| Action      | Mouse               | Keys      |
| ----------- | ------------------- | --------- |
| Rotate view | Middle drag         | -         |
| Pan view    | Shift + Middle drag | -         |
| Zoom        | Scroll wheel        | `+` / `-` |
| Fit all     | -                   | `H`       |
| Front view  | -                   | `1`       |
| Top view    | -                   | `7`       |

### Quick Commands

| Action    | Shortcut       |
| --------- | -------------- |
| Undo      | `Ctrl+Z`       |
| Redo      | `Ctrl+Shift+Z` |
| Delete    | `Delete`       |
| Cancel    | `Escape`       |
| Grab/Move | `G`            |
| Rotate    | `R`            |
| Scale     | `S`            |

---

<div align="center">
  <strong>Happy modeling! 🛠️</strong>
</div>
