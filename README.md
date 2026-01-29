# Ameri-CAD

<div align="center">

```
███████╗ ███╗   ███╗ ███████╗ ██████╗  ██╗       ██████╗  █████╗  ██████╗ 
██╔══██║ ████╗ ████║ ██╔════╝ ██╔══██╗ ██║      ██╔════╝ ██╔══██╗ ██╔══██╗
███████║ ██╔████╔██║ █████╗   ██████╔╝ ██║ ████ ██║      ███████║ ██║  ██║
██╔══██║ ██║╚██╔╝██║ ██╔══╝   ██╔══██╗ ██║      ██║      ██╔══██║ ██║  ██║
██║  ██║ ██║ ╚═╝ ██║ ███████╗ ██║  ██║ ██║      ╚██████╗ ██║  ██║ ██████╔╝
╚═╝  ╚═╝ ╚═╝     ╚═╝ ╚══════╝ ╚═╝  ╚═╝ ╚═╝       ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ 
```

**VER 2.2.0-LA // UNRESTRICTED**

*Space Grade / HiRel / RadHard 3D CAD Platform*

[![Status](https://img.shields.io/badge/STATUS-Production%20Ready-green)](.)
[![License](https://img.shields.io/badge/LICENSE-UNRESTRICTED-blue)](.)
[![Kernel](https://img.shields.io/badge/KERNEL-OpenCASCADE%207.x-amber)](.)

</div>

---

## Overview

Ameri-CAD is a **professional-grade browser-based 3D CAD application** built with a real parametric modeling kernel. Unlike typical web CAD tools that only offer mesh manipulation, Ameri-CAD uses **OpenCASCADE.js** to provide true B-Rep (Boundary Representation) geometry — the same technology used in industrial CAD systems like FreeCAD, Fusion 360, and SolidWorks.

### Key Features

- **Real B-Rep Kernel** — OpenCASCADE.js running in a Web Worker for non-blocking geometry operations
- **Parametric Feature Tree** — Edit parameters at any point; downstream features automatically regenerate
- **Boolean Operations** — Union, subtract, intersect with proper solid modeling
- **Edge Features** — Fillet and chamfer with radius/distance control
- **STEP Export** — ISO 10303-21 AP214 format for CAD interoperability
- **Native File Format** — `.americad` files store the parametric history, not just geometry
- **Sketch Mode** — 2D drawing with constraints on XY/XZ/YZ planes
- **Industrial UI** — Inspired by US Graphics Company, Anduril, and Palantir design language

---

## Quick Start

### Option 1: Included Server (Recommended)
```bash
cd americad
./start-server.sh
# Open http://localhost:8000
```

### Option 2: Python
```bash
python3 -m http.server 8000
```

### Option 3: Node.js
```bash
npx serve .
```

> ⚠️ **Important:** You must serve the files via HTTP. Opening `index.html` directly via `file://` will not work due to CORS restrictions on Web Workers and ES modules.

---

## Screenshots

> 📸 **Screenshot Suggestions:**
> - Main viewport with a box and feature tree visible
> - Boolean operation result (union of box + cylinder)
> - Sketch mode with rectangle on XY plane
> - STEP export dialog / exported file in another CAD app

---

## Primitives

| Primitive | Command | Parameters |
|-----------|---------|------------|
| **Box** | `box 20 30 10` | width, height, depth |
| **Sphere** | `sphere 15` | radius |
| **Cylinder** | `cylinder 8 20` | radius, height |
| **Cone** | `cone 10 16` | radius, height |
| **Torus** | `torus 10 3` | major radius, minor radius |
| **Wedge** | `wedge 20 10 30` | dx, dy, dz |

All primitives are created as true B-Rep solids via the OpenCASCADE kernel.

---

## Boolean Operations

```
# Select two bodies, then:
union       # Combine shapes
subtract    # Cut tool from target
intersect   # Keep only overlap
```

Boolean operations create new features in the parametric tree. The original bodies can be hidden or deleted.

---

## Keyboard Shortcuts

### Tools
| Key | Action |
|-----|--------|
| `S` | Select tool |
| `C` | Enter sketch mode |
| `L` | Line tool (in sketch) |
| `R` | Rectangle tool (in sketch) |
| `O` | Circle tool (in sketch) |
| `M` / `T` | Move (translate) |

### Transform (with object selected)
| Key | Mode |
|-----|------|
| `T` | Translate |
| `R` | Rotate |
| `G` | Scale |

### View
| Key | View |
|-----|------|
| `1` | Front |
| `2` | Top |
| `3` | Right |
| `4` | Isometric |
| `F` | Zoom to fit |

### General
| Key | Action |
|-----|--------|
| `Ctrl+S` | Save document |
| `Ctrl+O` | Open document |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Delete` | Delete selected |
| `Escape` | Deselect / Cancel |
| `` ` `` | Focus command line |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        UI LAYER                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Three.js │  │ Feature  │  │ Command  │  │ Sketch   │    │
│  │ Viewport  │  │   Tree   │  │   Line   │  │ Renderer │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   APPLICATION LAYER                         │
│  ┌──────────────────┐  ┌───────────────────────────────┐   │
│  │    AmericaD      │  │       DocumentModel           │   │
│  │  (Main Class)    │  │   (Parametric Feature DAG)    │   │
│  └──────────────────┘  └───────────────────────────────┘   │
│  ┌──────────────────┐  ┌───────────────────────────────┐   │
│  │    Evaluator     │  │      History/Commands         │   │
│  │ (Rebuild Engine) │  │       (Undo/Redo)            │   │
│  └──────────────────┘  └───────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ (async messages)
┌──────────────────────────▼──────────────────────────────────┐
│                    KERNEL LAYER                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Web Worker (worker.js)                   │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │           OpenCASCADE.js (WASM)                │  │  │
│  │  │  • BRepPrimAPI (primitives)                    │  │  │
│  │  │  • BRepAlgoAPI (booleans)                      │  │  │
│  │  │  • BRepFilletAPI (fillet/chamfer)              │  │  │
│  │  │  • BRepMesh (tessellation)                     │  │  │
│  │  │  • STEPControl (STEP export)                   │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

For detailed architecture documentation, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/americad.git
   cd americad
   ```

2. **Install dependencies** (optional, for development tools)
   ```bash
   npm install
   ```

3. **Start the dev server**
   ```bash
   ./start-server.sh
   # or
   python3 -m http.server 8000
   ```

4. **Open in browser**
   Navigate to `http://localhost:8000`

### Project Structure

```
americad/
├── index.html          # Main HTML entry point
├── app.js              # Main application (Three.js, UI, events)
├── src/
│   ├── main.js         # AmericaD class (unified API)
│   ├── core/           # Math, transforms, command registry
│   ├── state/          # DocumentModel, selection, history
│   ├── kernel/         # OpenCASCADE bridge and worker
│   ├── ui/             # Feature tree, command line
│   ├── commands/       # Primitive, boolean, export commands
│   ├── sketch/         # 2D sketch manager and renderer
│   └── io/             # File format, STL export
├── lib/
│   └── opencascade/    # OpenCASCADE.js WASM build
├── docs/               # Documentation
└── tests/              # Test suite
```

---

## Documentation

- [User Guide](docs/USER_GUIDE.md) — Getting started, UI overview, workflows
- [Architecture](docs/ARCHITECTURE.md) — System design, data flow, key classes
- [API Reference](docs/API.md) — Public API, kernel methods, events
- [Contributing](docs/CONTRIBUTING.md) — Development setup, code style, PR process

---

## File Format

Ameri-CAD uses a native `.americad` JSON format that stores the **parametric feature tree**, not raw geometry:

```json
{
  "version": "1.0",
  "name": "My Design",
  "features": [
    {
      "id": "feature_1",
      "type": "box",
      "params": { "width": 20, "height": 20, "depth": 20 },
      "dependencies": []
    },
    {
      "id": "feature_2", 
      "type": "cylinder",
      "params": { "radius": 5, "height": 30 },
      "dependencies": []
    },
    {
      "id": "feature_3",
      "type": "boolean_subtract",
      "dependencies": ["feature_1", "feature_2"]
    }
  ]
}
```

When loaded, the geometry is regenerated from the feature tree via the kernel.

---

## Export Formats

| Format | Extension | Use Case |
|--------|-----------|----------|
| **STEP** | `.step` | CAD interoperability (ISO 10303-21, AP214) |
| **STL** | `.stl` | 3D printing (ASCII or binary) |
| **AmericaD** | `.americad` | Native parametric format |

---

## Browser Compatibility

| Browser | Status |
|---------|--------|
| Chrome 120+ | ✅ Full Support |
| Firefox 121+ | ✅ Full Support |
| Safari 17+ | ✅ Full Support |
| Edge 120+ | ✅ Full Support |

Requires WebGL 2.0 and WebAssembly support.

---

## Roadmap

### Current (v2.2)
- ✅ B-Rep kernel integration
- ✅ Parametric feature tree
- ✅ Boolean operations
- ✅ Fillet/chamfer
- ✅ STEP export
- ✅ Native file format
- ✅ 2D sketch mode

### Next (v2.3)
- [ ] Constraint solver for sketches
- [ ] Pattern features (linear, circular)
- [ ] Assembly mode
- [ ] STEP import

### Future
- [ ] GD&T annotations
- [ ] CAM toolpath generation
- [ ] Cloud collaboration

---

## Credits

- **Geometry Kernel**: [OpenCASCADE.js](https://github.com/nicholasmccormick/opencascade.js) by nicholasmccormick
- **3D Rendering**: [Three.js](https://threejs.org/) by mrdoob and contributors
- **Design Inspiration**: US Graphics Company, Anduril Industries, Palantir Technologies

---

## License

**UNRESTRICTED** // For American Manufacturing

---

<div align="center">

```
Ameri-CAD // SPACE GRADE CAD
MADE IN USA
```

</div>
