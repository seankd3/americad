/**
 * Ameri-CAD Reference Geometry Commands
 *
 * Commands for creating construction planes, axes, and points.
 * Reference geometry enables complex modeling workflows.
 */

import { registerCommand } from '../core/commands.js';
import { referenceGeometry, ReferencePoint } from '../core/reference-geometry.js';

/**
 * Register all reference geometry commands
 * @param {Object} _context - Application context with scene, selection, etc.
 */
export function registerReferenceCommands(_context) {
  // ═══════════════════════════════════════════════════════════════════════
  // PLANE Commands
  // ═══════════════════════════════════════════════════════════════════════

  registerCommand('plane', {
    aliases: ['pln', 'workplane', 'wp'],
    description: 'Create a reference plane',
    category: 'reference',
    params: [
      {
        name: 'type',
        type: 'string',
        required: true,
        description:
          'Plane type: xy, xz, yz, offset, 3point, face, angle',
      },
      {
        name: 'arg1',
        type: 'string',
        required: false,
        description: 'Base plane for offset/angle, or first point',
      },
      {
        name: 'arg2',
        type: 'number',
        required: false,
        description: 'Offset distance or angle',
      },
    ],
    async execute(params, ctx) {
      const type = params.type?.toLowerCase();

      // Standard origin planes
      if (type === 'xy') {
        const plane = referenceGeometry.addPlane([0, 0, 0], [0, 0, 1], 'XY Plane (new)', {
          color: 0x4488ff,
        });
        addToScene(plane, ctx);
        return { success: true, plane, message: `Created ${plane.name}` };
      }

      if (type === 'xz') {
        const plane = referenceGeometry.addPlane([0, 0, 0], [0, 1, 0], 'XZ Plane (new)', {
          color: 0x44ff44,
        });
        addToScene(plane, ctx);
        return { success: true, plane, message: `Created ${plane.name}` };
      }

      if (type === 'yz') {
        const plane = referenceGeometry.addPlane([0, 0, 0], [1, 0, 0], 'YZ Plane (new)', {
          color: 0xff4444,
        });
        addToScene(plane, ctx);
        return { success: true, plane, message: `Created ${plane.name}` };
      }

      // Offset plane: plane offset <base> <distance>
      if (type === 'offset') {
        const baseName = params.arg1 || 'xy';
        const offset = params.arg2 ?? 50;

        // Map shorthand names to full names
        const baseMap = {
          xy: 'XY Plane',
          xz: 'XZ Plane',
          yz: 'YZ Plane',
        };
        const basePlaneRef = baseMap[baseName.toLowerCase()] || baseName;

        const plane = referenceGeometry.addOffsetPlane(basePlaneRef, offset);
        if (!plane) {
          return { success: false, error: `Base plane '${baseName}' not found` };
        }

        addToScene(plane, ctx);
        return {
          success: true,
          plane,
          message: `Created ${plane.name} (offset ${offset} from ${basePlaneRef})`,
        };
      }

      // Angled plane: plane angle <base> <degrees>
      if (type === 'angle') {
        const baseName = params.arg1 || 'xy';
        const angle = params.arg2 ?? 45;

        const baseMap = {
          xy: 'XY Plane',
          xz: 'XZ Plane',
          yz: 'YZ Plane',
        };
        const basePlaneRef = baseMap[baseName.toLowerCase()] || baseName;

        const plane = referenceGeometry.addAngledPlane(basePlaneRef, angle);
        if (!plane) {
          return { success: false, error: `Base plane '${baseName}' not found` };
        }

        addToScene(plane, ctx);
        return {
          success: true,
          plane,
          message: `Created ${plane.name} (${angle}° from ${basePlaneRef})`,
        };
      }

      // 3-point plane: requires 3 selected points
      if (type === '3point' || type === '3pt') {
        // Get selected reference points
        const selectedPoints = getSelectedPoints(ctx);
        if (selectedPoints.length < 3) {
          return {
            success: false,
            error: 'Select 3 reference points first (or use point command to create them)',
          };
        }

        const [p1, p2, p3] = selectedPoints.slice(0, 3).map((p) => p.position);
        const plane = referenceGeometry.addPlaneThrough3Points(p1, p2, p3, '3-Point Plane');
        addToScene(plane, ctx);
        return { success: true, plane, message: `Created ${plane.name} through 3 points` };
      }

      // Face plane: plane from selected face
      if (type === 'face') {
        const face = ctx.selectedFace;
        if (!face) {
          return { success: false, error: 'Select a face first' };
        }

        // Get face normal and centroid from selection
        const origin = face.centroid || [0, 0, 0];
        const normal = face.normal || [0, 0, 1];

        const plane = referenceGeometry.addPlane(origin, normal, 'Face Plane');
        addToScene(plane, ctx);
        return { success: true, plane, message: `Created ${plane.name} on face` };
      }

      return {
        success: false,
        error: `Unknown plane type: ${type}. Use xy, xz, yz, offset, angle, 3point, or face`,
      };
    },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // AXIS Commands
  // ═══════════════════════════════════════════════════════════════════════

  registerCommand('axis', {
    aliases: ['ax', 'centerline', 'cl'],
    description: 'Create a reference axis',
    category: 'reference',
    params: [
      {
        name: 'type',
        type: 'string',
        required: true,
        description: 'Axis type: x, y, z, edge, 2point',
      },
    ],
    async execute(params, ctx) {
      const type = params.type?.toLowerCase();

      // Standard origin axes
      if (type === 'x') {
        const axis = referenceGeometry.addAxis([0, 0, 0], [1, 0, 0], 'X Axis (new)', {
          color: 0xff4444,
        });
        addToScene(axis, ctx);
        return { success: true, axis, message: `Created ${axis.name}` };
      }

      if (type === 'y') {
        const axis = referenceGeometry.addAxis([0, 0, 0], [0, 1, 0], 'Y Axis (new)', {
          color: 0x44ff44,
        });
        addToScene(axis, ctx);
        return { success: true, axis, message: `Created ${axis.name}` };
      }

      if (type === 'z') {
        const axis = referenceGeometry.addAxis([0, 0, 0], [0, 0, 1], 'Z Axis (new)', {
          color: 0x4488ff,
        });
        addToScene(axis, ctx);
        return { success: true, axis, message: `Created ${axis.name}` };
      }

      // Edge axis: axis along selected edge
      if (type === 'edge') {
        const edge = ctx.selectedEdge;
        if (!edge) {
          return { success: false, error: 'Select an edge first' };
        }

        const p1 = edge.start || [0, 0, 0];
        const p2 = edge.end || [1, 0, 0];
        const axis = referenceGeometry.addAxisThrough2Points(p1, p2, 'Edge Axis');
        addToScene(axis, ctx);
        return { success: true, axis, message: `Created ${axis.name} along edge` };
      }

      // 2-point axis: requires 2 selected points
      if (type === '2point' || type === '2pt') {
        const selectedPoints = getSelectedPoints(ctx);
        if (selectedPoints.length < 2) {
          return {
            success: false,
            error: 'Select 2 reference points first',
          };
        }

        const [p1, p2] = selectedPoints.slice(0, 2).map((p) => p.position);
        const axis = referenceGeometry.addAxisThrough2Points(p1, p2, '2-Point Axis');
        addToScene(axis, ctx);
        return { success: true, axis, message: `Created ${axis.name} through 2 points` };
      }

      return {
        success: false,
        error: `Unknown axis type: ${type}. Use x, y, z, edge, or 2point`,
      };
    },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // POINT Commands
  // ═══════════════════════════════════════════════════════════════════════

  registerCommand('point', {
    aliases: ['pt', 'refpoint', 'rp'],
    description: 'Create a reference point',
    category: 'reference',
    params: [
      {
        name: 'x',
        type: 'number',
        required: false,
        description: 'X coordinate, or "center" / "vertex"',
      },
      { name: 'y', type: 'number', required: false, description: 'Y coordinate' },
      { name: 'z', type: 'number', required: false, description: 'Z coordinate' },
    ],
    async execute(params, ctx) {
      // Check for special keywords
      const firstArg = String(params.x || '').toLowerCase();

      // Point at center of selected face/edge
      if (firstArg === 'center' || firstArg === 'cen') {
        const center = ctx.selectedFace?.centroid || ctx.selectedEdge?.midpoint;
        if (!center) {
          return { success: false, error: 'Select a face or edge first' };
        }

        const point = referenceGeometry.addPoint(center, 'Center Point');
        addToScene(point, ctx);
        return { success: true, point, message: `Created ${point.name} at center` };
      }

      // Point at selected vertex
      if (firstArg === 'vertex' || firstArg === 'vert' || firstArg === 'v') {
        const vertex = ctx.selectedVertex;
        if (!vertex) {
          return { success: false, error: 'Select a vertex first' };
        }

        const position = vertex.position || vertex;
        const point = referenceGeometry.addPoint(position, 'Vertex Point');
        addToScene(point, ctx);
        return { success: true, point, message: `Created ${point.name} at vertex` };
      }

      // Point at explicit coordinates
      const x = parseFloat(params.x) || 0;
      const y = parseFloat(params.y) || 0;
      const z = parseFloat(params.z) || 0;

      const point = referenceGeometry.addPoint([x, y, z], `Point (${x}, ${y}, ${z})`);
      addToScene(point, ctx);
      return { success: true, point, message: `Created ${point.name}` };
    },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Reference Geometry Management
  // ═══════════════════════════════════════════════════════════════════════

  registerCommand('refshow', {
    aliases: ['showref', 'showreference'],
    description: 'Show reference geometry by name or ID',
    category: 'reference',
    params: [
      {
        name: 'name',
        type: 'string',
        required: false,
        description: 'Name or ID (omit to show all)',
      },
    ],
    async execute(params, ctx) {
      if (params.name) {
        const item =
          referenceGeometry.getPlane(params.name) ||
          referenceGeometry.getAxis(params.name) ||
          referenceGeometry.getPoint(params.name);

        if (!item) {
          return { success: false, error: `Reference '${params.name}' not found` };
        }

        referenceGeometry.setVisibility(item.id, true);
        updateSceneVisibility(item, true, ctx);
        return { success: true, message: `Showing ${item.name}` };
      }

      // Show all
      referenceGeometry.getAll().forEach((item) => {
        referenceGeometry.setVisibility(item.id, true);
        updateSceneVisibility(item, true, ctx);
      });
      return { success: true, message: 'Showing all reference geometry' };
    },
  });

  registerCommand('refhide', {
    aliases: ['hideref', 'hidereference'],
    description: 'Hide reference geometry by name or ID',
    category: 'reference',
    params: [
      {
        name: 'name',
        type: 'string',
        required: false,
        description: 'Name or ID (omit to hide all)',
      },
    ],
    async execute(params, ctx) {
      if (params.name) {
        const item =
          referenceGeometry.getPlane(params.name) ||
          referenceGeometry.getAxis(params.name) ||
          referenceGeometry.getPoint(params.name);

        if (!item) {
          return { success: false, error: `Reference '${params.name}' not found` };
        }

        referenceGeometry.setVisibility(item.id, false);
        updateSceneVisibility(item, false, ctx);
        return { success: true, message: `Hiding ${item.name}` };
      }

      // Hide all
      referenceGeometry.getAll().forEach((item) => {
        referenceGeometry.setVisibility(item.id, false);
        updateSceneVisibility(item, false, ctx);
      });
      return { success: true, message: 'Hiding all reference geometry' };
    },
  });

  registerCommand('reflist', {
    aliases: ['listref', 'refs'],
    description: 'List all reference geometry',
    category: 'reference',
    params: [],
    async execute(_params, _ctx) {
      const planes = Array.from(referenceGeometry.planes.values());
      const axes = Array.from(referenceGeometry.axes.values());
      const points = Array.from(referenceGeometry.points.values());

      const list = {
        planes: planes.map((p) => ({
          id: p.id,
          name: p.name,
          visible: p.visible,
        })),
        axes: axes.map((a) => ({
          id: a.id,
          name: a.name,
          visible: a.visible,
        })),
        points: points.map((p) => ({
          id: p.id,
          name: p.name,
          position: p.position,
          visible: p.visible,
        })),
      };

      const message =
        `Reference Geometry:\n` +
        `  Planes (${planes.length}): ${planes.map((p) => p.name).join(', ') || 'none'}\n` +
        `  Axes (${axes.length}): ${axes.map((a) => a.name).join(', ') || 'none'}\n` +
        `  Points (${points.length}): ${points.map((p) => p.name).join(', ') || 'none'}`;

      return { success: true, ...list, message };
    },
  });

  registerCommand('refdelete', {
    aliases: ['deleteref', 'rmref'],
    description: 'Delete reference geometry by name or ID',
    category: 'reference',
    params: [
      { name: 'name', type: 'string', required: true, description: 'Name or ID to delete' },
    ],
    async execute(params, ctx) {
      const item =
        referenceGeometry.getPlane(params.name) ||
        referenceGeometry.getAxis(params.name) ||
        referenceGeometry.getPoint(params.name);

      if (!item) {
        return { success: false, error: `Reference '${params.name}' not found` };
      }

      // Remove from scene
      removeFromScene(item, ctx);

      // Remove from manager
      referenceGeometry.remove(item.id);

      return { success: true, message: `Deleted ${item.name}` };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Add reference geometry visualization to scene
 */
function addToScene(item, ctx) {
  if (!ctx.scene) return;

  const mesh = item.toMesh();
  mesh.userData.refId = item.id;

  // Store reference for later updates
  if (!ctx.refGeometryMeshes) {
    ctx.refGeometryMeshes = new Map();
  }
  ctx.refGeometryMeshes.set(item.id, mesh);

  ctx.scene.add(mesh);
}

/**
 * Remove reference geometry visualization from scene
 */
function removeFromScene(item, ctx) {
  if (!ctx.scene || !ctx.refGeometryMeshes) return;

  const mesh = ctx.refGeometryMeshes.get(item.id);
  if (mesh) {
    ctx.scene.remove(mesh);
    ctx.refGeometryMeshes.delete(item.id);

    // Dispose geometry and material
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  }
}

/**
 * Update visibility of reference geometry in scene
 */
function updateSceneVisibility(item, visible, ctx) {
  if (!ctx.refGeometryMeshes) return;

  const mesh = ctx.refGeometryMeshes.get(item.id);
  if (mesh) {
    mesh.visible = visible;
  }
}

/**
 * Get selected reference points from context
 */
function getSelectedPoints(ctx) {
  if (!ctx.selection) return [];

  // Filter selection for reference points
  return ctx.selection
    .filter((s) => s.userData?.refGeometry instanceof ReferencePoint)
    .map((s) => s.userData.refGeometry);
}

export default { registerReferenceCommands };
