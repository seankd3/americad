# 🔄 Transforms

> Move, rotate, scale, mirror, and create patterns

---

## 🎮 Modal Transforms

### Grab (Move)

Move selected objects by a vector.

**Shortcut:** `G`

```bash
move <dx> [dy] [dz]
move 50 0 0        # Move 50mm along X
```

**Aliases:** `m`, `translate`, `mv`

---

### Rotate

Rotate selected objects around an axis.

**Shortcut:** `R`

```bash
rotate <angle> [axis] [center]
rotate 45 z        # Rotate 45° around Z
rotate 90 x        # Rotate 90° around X
```

**Aliases:** `rot`

---

### Scale

Scale selected objects uniformly or along axes.

**Shortcut:** `S`

```bash
scale <factor> [center]
scale 2            # Scale 2x uniformly
scale 0.5          # Scale to half size
```

**Aliases:** `sc`, `resize`

---

## 🪞 Mirror

Reflect objects across a plane.

```bash
mirror [plane] [keep]
mirror yz          # Mirror across YZ plane (X=0)
mirror xy          # Mirror across XY plane (Z=0)
mirror yz keep     # Mirror and keep original
```

**Aliases:** `mir`, `flip`

---

## 📋 Copy

Duplicate objects with optional offset.

```bash
copy [dx] [dy] [dz]
copy 50 0 0        # Copy 50mm along X
```

**Aliases:** `cp`, `duplicate`, `dup`

---

## 📊 Patterns

### Linear Pattern

Create an array along a direction.

```bash
pattern linear <count> <spacing> [axis]
pattern linear 5 20 x      # 5 copies, 20mm spacing, along X
```

---

### Circular Pattern

Create an array around an axis.

```bash
pattern circular <count> [angle] [axis]
pattern circ 6 360 z       # 6 copies, full circle around Z
```

---

## 🎯 Transform Reference

| Transform      | Shortcut | Command                |
| -------------- | -------- | ---------------------- |
| Move           | `G`      | `move dx dy dz`        |
| Rotate         | `R`      | `rotate angle axis`    |
| Scale          | `S`      | `scale factor`         |
| Mirror         | -        | `mirror plane`         |
| Copy           | -        | `copy dx dy dz`        |
| Linear Array   | -        | `pattern linear ...`   |
| Circular Array | -        | `pattern circular ...` |

---

## 🔗 Related

- [Primitives](primitives.md) - Create starting shapes
- [Operations](operations.md) - Boolean, fillet, chamfer
- [Keyboard Shortcuts](../keyboard-shortcuts.md) - All shortcuts
