/**
 * Ameri-CAD Boolean & Feature Commands
 *
 * Commands for boolean operations and CAD features.
 */

import { registerCommand } from '../core/commands.js';

/**
 * Register all boolean and feature commands
 */
export function registerBooleanCommands(kernel) {
  // UNION - Boolean union (add/join)
  registerCommand('union', {
    aliases: ['add', 'join', 'fuse', 'u'],
    description: 'Boolean union - combine shapes into one',
    category: 'boolean',
    params: [
      {
        name: 'target',
        type: 'string',
        required: false,
        description: 'Target shape ID (or use selection)',
      },
      { name: 'tool', type: 'string', required: false, description: 'Tool shape ID' },
    ],
    validate(params, context) {
      const shapes =
        params.target && params.tool ? [params.target, params.tool] : context.selection || [];

      if (shapes.length < 2) return 'Union requires at least 2 shapes';
      return true;
    },
    async execute(params, context) {
      const shapes =
        params.target && params.tool ? [params.target, params.tool] : context.selection;

      // Union all selected shapes
      let result = shapes[0];
      for (let i = 1; i < shapes.length; i++) {
        result = await kernel.boolean(result, shapes[i], 'union');
      }

      return result;
    },
  });

  // SUBTRACT - Boolean subtraction (cut)
  registerCommand('subtract', {
    aliases: ['sub', 'cut', 'difference', 's'],
    description: 'Boolean subtraction - cut tool from target',
    category: 'boolean',
    params: [
      { name: 'target', type: 'string', required: false, description: 'Target shape to cut from' },
      { name: 'tool', type: 'string', required: false, description: 'Tool shape to cut with' },
    ],
    validate(params, context) {
      const shapes =
        params.target && params.tool ? [params.target, params.tool] : context.selection || [];

      if (shapes.length < 2) return 'Subtract requires 2 shapes';
      return true;
    },
    async execute(params, context) {
      const shapes =
        params.target && params.tool ? [params.target, params.tool] : context.selection;

      const result = await kernel.boolean(shapes[0], shapes[1], 'subtract');
      return result;
    },
  });

  // INTERSECT - Boolean intersection (common)
  registerCommand('intersect', {
    aliases: ['int', 'common', 'i'],
    description: 'Boolean intersection - keep only overlapping region',
    category: 'boolean',
    params: [
      { name: 'target', type: 'string', required: false, description: 'First shape' },
      { name: 'tool', type: 'string', required: false, description: 'Second shape' },
    ],
    validate(params, context) {
      const shapes =
        params.target && params.tool ? [params.target, params.tool] : context.selection || [];

      if (shapes.length < 2) return 'Intersect requires 2 shapes';
      return true;
    },
    async execute(params, context) {
      const shapes =
        params.target && params.tool ? [params.target, params.tool] : context.selection;

      const result = await kernel.boolean(shapes[0], shapes[1], 'intersect');
      return result;
    },
  });

  // FILLET - Add fillet to edges
  registerCommand('fillet', {
    aliases: ['round', 'fil'],
    description: 'Add fillet (rounded edge) to selected edges',
    category: 'feature',
    params: [
      { name: 'radius', type: 'number', required: true, description: 'Fillet radius' },
      {
        name: 'shapeId',
        type: 'string',
        required: false,
        description: 'Parent shape ID (auto-detected from selection)',
      },
    ],
    validate(params, context) {
      if (!context.selection?.length) return 'Select edges to fillet';
      if (params.radius <= 0) return 'Radius must be positive';
      return true;
    },
    async execute(params, context) {
      // Selection format: either shapeId directly selected, or edges with parent shapeId
      // Extract shapeId from selection context or params
      const shapeId = params.shapeId || context.selectedShapeId || context.selection[0]?.shapeId;
      const edgeIds = context.selectedEdgeIds || context.selection;

      if (!shapeId) {
        throw new Error('Cannot determine parent shape for fillet. Select a shape first.');
      }

      const result = await kernel.fillet(shapeId, edgeIds, params.radius);
      return result;
    },
  });

  // CHAMFER - Add chamfer to edges
  registerCommand('chamfer', {
    aliases: ['bevel', 'cham'],
    description: 'Add chamfer (angled edge) to selected edges',
    category: 'feature',
    params: [
      { name: 'distance', type: 'number', required: true, description: 'Chamfer distance' },
      {
        name: 'shapeId',
        type: 'string',
        required: false,
        description: 'Parent shape ID (auto-detected from selection)',
      },
    ],
    validate(params, context) {
      if (!context.selection?.length) return 'Select edges to chamfer';
      if (params.distance <= 0) return 'Distance must be positive';
      return true;
    },
    async execute(params, context) {
      // Extract shapeId from selection context or params
      const shapeId = params.shapeId || context.selectedShapeId || context.selection[0]?.shapeId;
      const edgeIds = context.selectedEdgeIds || context.selection;

      if (!shapeId) {
        throw new Error('Cannot determine parent shape for chamfer. Select a shape first.');
      }

      const result = await kernel.chamfer(shapeId, edgeIds, params.distance);
      return result;
    },
  });

  // FILLETALL - Add fillet to ALL edges
  registerCommand('filletall', {
    aliases: ['roundall', 'filall'],
    description: 'Add fillet (rounded edges) to ALL edges of a shape',
    category: 'feature',
    params: [
      { name: 'radius', type: 'number', required: true, description: 'Fillet radius' },
      {
        name: 'shapeId',
        type: 'string',
        required: false,
        description: 'Shape ID (or use selection)',
      },
    ],
    validate(params, context) {
      const shapeId = params.shapeId || (context.selection?.length ? context.selection[0] : null);
      if (!shapeId) return 'Select a shape or provide shapeId';
      if (params.radius <= 0) return 'Radius must be positive';
      return true;
    },
    async execute(params, context) {
      const shapeId = params.shapeId || context.selection[0];
      const result = await kernel.filletAll(shapeId, params.radius);
      return result;
    },
  });

  // CHAMFERALL - Add chamfer to ALL edges
  registerCommand('chamferall', {
    aliases: ['bevelall', 'chamall'],
    description: 'Add chamfer (angled edges) to ALL edges of a shape',
    category: 'feature',
    params: [
      { name: 'distance', type: 'number', required: true, description: 'Chamfer distance' },
      {
        name: 'shapeId',
        type: 'string',
        required: false,
        description: 'Shape ID (or use selection)',
      },
    ],
    validate(params, context) {
      const shapeId = params.shapeId || (context.selection?.length ? context.selection[0] : null);
      if (!shapeId) return 'Select a shape or provide shapeId';
      if (params.distance <= 0) return 'Distance must be positive';
      return true;
    },
    async execute(params, context) {
      const shapeId = params.shapeId || context.selection[0];
      const result = await kernel.chamferAll(shapeId, params.distance);
      return result;
    },
  });

  // GETEDGES - Get edge IDs for a shape (for debugging/selection)
  registerCommand('getedges', {
    aliases: ['edges', 'listedges'],
    description: 'List all edge IDs for a shape',
    category: 'analysis',
    params: [
      {
        name: 'shapeId',
        type: 'string',
        required: false,
        description: 'Shape ID (or use selection)',
      },
    ],
    validate(params, context) {
      const shapeId = params.shapeId || (context.selection?.length ? context.selection[0] : null);
      if (!shapeId) return 'Select a shape or provide shapeId';
      return true;
    },
    async execute(params, context) {
      const shapeId = params.shapeId || context.selection[0];
      const result = await kernel.getEdges(shapeId);
      return result;
    },
  });

  // EXTRUDE - Extrude a face or sketch
  registerCommand('extrude', {
    aliases: ['ext', 'push', 'e'],
    description: 'Extrude selected face or sketch',
    category: 'feature',
    params: [
      { name: 'distance', type: 'number', required: true, description: 'Extrusion distance' },
      {
        name: 'direction',
        type: 'string',
        required: false,
        default: 'normal',
        description: 'Direction: normal, x, y, z, or {x,y,z} vector',
      },
    ],
    validate(params, context) {
      if (!context.selection?.length) return 'Select a face or sketch to extrude';
      return true;
    },
    async execute(params, context) {
      const profileId = context.selection[0];

      // Parse direction - can be 'normal', axis name, or vector object
      let direction;
      if (params.direction === 'normal') {
        direction = { x: 0, y: 0, z: 1 }; // Default, kernel should compute from face normal
      } else if (params.direction === 'x') {
        direction = { x: 1, y: 0, z: 0 };
      } else if (params.direction === 'y') {
        direction = { x: 0, y: 1, z: 0 };
      } else if (params.direction === 'z') {
        direction = { x: 0, y: 0, z: 1 };
      } else if (typeof params.direction === 'object') {
        direction = params.direction;
      } else {
        direction = { x: 0, y: 0, z: 1 };
      }

      const result = await kernel.extrude(profileId, direction, params.distance);
      return result;
    },
  });

  // REVOLVE - Revolve a face or sketch
  registerCommand('revolve', {
    aliases: ['rev', 'spin'],
    description: 'Revolve selected face or sketch around an axis',
    category: 'feature',
    params: [
      {
        name: 'angle',
        type: 'number',
        required: false,
        default: 360,
        description: 'Angle in degrees',
      },
      {
        name: 'axis',
        type: 'string',
        required: false,
        default: 'y',
        description: 'Axis: x, y, or z',
      },
    ],
    validate(params, context) {
      if (!context.selection?.length) return 'Select a face or sketch to revolve';
      if (params.angle <= 0 || params.angle > 360) return 'Angle must be between 0 and 360';
      return true;
    },
    async execute(params, context) {
      const profileId = context.selection[0];

      // Parse axis
      let axis;
      if (params.axis === 'x') {
        axis = { origin: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } };
      } else if (params.axis === 'y') {
        axis = { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 1, z: 0 } };
      } else if (params.axis === 'z') {
        axis = { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } };
      } else if (typeof params.axis === 'object') {
        axis = params.axis;
      } else {
        axis = { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 1, z: 0 } };
      }

      const result = await kernel.revolve(profileId, axis, params.angle);
      return result;
    },
  });

  // SHELL - Hollow out a solid
  registerCommand('shell', {
    aliases: ['hollow'],
    description:
      'Hollow out a solid by removing a face (creates open shell) or keep all faces (closed shell)',
    category: 'feature',
    usage:
      'shell <thickness> [face_to_remove]\n  shell 2       - Remove largest face (default)\n  shell 2 top   - Remove top face\n  shell 2 none  - Closed shell (no face removed)',
    params: [
      { name: 'thickness', type: 'number', required: true, description: 'Wall thickness' },
      {
        name: 'faceToRemove',
        type: 'string',
        required: false,
        default: 'largest',
        description: 'Face to remove: none, largest, top, bottom, front, back, left, right',
      },
    ],
    validate(params, context) {
      if (!context.selection?.length) return 'Select a solid to shell';
      if (params.thickness <= 0) return 'Thickness must be positive';

      // Validate face selection
      const validSelections = [
        'none',
        'largest',
        'top',
        'bottom',
        'front',
        'back',
        'left',
        'right',
      ];
      const selection = (params.faceToRemove || 'largest').toLowerCase();
      if (!validSelections.includes(selection)) {
        return `Invalid face selection: ${params.faceToRemove}. Use: ${validSelections.join(', ')}`;
      }
      return true;
    },
    async execute(params, context) {
      const shapeId = context.selection[0];
      const faceSelection = (params.faceToRemove || 'largest').toLowerCase();

      // If explicit face IDs are selected, use those instead
      const faceIds = context.selectedFaceIds || null;

      const result = await kernel.shell(shapeId, faceIds, params.thickness, faceSelection);
      return result;
    },
  });

  // GETFACES - List all face IDs for a shape (for debugging/selection)
  registerCommand('getfaces', {
    aliases: ['faces', 'listfaces'],
    description: 'List all face IDs and properties for a shape',
    category: 'analysis',
    params: [
      {
        name: 'shapeId',
        type: 'string',
        required: false,
        description: 'Shape ID (or use selection)',
      },
    ],
    validate(params, context) {
      const shapeId = params.shapeId || (context.selection?.length ? context.selection[0] : null);
      if (!shapeId) return 'Select a shape or provide shapeId';
      return true;
    },
    async execute(params, context) {
      const shapeId = params.shapeId || context.selection[0];
      const result = await kernel.getFaces(shapeId);
      return result;
    },
  });

  // LOFT - Loft between profiles
  registerCommand('loft', {
    aliases: ['blend'],
    description: 'Create a loft between selected profiles',
    category: 'feature',
    params: [
      {
        name: 'solid',
        type: 'boolean',
        required: false,
        default: true,
        description: 'Create solid (vs surface)',
      },
    ],
    validate(params, context) {
      if (!context.selection?.length || context.selection.length < 2) {
        return 'Select at least 2 profiles to loft';
      }
      return true;
    },
    async execute(params, context) {
      const profileIds = context.selection;
      const result = await kernel.loft(profileIds, params.solid);
      return result;
    },
  });

  // SWEEP - Sweep profile along path
  registerCommand('sweep', {
    description: 'Sweep a profile along a path',
    category: 'feature',
    params: [
      { name: 'profile', type: 'string', required: false, description: 'Profile shape ID' },
      { name: 'path', type: 'string', required: false, description: 'Path curve ID' },
    ],
    validate(params, context) {
      if (!context.selection?.length || context.selection.length < 2) {
        return 'Select profile and path for sweep';
      }
      return true;
    },
    async execute(params, context) {
      const profile = params.profile || context.selection[0];
      const path = params.path || context.selection[1];
      const result = await kernel.sweep(profile, path);
      return result;
    },
  });

  // INTERFERENCE - Detect overlapping bodies
  registerCommand('interference', {
    aliases: ['clash', 'collide', 'overlap'],
    description: 'Detect overlapping/interfering bodies (critical for assemblies)',
    category: 'analysis',
    params: [
      {
        name: 'body1',
        type: 'string',
        required: false,
        description: 'First body ID (or use selection for all)',
      },
      {
        name: 'body2',
        type: 'string',
        required: false,
        description: 'Second body ID (optional, check pair)',
      },
    ],
    validate(params, context) {
      // If specific pair given, validate we have 2 IDs
      if (params.body1 && params.body2) {
        return true;
      }
      // Otherwise need at least 2 selected shapes
      const shapes = params.body1
        ? [params.body1, ...(context.selection || [])]
        : context.selection || [];

      if (shapes.length < 2) {
        return 'Interference check requires at least 2 bodies. Select bodies or provide IDs.';
      }
      return true;
    },
    async execute(params, context) {
      // Determine which shapes to check
      let shapeIds;
      if (params.body1 && params.body2) {
        // Check specific pair
        shapeIds = [params.body1, params.body2];
      } else if (params.body1) {
        // Check body1 against all selected
        shapeIds = [params.body1, ...(context.selection || [])];
      } else {
        // Check all selected against each other
        shapeIds = [...(context.selection || [])];
      }

      // Remove duplicates
      shapeIds = [...new Set(shapeIds)];

      const result = await kernel.detectInterference(shapeIds);

      // Format result for user
      if (result.interferences.length === 0) {
        return {
          message: `No interference detected among ${shapeIds.length} bodies.`,
          interferences: [],
        };
      }

      return {
        message: `Found ${result.interferences.length} interference(s)`,
        interferences: result.interferences.map(i => ({
          body1: i.body1,
          body2: i.body2,
          volume: i.volume,
          intersectionShapeId: i.intersectionShapeId,
          mesh: i.mesh,
        })),
      };
    },
  });
}

export default { registerBooleanCommands };
