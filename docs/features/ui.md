# 🖥️ User Interface

> Navigate the Ameri-CAD workspace efficiently

---

## 🗺️ Interface Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  ☰ File  Edit  View  Create  Modify  Tools           💾 🔄 ⚙️  │
├──────────────┬──────────────────────────────────────┬───────────┤
│              │                                      │           │
│  Feature     │         3D Viewport                  │  Property │
│  Tree        │                                      │  Panel    │
│              │                                      │           │
├──────────────┴──────────────────────────────────────┴───────────┤
│  : command                                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🌳 Feature Tree

### Icons

| Icon | Meaning   |
| ---- | --------- |
| 📦   | Primitive |
| 📐   | Sketch    |
| ⬆️   | Extrude   |
| 🔄   | Revolve   |
| ⚪   | Fillet    |
| ◇    | Chamfer   |
| ⚙️   | Pattern   |

### Interactions

| Action   | How                    |
| -------- | ---------------------- |
| Select   | Click feature          |
| Edit     | Double-click           |
| Rename   | Right-click → Rename   |
| Delete   | Right-click → Delete   |
| Suppress | Right-click → Suppress |

---

## 📝 Property Panel

Shows and edits parameters for the selected feature.

### Parameter Types

| Type     | Input          |
| -------- | -------------- |
| Number   | Numeric field  |
| String   | Text field     |
| Point    | X, Y, Z fields |
| Boolean  | Checkbox       |
| Dropdown | Select list    |

---

## 🎮 3D Viewport

### Navigation

| Action    | Input               |
| --------- | ------------------- |
| **Orbit** | Middle mouse drag   |
| **Pan**   | Shift + Middle drag |
| **Zoom**  | Scroll wheel        |

### View Presets

| View      | Shortcut |
| --------- | -------- |
| Front     | `1`      |
| Right     | `3`      |
| Top       | `7`      |
| Isometric | `H`      |

---

## ⌨️ Command Line

Press `:` to open the command line.

- **Tab completion** - Start typing, press Tab
- **History** - Press `↑` / `↓`
- **Help** - `:help` or `:?`

---

## 📏 Measure Tool

Press `M` to activate.

1. Click first point
2. Click second point
3. Distance displays on screen

---

## 📍 Snap System

| Indicator     | Meaning       |
| ------------- | ------------- |
| 🟠 Orange dot | Snap preview  |
| 🟢 Green dot  | Snapped point |
| Blue lines    | Grid lines    |

---

## 🔗 Related

- [Keyboard Shortcuts](../keyboard-shortcuts.md) - Complete shortcut reference
- [Getting Started](../getting-started.md) - Interface walkthrough
