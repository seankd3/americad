# Ameri-CAD - AI Agent Documentation

## Project Overview

Ameri-CAD is a professional 3D CAD (Computer-Aided Design) web application built with Three.js. It provides a browser-based 3D modeling environment inspired by Fusion 360, featuring tools for creating primitives, sketching, transforming objects, and navigating 3D space.

**Key Characteristics:**
- Pure frontend application with no backend dependencies
- Single-page application (SPA) architecture
- No build process or package manager required
- Runs entirely in modern web browsers with WebGL support

---

## Technology Stack

| Component | Technology | Version/Notes |
|-----------|------------|---------------|
| 3D Engine | Three.js | v0.160.0 (via CDN) |
| Language | JavaScript | ES6+ Modules |
| Styling | CSS3 | CSS Variables for theming |
| Icons | Font Awesome | 6.4.0 |
| Font | Inter | Google Fonts |
| Module Loading | Import Maps | Native browser support |

---

## File Structure

```
├── index.html      # Main HTML structure - defines the entire UI layout
├── styles.css      # Complete styling (~1650 lines) with CSS variables
├── app.js          # Application logic (~1300 lines) - main entry point
└── README.md       # User-facing documentation
```

**No configuration files** (no package.json, vite.config, etc.) - this is intentional as the project uses CDN-hosted dependencies.

---

## Code Organization

### app.js Architecture

The JavaScript is organized into these main sections:

1. **Global State** (`State` object): Central state management
   - Application state (current tool, active objects)
   - Three.js instances (scene, camera, renderer, controls)
   - Settings (grid size, snap, shadows)
   - Interaction state (raycaster, mouse, dragging)

2. **DOM Cache** (`DOM` object): References to frequently accessed DOM elements

3. **Initialization** (`init()`): Async initialization sequence

4. **Three.js Setup**: Scene, camera, renderer, lighting, grid, axes

5. **UI Initialization**: Event listeners for toolbar, tabs, menus

6. **Event Handlers**: Mouse, keyboard, and UI event handling

7. **CAD Operations**: Abstract base class `CADOperation` with concrete implementations

### Key Classes

```javascript
// Base class for all CAD operations - supports undo/redo
class CADOperation {
    constructor() { this.id = generateId(); this.timestamp = Date.now(); }
    execute() { /* override */ }
    undo() { /* override */ }
}

// Example: Creating a 3D body
class CreateBodyOperation extends CADOperation { ... }
class ExtrudeOperation extends CADOperation { ... }
```

### State Management Pattern

```javascript
const State = {
    isReady: false,
    currentTool: 'select',
    activeObject: null,
    objects: [],        // All 3D objects in scene
    sketches: [],       // 2D sketches
    features: [],       // Feature tree
    
    // Three.js instances
    camera: null,
    renderer: null,
    scene: null,
    controls: null,
    transformControl: null,
    
    // Settings
    gridSize: 100,
    snapEnabled: true,
    shadowsEnabled: false,
    
    // Interaction
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2()
};
```

---

## Running the Application

### Local Development

```bash
# Using Python's built-in server (recommended for proper module loading)
python -m http.server 8000

# Or using Node.js http-server if available
npx http-server -p 8000
```

Then open `http://localhost:8000` in your browser.

**Note:** Opening `index.html` directly via `file://` protocol may cause CORS issues with ES6 modules. Use a local server.

---

## Tool System

Tools are activated via:
1. Clicking toolbar buttons
2. Keyboard shortcuts
3. Command bar input

### Available Tools

| Tool | Shortcut | Description |
|------|----------|-------------|
| select | S | Object selection mode |
| sketch | C | Enter sketch mode |
| line | L | Draw line in sketch |
| rectangle | R | Draw rectangle |
| circle | O | Draw circle |
| arc | A | Draw arc |
| extrude | E | Extrude 2D profile |
| move | M | Move objects |
| fillet | F | Round edges |
| chamfer | - | Chamfer edges |
| mirror | - | Mirror objects |
| pattern | - | Linear/circular pattern |

### Transform Controls (when object selected)

| Key | Mode |
|-----|------|
| T | Translate |
| R | Rotate |
| G | Scale |
| W | Toggle World/Local space |

---

## Command System

Type commands in the command bar at the bottom:

| Command | Action |
|---------|--------|
| `box` | Create box primitive |
| `sphere` | Create sphere |
| `cylinder` | Create cylinder |
| `cone` | Create cone |
| `torus` | Create torus |
| `clear` | Remove all objects |
| `help` or `?` | Show help |

---

## CSS Architecture

### CSS Variables (Theming)

All colors and sizes are defined as CSS custom properties in `:root`:

```css
:root {
    /* Dark theme (default) */
    --bg-primary: #1a1a1f;
    --bg-secondary: #252529;
    --accent-primary: #2196F3;
    --axis-x: #f44336;
    --axis-y: #4CAF50;
    --axis-z: #2196F3;
    /* ... see styles.css for full list */
}
```

### Layout System

- **Menu Bar**: 48px height, fixed at top
- **Left Toolbar**: 56px width, tool buttons
- **Right Sidebar**: 320px width, collapsible on mobile
- **Status Bar**: 28px height, fixed at bottom
- **Timeline**: 48px height, feature history
- **Viewport**: Flexible center area for 3D canvas

---

## Adding New Features

### Adding a New Tool

1. **Add button to HTML** (index.html, left toolbar):
```html
<button class="tool-btn" data-tool="newtool" title="New Tool (N)">
    <i class="fas fa-icon"></i>
</button>
```

2. **Add keyboard shortcut** (app.js, `onKeyDown`):
```javascript
case 'n':
    setActiveTool('newtool');
    break;
```

3. **Handle tool activation** (app.js, `setActiveTool`):
```javascript
case 'newtool':
    DOM.canvas.style.cursor = 'crosshair';
    updateStatus('New tool active');
    break;
```

4. **Handle tool click** (app.js, `handleToolClick`):
```javascript
case 'newtool':
    // Implementation
    break;
```

### Adding a New Primitive

1. **Add to command system** (`executeCommand`):
```javascript
case 'newprimitive':
    createPrimitive('newprimitive');
    break;
```

2. **Implement geometry creation** (`createPrimitive`):
```javascript
case 'newprimitive':
    geometry = new THREE.SomeGeometry(params);
    break;
```

---

## Browser Compatibility

| Browser | Minimum Version | Status |
|---------|-----------------|--------|
| Chrome | 90+ | ✅ Full support |
| Firefox | 88+ | ✅ Full support |
| Edge | 90+ | ✅ Full support |
| Safari | 14+ | ✅ Full support |

Requirements:
- WebGL support
- ES6 Module support
- Import maps support
- CSS Variables support

---

## Performance Considerations

1. **Renderer**: Uses `powerPreference: 'high-performance'`
2. **Pixel Ratio**: Capped at 2x (`Math.min(window.devicePixelRatio, 2)`)
3. **FPS Counter**: Displays in status bar
4. **Shadows**: Disabled by default (toggle in viewport toolbar)

---

## Debugging

The application exposes a global object for debugging:

```javascript
window.AmericaD = {
    State,           // Access full application state
    setActiveTool,   // Programmatically change tools
    setView,         // Change camera view
    createPrimitive, // Create primitives
    clearScene,      // Clear all objects
    zoomToFit        // Zoom to fit all objects
};
```

Access via browser console:
```javascript
// Log current state
console.log(AmericaD.State);

// Create a box programmatically
AmericaD.createPrimitive('box');

// Change view
AmericaD.setView('top');
```

---

## Common Patterns

### Creating a 3D Object

```javascript
const geometry = new THREE.BoxGeometry(10, 10, 10);
const material = new THREE.MeshStandardMaterial({
    color: 0x808080,
    metalness: 0.3,
    roughness: 0.4
});
const mesh = new THREE.Mesh(geometry, material);
mesh.position.set(0, 5, 0);
mesh.castShadow = true;
mesh.receiveShadow = true;
mesh.userData = { 
    type: 'body',
    name: 'Box1',
    id: generateId()
};

// Add edge highlighting
const edges = new THREE.EdgesGeometry(geometry);
const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
const wireframe = new THREE.LineSegments(edges, lineMaterial);
mesh.add(wireframe);

State.scene.add(mesh);
State.objects.push(mesh);
```

### Raycasting for Mouse Picking

```javascript
State.raycaster.setFromCamera(State.mouse, State.camera);
const selectable = State.objects.filter(obj => 
    obj.type === 'Mesh' || obj.type === 'Group'
);
const intersects = State.raycaster.intersectObjects(selectable);

if (intersects.length > 0) {
    selectObject(intersects[0].object);
}
```

---

## Security Notes

- No user authentication or authorization
- No server-side storage - everything is client-side
- Be cautious with `contenteditable` elements (document title)
- File I/O (import/export) not yet implemented

---

## Future Development Areas

Based on README roadmap and code structure:

1. **Feature Tree**: Partial UI exists but functionality incomplete
2. **Sketch System**: Entry point exists, geometry creation needed
3. **File I/O**: Import/Export dialogs referenced but not implemented
4. **Undo/Redo**: Operation framework exists but needs integration
5. **Parametric Modeling**: Foundation with `userData` on objects
6. **Assembly/Constraints**: Joints folder in browser panel
7. **Materials**: UI complete but material assignment not wired
