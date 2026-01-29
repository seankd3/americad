/**
 * Ameri-CAD Transform Commands
 *
 * Commands for transforming geometry: move, rotate, scale, mirror, copy.
 */

import { registerCommand } from '../core/commands.js';
import { kernel as kernelBridge } from '../kernel/bridge.js';

/**
 * Register all transform commands
 */
export function registerTransformCommands(kernel) {
  // Use the kernel bridge directly for transforms
  const krnl = kernelBridge;

  // MOVE - Move selected objects
  registerCommand('move', {
    aliases: ['m', 'translate', 'mv'],
    description: 'Move selected objects by a vector or to a point',
    category: 'transform',
    params: [
      { name: 'dx', type: 'number', required: true, description: 'X displacement' },
      { name: 'dy', type: 'number', required: false, default: 0, description: 'Y displacement' },
      { name: 'dz', type: 'number', required: false, default: 0, description: 'Z displacement' },
    ],
    validate(params, context) {
      if (!context.selection?.length) return 'Nothing selected';
      return true;
    },
    async execute(params, context) {
      const results = [];

      for (const id of context.selection) {
        const result = await kernel.translate(id, params.dx, params.dy, params.dz);
        results.push(result);
      }

      return results;
    },
  });

  // ROTATE - Rotate selected objects
  registerCommand('rotate', {
    aliases: ['rot', 'r'],
    description: 'Rotate selected objects around an axis',
    category: 'transform',
    params: [
      { name: 'angle', type: 'number', required: true, description: 'Angle in degrees' },
      {
        name: 'axis',
        type: 'string',
        required: false,
        default: 'z',
        description: 'Axis: x, y, or z',
      },
      {
        name: 'center',
        type: 'point',
        required: false,
        default: { x: 0, y: 0, z: 0 },
        description: 'Center of rotation',
      },
    ],
    validate(params, context) {
      if (!context.selection?.length) return 'Nothing selected';
      if (!['x', 'y', 'z'].includes(params.axis.toLowerCase())) {
        return 'Axis must be x, y, or z';
      }
      return true;
    },
    async execute(params, context) {
      const results = [];
      const axisVec = {
        x: { x: 1, y: 0, z: 0 },
        y: { x: 0, y: 1, z: 0 },
        z: { x: 0, y: 0, z: 1 },
      }[params.axis.toLowerCase()];

      for (const id of context.selection) {
        const result = await kernel.rotate(id, params.angle, axisVec, params.center);
        results.push(result);
      }

      return results;
    },
  });

  // SCALE - Scale selected objects
  registerCommand('scale', {
    aliases: ['sc', 'resize'],
    description: 'Scale selected objects',
    category: 'transform',
    params: [
      {
        name: 'factor',
        type: 'number',
        required: true,
        description: 'Scale factor (1 = no change)',
      },
      {
        name: 'center',
        type: 'point',
        required: false,
        default: { x: 0, y: 0, z: 0 },
        description: 'Center of scaling',
      },
    ],
    validate(params, context) {
      if (!context.selection?.length) return 'Nothing selected';
      if (params.factor <= 0) return 'Scale factor must be positive';
      return true;
    },
    async execute(params, context) {
      const results = [];

      for (const id of context.selection) {
        const result = await kernel.scale(id, params.factor, params.center);
        results.push(result);
      }

      return results;
    },
  });

  // MIRROR - Mirror selected objects
  registerCommand('mirror', {
    aliases: ['mir', 'flip'],
    description: 'Mirror selected objects across a plane',
    usage:
      'mirror [plane] [keep]\n  mirror       - Mirror across YZ plane (X=0)\n  mirror xy    - Mirror across XY plane\n  mirror xz    - Mirror across XZ plane\n  mirror yz    - Mirror across YZ plane\n  mirror yz keep - Mirror and keep original (symmetric part)\n  mirror yz fuse - Mirror and fuse into symmetric part',
    category: 'transform',
    params: [
      {
        name: 'plane',
        type: 'string',
        required: false,
        default: 'yz',
        description: 'Mirror plane: xy, xz, or yz (default: yz)',
      },
      {
        name: 'mode',
        type: 'string',
        required: false,
        default: 'replace',
        description: 'Mode: replace (default), keep (add mirrored), fuse (symmetric part)',
      },
    ],
    validate(params, context) {
      if (!context.selection?.length) return 'Nothing selected';
      const plane = params.plane.toLowerCase();
      if (!['xy', 'xz', 'yz'].includes(plane)) {
        return `Invalid plane: ${params.plane}. Use xy, xz, or yz`;
      }
      const mode = params.mode.toLowerCase();
      if (!['replace', 'keep', 'fuse'].includes(mode)) {
        return `Invalid mode: ${params.mode}. Use replace, keep, or fuse`;
      }
      return true;
    },
    async execute(params, context) {
      const results = [];
      const plane = params.plane.toLowerCase();
      const mode = params.mode.toLowerCase();

      for (const id of context.selection) {
        // Get original body info
        const originalBody = context.document?.bodies?.get(id) || context.document?.getBody?.(id);
        const originalName = originalBody?.name || 'Shape';

        let result;

        if (mode === 'fuse') {
          // Mirror and fuse to create symmetric part
          result = await krnl.mirrorSymmetric(id, plane, true);

          // Remove old shape and add fused result
          await krnl.deleteShape(id);
          if (context.document?.removeBody) {
            context.document.removeBody(id);
          }
          if (context.document?.addBody) {
            context.document.addBody(result.id, {
              ...result,
              type: 'mirrorSymmetric',
              name: `${originalName}_symmetric`,
            });
          }
        } else {
          // Simple mirror
          result = await krnl.mirror(id, plane);

          if (mode === 'keep') {
            // Keep original, add mirrored as new body
            if (context.document?.addBody) {
              context.document.addBody(result.id, {
                ...result,
                type: 'mirror',
                name: `${originalName}_mirrored`,
              });
            }
          } else {
            // Replace original with mirrored
            await krnl.deleteShape(id);
            if (context.document?.removeBody) {
              context.document.removeBody(id);
            }
            if (context.document?.addBody) {
              context.document.addBody(result.id, {
                ...result,
                type: 'mirror',
                name: originalName,
              });
            }
          }
        }

        results.push(result);
      }

      return results;
    },
  });

  // COPY - Copy selected objects
  registerCommand('copy', {
    aliases: ['cp', 'duplicate', 'dup'],
    description: 'Copy selected objects with optional offset',
    category: 'transform',
    params: [
      {
        name: 'dx',
        type: 'number',
        required: false,
        default: 10,
        description: 'X offset for copy',
      },
      { name: 'dy', type: 'number', required: false, default: 0, description: 'Y offset' },
      { name: 'dz', type: 'number', required: false, default: 0, description: 'Z offset' },
    ],
    validate(params, context) {
      if (!context.selection?.length) return 'Nothing selected';
      return true;
    },
    async execute(params, context) {
      const results = [];

      for (const id of context.selection) {
        const result = await kernel.copy(id, params.dx, params.dy, params.dz);
        results.push(result);

        // Add copy to document
        if (context.document && result.id) {
          context.document.addBody(result.id, result);
        }
      }

      return results;
    },
  });

  // ARRAY - Create array of copies (legacy - creates separate shapes)
  registerCommand('array', {
    aliases: ['repeat'],
    description: 'Create separate copies in a pattern (use "pattern linear" for B-Rep compound)',
    category: 'transform',
    params: [
      { name: 'count', type: 'int', required: true, description: 'Number of copies' },
      { name: 'dx', type: 'number', required: false, default: 10, description: 'X spacing' },
      { name: 'dy', type: 'number', required: false, default: 0, description: 'Y spacing' },
      { name: 'dz', type: 'number', required: false, default: 0, description: 'Z spacing' },
    ],
    validate(params, context) {
      if (!context.selection?.length) return 'Nothing selected';
      if (params.count < 1) return 'Count must be at least 1';
      if (params.count > 1000) return 'Count too large (max 1000)';
      return true;
    },
    async execute(params, context) {
      const results = [];

      for (const id of context.selection) {
        for (let i = 1; i <= params.count; i++) {
          const result = await kernel.copy(id, params.dx * i, params.dy * i, params.dz * i);
          results.push(result);

          if (context.document && result.id) {
            context.document.addBody(result.id, result);
          }
        }
      }

      return results;
    },
  });

  // PATTERN - Create linear, circular, or path patterns as B-Rep compound
  registerCommand('pattern', {
    aliases: ['pat'],
    description:
      'Create patterns:\n' +
      '  pattern linear x 5 20         - 5 copies, 20mm spacing on X\n' +
      '  pattern linear x 5 20 y 3 15  - Grid pattern: 5×3 copies\n' +
      '  pattern circular z 8          - 8 copies around Z (full 360°)\n' +
      '  pattern circular z 6 180      - 6 copies spanning 180°\n' +
      '  pattern path <pathId> 10      - 10 copies along path',
    category: 'transform',
    params: [
      {
        name: 'type',
        type: 'string',
        required: true,
        description: 'Pattern type: linear, circular, or path',
      },
      {
        name: 'arg1',
        type: 'string',
        required: true,
        description: 'For linear/circular: axis. For path: pathId',
      },
      {
        name: 'count1',
        type: 'int',
        required: true,
        description: 'Number of copies in first direction (or total for path)',
      },
      {
        name: 'arg3',
        type: 'number',
        required: false,
        default: null,
        description: 'For linear: spacing. For circular: angle (default 360). For path: not used',
      },
      {
        name: 'axis2',
        type: 'string',
        required: false,
        default: null,
        description: 'Second axis for grid pattern (x/y/z)',
      },
      {
        name: 'count2',
        type: 'int',
        required: false,
        default: 1,
        description: 'Copies in second direction for grid',
      },
      {
        name: 'spacing2',
        type: 'number',
        required: false,
        default: 0,
        description: 'Spacing in second direction for grid',
      },
    ],
    validate(params, context) {
      if (!context.selection?.length) return 'Nothing selected';
      const type = params.type.toLowerCase();
      if (!['linear', 'lin', 'l', 'circular', 'circ', 'c', 'path', 'p'].includes(type)) {
        return `Unknown pattern type: ${params.type}. Supported: linear, circular, path`;
      }
      if (params.count1 < 1) return 'Count must be at least 1';
      if (params.count1 > 1000) return 'Count too large (max 1000)';
      if (params.count2 > 100) return 'Second direction count too large (max 100)';

      const isLinear = ['linear', 'lin', 'l'].includes(type);
      if (isLinear && params.arg3 !== null && params.arg3 <= 0) {
        return 'Linear pattern requires positive spacing';
      }
      return true;
    },
    async execute(params, context) {
      const results = [];
      const type = params.type.toLowerCase();
      const isCircular = ['circular', 'circ', 'c'].includes(type);
      const isPath = ['path', 'p'].includes(type);

      // Helper to parse axis string to direction vector
      const parseAxis = axisStr => {
        axisStr = (axisStr || 'x').toLowerCase();
        const axisMap = {
          x: [1, 0, 0],
          y: [0, 1, 0],
          z: [0, 0, 1],
          '-x': [-1, 0, 0],
          '-y': [0, -1, 0],
          '-z': [0, 0, -1],
        };
        if (axisMap[axisStr]) return axisMap[axisStr];

        // Try to parse as vector "x,y,z"
        const parts = axisStr.split(',').map(p => parseFloat(p.trim()));
        if (parts.length === 3 && parts.every(p => !isNaN(p))) {
          const len = Math.sqrt(parts[0] ** 2 + parts[1] ** 2 + parts[2] ** 2);
          if (len < 1e-10) throw new Error('Direction vector cannot be zero');
          return [parts[0] / len, parts[1] / len, parts[2] / len];
        }
        throw new Error(`Invalid axis: ${axisStr}. Use x, y, z, -x, -y, -z, or x,y,z vector`);
      };

      if (isPath) {
        // Pattern along path
        const pathId = params.arg1;
        const count = params.count1;

        for (const id of context.selection) {
          const result = await krnl.patternAlongPath(id, pathId, count, true);
          results.push(result);

          if (context.document && result.id) {
            context.document.addBody(result.id, {
              ...result,
              type: 'pathPattern',
              sourceId: id,
              params: { pathId, count },
            });
          }
        }
      } else if (isCircular) {
        // Circular pattern
        const axisDirection = parseAxis(params.arg1);
        const angle = params.arg3 !== null ? params.arg3 : 360;

        for (const id of context.selection) {
          const result = await krnl.circularPattern(
            id,
            params.count1,
            angle,
            [0, 0, 0], // axis origin at world origin
            axisDirection
          );
          results.push(result);

          if (context.document && result.id) {
            context.document.addBody(result.id, {
              ...result,
              type: 'circularPattern',
              sourceId: id,
              params: {
                count: params.count1,
                angle,
                axisDirection,
              },
            });
          }
        }
      } else {
        // Linear pattern (with optional second direction for grid)
        const direction1 = parseAxis(params.arg1);
        const spacing1 = params.arg3 || 10;
        const hasSecondDirection = params.axis2 && params.count2 > 1;

        if (hasSecondDirection) {
          // Grid pattern (2D)
          const direction2 = parseAxis(params.axis2);

          for (const id of context.selection) {
            const result = await krnl.linearPatternGrid(
              id,
              direction1,
              params.count1,
              spacing1,
              direction2,
              params.count2,
              params.spacing2 || spacing1
            );
            results.push(result);

            if (context.document && result.id) {
              context.document.addBody(result.id, {
                ...result,
                type: 'linearPatternGrid',
                sourceId: id,
                params: {
                  count1: params.count1,
                  spacing1,
                  direction1,
                  count2: params.count2,
                  spacing2: params.spacing2 || spacing1,
                  direction2,
                },
              });
            }
          }
        } else {
          // Simple linear pattern (1D)
          for (const id of context.selection) {
            const result = await krnl.linearPattern(id, direction1, params.count1, spacing1);
            results.push(result);

            if (context.document && result.id) {
              context.document.addBody(result.id, {
                ...result,
                type: 'linearPattern',
                sourceId: id,
                params: {
                  count: params.count1,
                  spacing: spacing1,
                  direction: direction1,
                },
              });
            }
          }
        }
      }

      return results;
    },
  });

  // DRAFT - Apply draft angle for manufacturing
  registerCommand('draft', {
    aliases: ['draftangle', 'taper'],
    description: 'Apply draft angle to faces for manufacturing (injection molding, casting)',
    usage:
      'draft <angle> [direction]\n  draft 3       - 3° draft on selected/auto faces, Z pull direction\n  draft 5 x     - 5° draft, X pull direction\n  draft 2 0,0,1 - 2° draft, custom direction vector',
    category: 'transform',
    params: [
      {
        name: 'angle',
        type: 'number',
        required: true,
        description: 'Draft angle in degrees (typically 1-5°)',
      },
      {
        name: 'direction',
        type: 'string',
        required: false,
        default: 'z',
        description: 'Pull direction: x, y, z, -x, -y, -z, or x,y,z vector',
      },
    ],
    validate(params, context) {
      if (!context.selection?.length) return 'Nothing selected';
      if (params.angle <= 0 || params.angle >= 90) {
        return 'Draft angle must be between 0 and 90 degrees';
      }
      return true;
    },
    async execute(params, context) {
      const results = [];

      for (const id of context.selection) {
        // Get original body info
        const originalBody = context.document?.bodies?.get(id) || context.document?.getBody?.(id);
        const originalName = originalBody?.name || 'Shape';

        // Apply draft using kernel bridge
        // Pass null for faceIds to auto-select vertical walls
        const result = await krnl.draft(
          id,
          params.angle,
          params.direction,
          null, // auto-select faces
          null // neutral plane at origin
        );

        // Remove old shape from kernel
        await krnl.deleteShape(id);

        // Update document: remove old, add new
        if (context.document?.removeBody) {
          context.document.removeBody(id);
        }
        if (context.document?.addBody) {
          context.document.addBody(result.id, {
            ...result,
            type: 'draft',
            name: originalName,
            params: {
              angle: params.angle,
              direction: params.direction,
            },
          });
        }

        results.push(result);
      }

      return results;
    },
  });
}

export default { registerTransformCommands };
