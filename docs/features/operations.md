# ⚙️ Operations

> Boolean operations, edge treatments, and advanced features

---

## 🔶 Boolean Operations

### Union (Add)

Combine multiple shapes into one solid.

```bash
union
```

**Aliases:** `add`, `join`, `fuse`

---

### Subtract (Cut)

Remove one shape from another.

```bash
subtract
```

**Aliases:** `sub`, `cut`, `difference`

---

### Intersect (Common)

Keep only the overlapping region.

```bash
intersect
```

**Aliases:** `int`, `common`

---

## 🔘 Edge Treatments

### Fillet

Round edges with a specified radius.

```bash
fillet <radius>
fillet 5           # 5mm radius on selected edges
```

### Fillet All Edges

```bash
filletall <radius>
filletall 3        # 3mm radius on all edges
```

---

### Chamfer

Bevel edges at a 45° angle.

```bash
chamfer <distance>
chamfer 3          # 3mm chamfer on selected edges
```

### Chamfer All Edges

```bash
chamferall <distance>
chamferall 2       # 2mm chamfer on all edges
```

---

## 📐 Feature Operations

### Extrude

Push/pull a profile or face into 3D.

```bash
extrude <distance> [direction]
extrude 20         # Extrude 20mm along normal
extrude -10        # Cut 10mm
```

**Shortcut:** `E`

---

### Revolve

Spin a profile around an axis.

```bash
revolve [angle] [axis]
revolve 360        # Full revolution
revolve 180 y      # Half turn around Y
```

---

### Sweep

Extrude a profile along a path.

```bash
sweep [profileId] [pathId]
```

**Path Creation:**

```bash
path-line 0 0 0 100 0 50     # Straight line path
path-arc ...                   # Arc path
path-helix 10 5 50            # Helix path
```

---

### Shell

Hollow out a solid with uniform wall thickness.

```bash
shell <thickness> [faceToRemove]
shell 2             # 2mm walls, remove largest face
shell 2 top         # 2mm walls, remove top face
shell 2 none        # 2mm walls, closed shell
```

---

### Draft

Apply draft angle for manufacturing.

```bash
draft <angle> [direction]
draft 3             # 3° draft, Z pull direction
draft 5 x           # 5° draft, X pull direction
```

---

### Loft

Create smooth transitions between profiles.

```bash
loft
```

Select two or more profiles, then execute.

---

## 🔍 Analysis Operations

### Get Edges

List all edge IDs for a shape.

```bash
getedges [shapeId]
```

---

### Get Faces

List all face IDs for a shape.

```bash
getfaces [shapeId]
```

---

### Interference Check

Detect overlapping bodies.

```bash
interference
```

---

## 🔗 Related

- [Primitives](primitives.md) - Starting shapes
- [Sketching](sketching.md) - 2D profiles
- [Transforms](transforms.md) - Move, rotate, patterns
