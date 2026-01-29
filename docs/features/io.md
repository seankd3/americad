# 💾 File I/O

> Save, load, and export your designs

---

## 📁 Document Operations

### Save

**Shortcut:** `Ctrl+S`

```bash
save
```

### Save As

**Shortcut:** `Ctrl+Shift+S`

```bash
saveAs filename
```

### Open

**Shortcut:** `Ctrl+O`

```bash
open
```

### New

**Shortcut:** `Ctrl+N`

```bash
new
```

---

## 📤 Export Formats

### STEP Export

Export to STEP format - the industry standard for CAD data exchange.

```bash
export step [filename]
export step mypart       # → mypart.step
```

### STL Export

Export to STL format - the standard for 3D printing.

```bash
export stl [filename] [format]
export stl mypart           # Binary STL (default)
export stl mypart ascii     # ASCII STL
```

### STL Statistics

Check export stats before downloading:

```bash
stl stats
```

---

## 📥 Import Formats

### STEP Import

```bash
import
```

Opens file picker. Supports `.step`, `.stp`

### STL Import

```bash
import
```

Supports `.stl`, `.obj`

---

## 📊 Export Comparison

| Feature           | STEP          | STL                |
| ----------------- | ------------- | ------------------ |
| **Geometry Type** | B-Rep (exact) | Mesh (approximate) |
| **CAD Editable**  | ✅ Yes        | ❌ No              |
| **Use Case**      | CAD exchange  | 3D printing        |

---

## 🔗 Related

- [Operations](operations.md) - Create export-ready parts
- [Getting Started](../getting-started.md) - First export tutorial
