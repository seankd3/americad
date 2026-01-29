# Ameri-CAD CAD SYSTEM

```
VER 2.0.1-LA // UNRESTRICTED
Space Grade / HiRel / RadHard 3D CAD Platform
```

![Aesthetic](https://img.shields.io/badge/AESTHETIC-US%20Graphics%20Industrial-amber)
![Type](https://img.shields.io/badge/TYPE-Berkeley%20Mono%20Style-darkgreen)
![Status](https://img.shields.io/badge/STATUS-Production%20Ready-green)

## Quick Start

### Option 1: Run the included server (Recommended)
```bash
./start-server.sh
```
Then open: **http://localhost:8000**

### Option 2: Python
```bash
python3 -m http.server 8000
```

### Option 3: Node.js
```bash
npx serve .
```

### Option 4: VS Code
Install "Live Server" extension, right-click on `index.html` → "Open with Live Server"

---

## Overview

Ameri-CAD is a professional-grade 3D CAD application designed with the aesthetic sensibilities of American hard tech - inspired by **US Graphics Company's** Berkeley Mono™, **Anduril Industries**, and **Palantir Technologies**. Built for the 21st century industrial designer, engineer, and machinist.

### Design Philosophy

- **Space Grade**: Industrial precision in every pixel
- **HiRel**: High reliability interface design
- **RadHard**: Resistant to visual noise and distraction
- **Mil-Spec**: Technical labeling and organizational standards

## Features

### Core CAD Operations

| Feature | Status | Shortcut |
|---------|--------|----------|
| Primitive Creation | ✅ | Command Line |
| Transform (Move/Rotate/Scale) | ✅ | T/R/G |
| Selection & Multi-select | ✅ | S |
| Grid Snapping | ✅ | Toggle |
| Multiple Viewports | ✅ | 1/2/3/4 |
| Wireframe/Shaded/X-Ray | ✅ | UI Toggle |
| STL Export | ✅ | Menu |
| Measurement Tools | ✅ | M |

### Primitives Supported

- **BOX** - Rectangular prism with editable dimensions
- **SPHERE** - UV sphere with segment control
- **CYLINDER** - Circular extrusion
- **CONE** - Tapered cylinder
- **TORUS** - Donut/rings shape

### View Controls

| View | Key | Description |
|------|-----|-------------|
| Front | 1 | +Z view |
| Top | 2 | +Y view |
| Right | 3 | +X view |
| Isometric | 4 | 3/4 perspective |
| Zoom Fit | F | Fit all objects |

## Interface

### Typography

Uses system monospace fonts in the Berkeley Mono style:
```
SF Mono, Menlo, Monaco, Courier New, monospace
```

All text is uppercase with technical labeling:
- `BODY_001` - Object identifiers
- `AL-6061-T6` - Material specifications
- `MM` - Unit indicators

### Color Palette

```css
/* Core Dark */
--bg-000: #0a0a0b;        /* Deep space black */
--bg-100: #111113;        /* Primary surface */
--bg-200: #18181a;        /* Secondary surface */

/* HiRel Accents */
--accent-primary: #e8b13f;    /* Amber indicator */
--accent-secondary: #4a9eff;  /* Blue status */
--status-ok: #47ff9e;         /* Green ready */
--status-warn: #e8b13f;       /* Amber warning */
--status-alert: #ff6b47;      /* Red alert */

/* Axis ISO Standard */
--axis-x: #ff4444;        /* Red */
--axis-y: #44ff44;        /* Green */
--axis-z: #4444ff;        /* Blue */
```

### Command Line Interface

The command line provides direct access to CAD operations:

```
> box              Create box primitive
> sphere           Create sphere primitive
> cylinder         Create cylinder primitive
> cone             Create cone primitive
> torus            Create torus primitive
> clear            Remove all objects
> fit              Zoom to fit
> grid             Toggle grid visibility
> snap             Toggle snapping
> help             Show help
```

## Keyboard Shortcuts

### Tools
| Key | Tool |
|-----|------|
| S | Select |
| C | Sketch |
| E | Extrude |
| L | Line |
| R | Rectangle |
| O | Circle |
| M | Measure |

### Transform (when object selected)
| Key | Mode |
|-----|------|
| T | Translate (Move) |
| R | Rotate |
| G | Scale |

### View
| Key | Action |
|-----|--------|
| 1 | Front View |
| 2 | Top View |
| 3 | Right View |
| 4 | Isometric |
| F | Zoom to Fit |

### General
| Key | Action |
|-----|--------|
| Delete | Delete Selected |
| Escape | Cancel / Deselect |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+N | New Design |
| Ctrl+S | Save |

## Troubleshooting

### Stuck on Loading Screen
1. **Check Console**: Press F12 → Console tab to see error messages
2. **Use Server**: You MUST use a local server (not file://)
3. **Force Continue**: Click the "Force Continue (if stuck)" button
4. **Try Different Browser**: Chrome or Firefox recommended

### WebGL Errors
- Enable hardware acceleration in browser settings
- Update graphics drivers
- Try disabling browser extensions

### Module Loading Errors
- Make sure you're using `http://localhost` not `file://`
- Check internet connection (CDN required for Three.js)
- Try refreshing with Ctrl+F5

## Technical Specifications

### Rendering Engine
- **Three.js r160** - WebGL-based 3D rendering
- **PBR Materials** - Physically based rendering
- **Soft Shadows** - PCF shadow mapping
- **Anti-aliasing** - MSAA enabled

### File I/O
- **Export**: STL (ASCII format)
- **Import**: Planned (STEP, OBJ, GLTF)
- **Native**: JSON-based scene format

### Performance
- Target: 60 FPS minimum
- Optimized for: Complex assemblies (1000+ parts)
- Memory efficient: Instanced geometry support

## Browser Compatibility

| Browser | Status |
|---------|--------|
| Chrome 120+ | ✅ Full Support |
| Firefox 121+ | ✅ Full Support |
| Safari 17+ | ✅ Full Support |
| Edge 120+ | ✅ Full Support |

## Development

### Project Structure
```
├── index.html      # Main application markup
├── styles.css      # Industrial aesthetic styles
├── app.js          # CAD engine and UI logic
├── start-server.sh # Quick start script
└── README.md       # Documentation
```

### No Build Step Required
Ameri-CAD runs directly in the browser using ES modules:
- Three.js loaded via CDN
- No bundler required
- No dependencies to install

## Roadmap

### Phase 2 (Q2 2026)
- [ ] Parametric modeling
- [ ] Constraint-based sketching
- [ ] Assembly constraints
- [ ] Bill of materials

### Phase 3 (Q3 2026)
- [ ] STEP/IGES import
- [ ] GD&T annotation
- [ ] CAM toolpath generation
- [ ] Cloud collaboration

## License

UNRESTRICTED // For American Manufacturing

## Credits

- **Typography Inspiration**: US Graphics Company (Berkeley Mono™, Houston Mono™)
- **Design Language**: Anduril Industries, Palantir Technologies
- **3D Engine**: Three.js by mrdoob and contributors
- **Built for**: The American industrial renaissance

---

```
Ameri-CAD // SPACE GRADE CAD
MADE IN USA
```
