# 📐 Ameri-CAD Documentation

> Professional parametric CAD combining Fusion 360's precision with Blender's architecture

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Sean-Kenneth-Doherty/americad)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-web-orange.svg)](https://americad.app)

---

## 🚀 Quick Links

| Section                                        | Description                               |
| ---------------------------------------------- | ----------------------------------------- |
| [🎯 Getting Started](getting-started.md)       | Create your first part in 5 minutes       |
| [⌨️ Keyboard Shortcuts](keyboard-shortcuts.md) | Complete shortcut reference               |
| [🔲 Primitives](features/primitives.md)        | Box, sphere, cylinder, cone, torus, wedge |
| [✏️ Sketching](features/sketching.md)          | 2D sketch mode with constraints           |
| [⚙️ Operations](features/operations.md)        | Boolean, fillet, chamfer, shell, draft    |
| [🔄 Transforms](features/transforms.md)        | Move, rotate, scale, patterns             |
| [💾 File I/O](features/io.md)                  | Save, load, export STEP/STL               |
| [🖥️ User Interface](features/ui.md)            | Feature tree, property panel, tools       |

---

## 🎨 Feature Overview

### Primitives

Create solid bodies from basic shapes:

- **Box** - Rectangular prisms with customizable dimensions
- **Sphere** - Perfect spheres with radius control
- **Cylinder** - Circular prisms with radius and height
- **Cone** - Conical shapes with base/top radius
- **Torus** - Donut shapes with major/minor radius
- **Wedge** - Tapered rectangular shapes

### Sketch Mode

Professional 2D sketching with:

- Lines, rectangles, circles, arcs, splines
- Geometric constraints (horizontal, vertical)
- Dimensional constraints (length, radius)
- Snap system with grid, endpoint, midpoint support
- Degrees of freedom analysis

### Operations

Transform sketches and solids into complex parts:

- **Extrude** - Push/pull profiles into 3D
- **Revolve** - Spin profiles around an axis (lathe)
- **Sweep** - Extrude along a path
- **Boolean** - Union, subtract, intersect operations
- **Fillet** - Round edges with specified radius
- **Chamfer** - Bevel edges at an angle
- **Shell** - Hollow out solids
- **Draft** - Apply manufacturing draft angles

### Patterns

Replicate features efficiently:

- **Linear Pattern** - Array along a direction
- **Circular Pattern** - Array around an axis
- **Mirror** - Reflect across a plane

### Export

Industry-standard output formats:

- **STEP** - CAD exchange format
- **STL** - 3D printing ready

---

## 🏗️ Architecture

Ameri-CAD is built on a modern, modular architecture:

```
┌─────────────────────────────────────────────────┐
│                  User Interface                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐│
│  │ Command │ │ Feature │ │ Property│ │Viewport││
│  │  Line   │ │  Tree   │ │  Panel  │ │ (3D)   ││
│  └─────────┘ └─────────┘ └─────────┘ └────────┘│
├─────────────────────────────────────────────────┤
│               Command System                     │
│         Parametric • Undoable • Scriptable      │
├─────────────────────────────────────────────────┤
│             Document Model                       │
│     Feature Tree • Dependencies • Constraints    │
├─────────────────────────────────────────────────┤
│            Geometry Kernel (Manifold)            │
│       B-Rep Operations • Mesh Generation        │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Design Philosophy

1. **Parametric First** - Every dimension is editable, every feature can be modified
2. **Blender-Inspired UX** - Modal transforms (G/R/S), command line, keyboard-driven
3. **Professional Quality** - STEP export, constraint solver, manufacturing features
4. **Web Native** - Runs in your browser, no installation required

---

## 📖 Documentation Structure

```
docs/
├── README.md               # This file
├── getting-started.md      # Quick start tutorial
├── keyboard-shortcuts.md   # Complete shortcut reference
├── features/
│   ├── primitives.md       # Primitive shapes
│   ├── sketching.md        # 2D sketch mode
│   ├── operations.md       # Boolean, features
│   ├── transforms.md       # Move, rotate, patterns
│   ├── io.md               # Save, load, export
│   └── ui.md               # Interface components
└── images/
    └── (screenshots)
```

---

## 🤝 Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on contributing to Ameri-CAD.

---

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details.

---

<div align="center">
  <strong>Built with ❤️ for makers, engineers, and designers</strong>
</div>
