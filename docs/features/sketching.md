# ✏️ Sketching

> Professional 2D sketch mode with geometric and dimensional constraints

Sketch mode allows you to draw 2D profiles that can be extruded, revolved, or swept into 3D geometry.

---

## 🚀 Quick Start

### Enter Sketch Mode

```bash
sketch [plane]
sketch xy    # Sketch on XY plane (default)
sketch xz    # Sketch on XZ plane
sketch yz    # Sketch on YZ plane
```

**Shortcut:** `C`

### Exit Sketch Mode

```bash
exit
```

**Shortcut:** `Escape`

---

## 📐 Drawing Tools

### Line Tool

Draw straight lines between points.

```bash
line
```

**Shortcut:** `L`

---

### Rectangle Tool

Draw rectangles by corner points.

```bash
rect
```

**Shortcut:** `R`

**Aliases:** `rectangle`

---

### Circle Tool

Draw circles by center and radius.

```bash
circle
```

**Shortcut:** `C` (in sketch mode)

**Aliases:** `cir`

---

### Arc Tool

Draw three-point arcs.

```bash
arc
```

**Shortcut:** `A`

---

### Spline Tool

Draw smooth curves through control points.

```bash
spline
```

**Shortcut:** `S`

**Aliases:** `sp`, `curve`, `bezier`

---

## 🔒 Constraints

### Horizontal Constraint

Make a line perfectly horizontal.

```bash
h
```

**Shortcut:** `H` (with line selected)

---

### Vertical Constraint

Make a line perfectly vertical.

```bash
v
```

**Shortcut:** `V` (with line selected)

---

### Dimension Constraint

Set exact length or radius values.

```bash
dimension <value>
dim 50
```

**Shortcut:** `D` (with entity selected)

---

### Length Constraint

Set exact length on a line.

```bash
length <value>
len 25
```

---

### Radius Constraint

Set exact radius on a circle.

```bash
radius <value>
rad 15
```

---

### Fixed Constraint

Fix points in place.

```bash
lock
```

---

## 📊 Constraint Status

Check the constraint status:

```bash
status
```

| Status            | Meaning         | Color     |
| ----------------- | --------------- | --------- |
| Under-constrained | Can still move  | 🟡 Yellow |
| Fully constrained | Locked in place | 🟢 Green  |
| Over-constrained  | Conflicts exist | 🔴 Red    |

---

## 📍 Snap System

```bash
snap on           # Enable all snapping
snap off          # Disable all snapping
snap grid 10      # Set grid size to 10mm
snap point on     # Enable endpoint snap
snap midpoint on  # Enable midpoint snap
snap center on    # Enable center snap
```

### Snap Types

| Type             | Description                |
| ---------------- | -------------------------- |
| **Grid**         | Snap to grid intersections |
| **Endpoint**     | Snap to line ends          |
| **Midpoint**     | Snap to line centers       |
| **Center**       | Snap to circle/arc centers |
| **Intersection** | Snap where entities cross  |

---

## 🔄 Extrude

Transform your sketch into 3D geometry.

```bash
extrude <height>
extrude 20        # Extrude 20mm up
extrude -10       # Cut 10mm down
```

**Shortcut:** `E`

---

## 🔄 Revolve

Create rotational parts like a lathe.

```bash
revolve [angle] [axis]
revolve 360       # Full revolution
revolve 90 y      # Quarter turn around Y
```

**Aliases:** `rev`, `spin`, `lathe`

---

## 🔗 Related

- [Operations](operations.md) - Extrude, revolve, sweep
- [Transforms](transforms.md) - Move, rotate, scale
- [Primitives](primitives.md) - Pre-made 3D shapes
