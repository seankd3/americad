# 📦 Primitives

> Create solid bodies from basic geometric shapes

Primitives are the building blocks of 3D modeling. Ameri-CAD provides six fundamental primitives that can be combined, modified, and refined into complex parts.

---

## 🔲 Box

Create rectangular boxes (cuboids) with specified dimensions.

### Command

```
box <width> [height] [depth]
box 100 50 25
```

### Parameters

| Parameter | Type   | Default    | Description  |
| --------- | ------ | ---------- | ------------ |
| width     | number | _required_ | X dimension  |
| height    | number | width      | Y dimension  |
| depth     | number | width      | Z dimension  |
| center    | point  | (0,0,0)    | Center point |

### Keyboard Shortcut

`B` - Creates a default 10×10×10 box

### Examples

```bash
# 100mm cube
box 100

# Rectangular box
box 100 50 25

# Thin plate
box 200 200 5
```

### Aliases

`cube`, `block`

> 💡 **Tip:** Omit height and depth to create a perfect cube. `box 50` creates a 50×50×50 cube.

---

## 🔵 Sphere

Create perfect spheres with specified radius.

### Command

```
sphere <radius>
sphere 25
```

### Parameters

| Parameter | Type   | Default    | Description   |
| --------- | ------ | ---------- | ------------- |
| radius    | number | _required_ | Sphere radius |
| center    | point  | (0,0,0)    | Center point  |

### Examples

```bash
# 25mm radius sphere
sphere 25

# Small bearing ball
sphere 3
```

### Aliases

`ball`

> 💡 **Tip:** Spheres are created with smooth tessellation. Higher resolution is used for larger spheres.

---

## ⬤ Cylinder

Create cylindrical shapes with specified radius and height.

### Command

```
cylinder <radius> <height>
cylinder 15 50
```

### Parameters

| Parameter | Type   | Default    | Description       |
| --------- | ------ | ---------- | ----------------- |
| radius    | number | _required_ | Cylinder radius   |
| height    | number | _required_ | Cylinder height   |
| center    | point  | (0,0,0)    | Base center point |

### Examples

```bash
# Standard cylinder
cylinder 15 50

# Thin rod
cylinder 2 100

# Disc/puck
cylinder 30 5
```

### Aliases

`cyl`, `tube`

> 💡 **Tip:** The cylinder is created with its base at the center point, extending upward along Z.

---

## 📐 Cone

Create conical shapes with base radius, top radius, and height.

### Command

```
cone <baseRadius> [topRadius] <height>
cone 20 0 40
cone 20 10 40
```

### Parameters

| Parameter | Type   | Default    | Description              |
| --------- | ------ | ---------- | ------------------------ |
| radius1   | number | _required_ | Base radius              |
| radius2   | number | 0          | Top radius (0 for point) |
| height    | number | _required_ | Cone height              |
| center    | point  | (0,0,0)    | Base center point        |

### Examples

```bash
# Pointed cone
cone 20 0 40

# Truncated cone (frustum)
cone 20 10 40

# Inverted cone
cone 10 20 30
```

> 💡 **Tip:** Set `radius2` to 0 for a pointed cone, or to a smaller value for a truncated cone (frustum).

---

## 🍩 Torus

Create torus (donut) shapes with major and minor radius.

### Command

```
torus <majorRadius> <minorRadius>
torus 30 10
```

### Parameters

| Parameter   | Type   | Default    | Description                         |
| ----------- | ------ | ---------- | ----------------------------------- |
| majorRadius | number | _required_ | Distance from center to tube center |
| minorRadius | number | _required_ | Tube radius                         |
| center      | point  | (0,0,0)    | Center point                        |

### Examples

```bash
# Standard donut
torus 30 10

# O-ring
torus 25 3

# Fat torus
torus 20 15
```

### Aliases

`donut`, `ring`

> ⚠️ **Warning:** Minor radius must be less than major radius. `torus 10 15` will fail.

---

## 🔺 Wedge

Create wedge (tapered box) shapes.

### Command

```
wedge <dx> <dy> <dz> [ltx]
wedge 40 30 50
wedge 40 30 50 10
```

### Parameters

| Parameter | Type   | Default    | Description          |
| --------- | ------ | ---------- | -------------------- |
| dx        | number | _required_ | X dimension (base)   |
| dy        | number | _required_ | Y dimension (height) |
| dz        | number | _required_ | Z dimension (depth)  |
| ltx       | number | 0          | Top X dimension      |

### Examples

```bash
# Standard wedge (tapers to edge)
wedge 40 30 50

# Truncated wedge
wedge 40 30 50 10

# Ramp
wedge 100 20 50 0
```

> 💡 **Tip:** Wedges are useful for ramps, tapered features, and bracket shapes.

---

## 📊 Primitive Comparison

| Primitive | Min Params | Use Case                             |
| --------- | ---------- | ------------------------------------ |
| Box       | 1          | Enclosures, plates, structural parts |
| Sphere    | 1          | Knobs, balls, rounded features       |
| Cylinder  | 2          | Shafts, rods, tubes, pins            |
| Cone      | 2          | Tapered features, points             |
| Torus     | 2          | O-rings, handles, rims               |
| Wedge     | 3          | Ramps, brackets, tapered blocks      |

---

## 🔗 Related

- [Operations](operations.md) - Boolean, fillet, chamfer
- [Transforms](transforms.md) - Move, rotate, scale
- [Getting Started](../getting-started.md) - Tutorial

---

## 💡 Tips & Best Practices

### Choosing the Right Primitive

1. **Start simple** - Use the simplest primitive that gets you closest
2. **Think parametric** - Choose dimensions that make sense to edit later
3. **Consider operations** - Some shapes are easier to achieve with operations

### Creating Composite Shapes

Combine primitives using boolean operations:

```bash
# Create main body
box 100 50 30

# Create cylinder for hole
cylinder 10 40

# Position cylinder
move 25 0 0

# Subtract to create hole
subtract
```

### Performance

- Primitives are lightweight and fast to create
- Boolean operations add complexity
- Use patterns instead of many separate primitives
