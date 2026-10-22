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

| Component      | Technology   | Version/Notes             |
| -------------- | ------------ | ------------------------- |
| 3D Engine      | Three.js     | v0.160.0 (via CDN)        |
| Language       | JavaScript   | ES6+ Modules              |
| Styling        | CSS3         | CSS Variables for theming |
| Icons          | Font Awesome | 6.4.0                     |
| Font           | Inter        | Google Fonts              |
| Module Loading | Import Maps  | Native browser support    |

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
  objects: [], // All 3D objects in scene
  sketches: [], // 2D sketches
  features: [], // Feature tree

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
  mouse: new THREE.Vector2(),
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

| Tool      | Shortcut | Description             |
| --------- | -------- | ----------------------- |
| select    | S        | Object selection mode   |
| sketch    | C        | Enter sketch mode       |
| line      | L        | Draw line in sketch     |
| rectangle | R        | Draw rectangle          |
| circle    | O        | Draw circle             |
| arc       | A        | Draw arc                |
| extrude   | E        | Extrude 2D profile      |
| move      | M        | Move objects            |
| fillet    | F        | Round edges             |
| chamfer   | -        | Chamfer edges           |
| mirror    | -        | Mirror objects          |
| pattern   | -        | Linear/circular pattern |

### Transform Controls (when object selected)

| Key | Mode                     |
| --- | ------------------------ |
| T   | Translate                |
| R   | Rotate                   |
| G   | Scale                    |
| W   | Toggle World/Local space |

---

## Command System

Type commands in the command bar at the bottom:

| Command       | Action               |
| ------------- | -------------------- |
| `box`         | Create box primitive |
| `sphere`      | Create sphere        |
| `cylinder`    | Create cylinder      |
| `cone`        | Create cone          |
| `torus`       | Create torus         |
| `clear`       | Remove all objects   |
| `help` or `?` | Show help            |

---

## CSS Architecture

### CSS Variables (Theming)

All colors and sizes are defined as CSS custom properties in `:root`:

```css
:root {
  /* Dark theme (default) */
  --bg-primary: #1a1a1f;
  --bg-secondary: #252529;
  --accent-primary: #2196f3;
  --axis-x: #f44336;
  --axis-y: #4caf50;
  --axis-z: #2196f3;
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

| Browser | Minimum Version | Status          |
| ------- | --------------- | --------------- |
| Chrome  | 90+             | ✅ Full support |
| Firefox | 88+             | ✅ Full support |
| Edge    | 90+             | ✅ Full support |
| Safari  | 14+             | ✅ Full support |

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
  State, // Access full application state
  setActiveTool, // Programmatically change tools
  setView, // Change camera view
  createPrimitive, // Create primitives
  clearScene, // Clear all objects
  zoomToFit, // Zoom to fit all objects
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
  roughness: 0.4,
});
const mesh = new THREE.Mesh(geometry, material);
mesh.position.set(0, 5, 0);
mesh.castShadow = true;
mesh.receiveShadow = true;
mesh.userData = {
  type: 'body',
  name: 'Box1',
  id: generateId(),
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
const selectable = State.objects.filter(obj => obj.type === 'Mesh' || obj.type === 'Group');
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

<!-- REVIEW_CHARTER_START 2026-10-21 -->
## When you review (Sean, 2026-10-21)
Sean: "when sol is reviewing code, instead of just looking for bugs it also steps back from the problem and tries to find a more elegant first principles solution, and stands guard against code and test bloat, band aid hacks, and always tries to push the main agent towards a more elegant, solution." Then: "it should be able to take a step back look at the bigger picture, and call out if theres a more elegant long term solution, rather than just give a bunch of super rare and unlikely bug cases that need lots of bandaids to cover up. I want the robust, elegant long term shape, and the review agents job is to always look for that sort of thing." And: "the goal is robustness through elegance and simplicity."

**The goal is robustness through elegance and simplicity.** A review's main job is to find the robust long-term shape: the one where the code's structure matches the problem's, so whole classes of bugs cannot happen. Bug hunting serves that job; it does not replace it. This binds every review, audit, bug hunt and second opinion, whatever model runs it (GPT-6.1 Sol by default) and even when the prompt asks only for bugs. The one exception is a pass the prompt names blockers-only (a hotfix): report correctness only, and list any shape you noticed as the follow-up.

1. **Step back first.** Before you judge the diff, say in one sentence what the change is for (for an internal change, what it must keep working). Read the code it touches and search the repo for what already does the job. Sketch the simplest robust shape for the problem, then compare the diff with it. Lead the report with that shape: the long-term solution, what it deletes, and whether this change moves toward it or away from it. If the change already matches it, say so in one line.
2. **Then hunt bugs, and find their cause.** Report a bug that real use can reach: how it happens, severity, confidence, file:line. When several bugs share a cause, report the cause once, with the shape that makes them all impossible, not one guard per case. Edge cases are part of the work in high mix (Sean, 2026-10-21: "we are in the business of high mix, so edgecases are everything"; "an edgecase we dont handle means we need a better system overall that can handle not only that edgecase but all others"). Do not dismiss a failure that real use can reach because it is rare. Treat an unhandled case as evidence of a problem in the system's design. Report the shared cause once, with examples that show it, the simplest system that handles the whole class of failures with that cause, and what that system deletes or makes unnecessary. Show how it keeps the agreed behavior and existing contracts. Never ask for a band-aid; ask for the change that removes the cause. Handling only the reported example does not close the finding. In pass 1, report all identified classes together. Later passes follow "Settle, do not re-litigate": review the fixes and new evidence from those fixes; do not restart the review of the original change. Further examples of the same cause belong to the existing finding.

Look for these. Each is a finding when you can show needless complexity, a duplicated responsibility, a mechanism that covers an avoidable cause, or a hidden failure:
- **Band-aids:** a mechanism that handles a symptom while leaving its shared cause in place, or hides a failure. Inspect guards, retries, sleeps, raised timeouts, locks, flags, IDs, thresholds, special cases, fallbacks, wrappers, shims and helpers for this. None is a finding merely because it exists. Show the cause it leaves in place, the simpler system that removes that cause, and the specific code that system makes unnecessary. A rule that removes the cause for the whole affected class while preserving supported behavior is a fix.
- **Code bloat:** new code that does the same job under the same contract as existing code (name it, file:line); a new parameter or branch that bends a near-fit abstraction to a case it was not shaped for; a stored value that could be computed; a third variant of one rule with no shared home; a translation between two forms of one idea; a module that needs "and" to describe. Similar-looking code with different rules is not a copy: duplication is cheaper than the wrong abstraction.
- **Test bloat:** apply the repo's test rule (by default, a new test earns its place by holding a property that already broke). Flag a test that repeats another, asserts how the code works instead of what it does, or mocks the thing it tests, and a test that guards a state the types or schema could make impossible (say how).

Rules:
- **Show it.** A shape finding names the needless part, the better shape in one sentence, what it deletes, and how it delivers the agreed behavior and keeps the contracts that must stay (callers, stored data, restarts, error paths). Use words and names, never a patch. Cite existing code it reuses (file:line), if any. "Could be cleaner" is not a finding; taste with nothing to delete is at most one non-blocking line.
- **Blocking.** A finding blocks when the better shape removes the need for specific code this diff adds (name it): a band-aid, a same-job copy, a parameter that bends a near-fit abstraction. Moving, renaming or rewriting equivalent code is not removing it. The change is then rebuilt on the shape, as stacked PRs if the shape needs more than one. A better shape that deletes nothing this diff adds is the next PR (open the issue now), not a blocker. A shape you could not show delivers the agreed behavior is non-blocking. A correctness or safety failure that real use can reach in the agreed behavior this change must deliver or preserve blocks, even when its cause is in unchanged code. This includes edge cases, regardless of how often they occur. This correctness rule applies even when the fix deletes no code added by this diff. The fix must remove the shared cause for the whole affected class; handling only the reported example does not close the finding. An existing failure unrelated to that agreed behavior is the next PR (open the issue now), not a blocker for this change. Rank by impact.
- **Settle, do not re-litigate.** Pass 1 reports everything at once. Delta passes review the fix commits, new band-aids included (a guard around the symptom is a new finding), and close open findings. Rule once on an author's rebuttal: accept it, or state the disagreement in one line; the orchestrator decides and names it in its report. A settled finding stays settled unless the fix commits bring new evidence.
- **Plans and specs.** The shape job is most of the review: the sentence, what the design deletes, what already exists, the non-goals. Apply the blocking test to the code or mechanisms the plan proposes: a better shape that removes the need for them blocks the plan.
- **Verdict.** PASS needs both jobs done and no blocking finding left; do not invent an improvement to go with it. When a job could not be done (no repo access, no stated goal), the verdict is INCOMPLETE, with what was missing. A blockers-only pass may PASS on correctness alone. Whether a failed pass holds a merge is the repo's rule.

**The author's side.** Answer every finding: rebuild on the shape, fix the cause, rebut it with evidence, or open the issue for a next-PR shape. A fix that removes the cause is valid wherever it lands; one that guards the symptom is the band-aid. Give the reviewer the PR's sentence and repo access.
<!-- REVIEW_CHARTER_END -->
