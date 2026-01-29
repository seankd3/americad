/**
 * Ameri-CAD Hole Wizard Commands
 *
 * Commands for creating standardized holes: simple, counterbore, countersink, tapped.
 * Supports standard fastener sizes (metric and imperial).
 */

import { registerCommand } from '../core/commands.js';
import {
  getStandardHoleParams,
  parseThreadSpec,
  listStandardSizes,
} from '../data/hole-standards.js';

/**
 * Default direction (into top face, -Z)
 */
const DEFAULT_DIRECTION = { x: 0, y: 0, z: -1 };

/**
 * Default position (center of XY plane)
 */
const DEFAULT_POSITION = { x: 0, y: 0, z: 0 };

/**
 * Parse position from string like "10,20" or "10,20,30"
 */
function parsePosition(posStr, defaultZ = 0) {
  if (!posStr) return null;
  if (typeof posStr === 'object') return posStr;

  const parts = posStr.split(',').map(s => parseFloat(s.trim()));
  if (parts.length === 2) {
    return { x: parts[0], y: parts[1], z: defaultZ };
  } else if (parts.length === 3) {
    return { x: parts[0], y: parts[1], z: parts[2] };
  }
  throw new Error(`Invalid position format: ${posStr}. Use "x,y" or "x,y,z"`);
}

/**
 * Parse direction from string like "0,0,-1" or axis name like "z", "-z"
 */
function parseDirection(dirStr) {
  if (!dirStr) return null;
  if (typeof dirStr === 'object') return dirStr;

  // Named directions
  const named = {
    x: { x: 1, y: 0, z: 0 },
    '-x': { x: -1, y: 0, z: 0 },
    y: { x: 0, y: 1, z: 0 },
    '-y': { x: 0, y: -1, z: 0 },
    z: { x: 0, y: 0, z: 1 },
    '-z': { x: 0, y: 0, z: -1 },
  };

  if (named[dirStr.toLowerCase()]) {
    return named[dirStr.toLowerCase()];
  }

  // Parse as vector
  const parts = dirStr.split(',').map(s => parseFloat(s.trim()));
  if (parts.length === 3) {
    return { x: parts[0], y: parts[1], z: parts[2] };
  }

  throw new Error(`Invalid direction format: ${dirStr}. Use "x,y,z" or axis name like "z", "-z"`);
}

/**
 * Register all hole wizard commands
 */
export function registerHoleCommands(kernel) {
  // HOLE - Main hole command with subcommands
  registerCommand('hole', {
    aliases: ['h'],
    description: 'Create a hole (use: hole simple|counterbore|countersink|tap ...)',
    category: 'feature',
    params: [
      {
        name: 'type',
        type: 'string',
        required: true,
        description: 'Hole type: simple, counterbore (cbore), countersink (csink), tap',
      },
      { name: 'args', type: 'rest', description: 'Type-specific arguments' },
    ],
    async execute(params, context) {
      // Delegate to specific hole type
      const holeType = params.type?.toLowerCase();

      // Get selected shape if available
      const shapeId = context.selection?.[0];
      if (!shapeId) {
        throw new Error('Select a shape to add hole to');
      }

      // Parse rest args based on type
      const args = params.args || [];

      switch (holeType) {
        case 'simple':
        case 's':
          return executeSimpleHole(kernel, shapeId, args, context);

        case 'counterbore':
        case 'cbore':
        case 'cb':
          return executeCounterboreHole(kernel, shapeId, args, context);

        case 'countersink':
        case 'csink':
        case 'cs':
          return executeCountersinkHole(kernel, shapeId, args, context);

        case 'tap':
        case 'tapped':
        case 't':
          return executeTappedHole(kernel, shapeId, args, context);

        default:
          throw new Error(
            `Unknown hole type: ${holeType}. Use: simple, counterbore, countersink, tap`
          );
      }
    },
  });

  // HOLE SIMPLE - Direct simple hole command
  registerCommand('hole-simple', {
    aliases: ['simplehole', 'drillhole'],
    description: 'Create a simple cylindrical hole',
    category: 'feature',
    params: [
      { name: 'diameter', type: 'number', required: true, description: 'Hole diameter' },
      {
        name: 'depth',
        type: 'number',
        required: false,
        default: 0,
        description: 'Depth (0 = through-all)',
      },
      {
        name: 'position',
        type: 'string',
        required: false,
        description: 'Position "x,y" or "x,y,z"',
      },
      {
        name: 'direction',
        type: 'string',
        required: false,
        default: '-z',
        description: 'Direction (axis or "x,y,z")',
      },
    ],
    validate(params) {
      if (params.diameter <= 0) return 'Diameter must be positive';
      if (params.depth < 0) return 'Depth cannot be negative';
      return true;
    },
    async execute(params, context) {
      const shapeId = context.selection?.[0];
      if (!shapeId) throw new Error('Select a shape to add hole to');

      const position = parsePosition(params.position) || context.clickPosition || DEFAULT_POSITION;
      const direction = parseDirection(params.direction) || DEFAULT_DIRECTION;

      const result = await kernel.createSimpleHole(
        shapeId,
        position,
        direction,
        params.diameter,
        params.depth
      );

      if (context.document) {
        context.document.updateBody(shapeId, result.id, {
          type: 'simpleHole',
          params: { diameter: params.diameter, depth: params.depth, position, direction },
          mesh: result.mesh,
        });
      }

      return result;
    },
  });

  // HOLE COUNTERBORE - Direct counterbore command
  registerCommand('hole-cbore', {
    aliases: ['counterbore', 'cbore'],
    description: 'Create a counterbore hole for socket head screws',
    category: 'feature',
    params: [
      { name: 'holeDiameter', type: 'number', required: true, description: 'Main hole diameter' },
      { name: 'cbDiameter', type: 'number', required: true, description: 'Counterbore diameter' },
      { name: 'cbDepth', type: 'number', required: true, description: 'Counterbore depth' },
      {
        name: 'holeDepth',
        type: 'number',
        required: false,
        default: 0,
        description: 'Total depth (0 = through-all)',
      },
      {
        name: 'position',
        type: 'string',
        required: false,
        description: 'Position "x,y" or "x,y,z"',
      },
      {
        name: 'direction',
        type: 'string',
        required: false,
        default: '-z',
        description: 'Direction',
      },
    ],
    validate(params) {
      if (params.holeDiameter <= 0) return 'Hole diameter must be positive';
      if (params.cbDiameter <= params.holeDiameter)
        return 'Counterbore diameter must be larger than hole';
      if (params.cbDepth <= 0) return 'Counterbore depth must be positive';
      return true;
    },
    async execute(params, context) {
      const shapeId = context.selection?.[0];
      if (!shapeId) throw new Error('Select a shape to add hole to');

      const position = parsePosition(params.position) || context.clickPosition || DEFAULT_POSITION;
      const direction = parseDirection(params.direction) || DEFAULT_DIRECTION;

      const result = await kernel.createCounterboreHole(
        shapeId,
        position,
        direction,
        params.holeDiameter,
        params.cbDiameter,
        params.cbDepth,
        params.holeDepth
      );

      if (context.document) {
        context.document.updateBody(shapeId, result.id, {
          type: 'counterboreHole',
          params: { ...params, position, direction },
          mesh: result.mesh,
        });
      }

      return result;
    },
  });

  // HOLE COUNTERSINK - Direct countersink command
  registerCommand('hole-csink', {
    aliases: ['countersink', 'csink'],
    description: 'Create a countersink hole for flat head screws',
    category: 'feature',
    params: [
      { name: 'holeDiameter', type: 'number', required: true, description: 'Main hole diameter' },
      {
        name: 'csDiameter',
        type: 'number',
        required: true,
        description: 'Countersink top diameter',
      },
      {
        name: 'csAngle',
        type: 'number',
        required: false,
        default: 82,
        description: 'Countersink angle (82°, 90°, 100°)',
      },
      {
        name: 'holeDepth',
        type: 'number',
        required: false,
        default: 0,
        description: 'Total depth (0 = through-all)',
      },
      {
        name: 'position',
        type: 'string',
        required: false,
        description: 'Position "x,y" or "x,y,z"',
      },
      {
        name: 'direction',
        type: 'string',
        required: false,
        default: '-z',
        description: 'Direction',
      },
    ],
    validate(params) {
      if (params.holeDiameter <= 0) return 'Hole diameter must be positive';
      if (params.csDiameter <= params.holeDiameter)
        return 'Countersink diameter must be larger than hole';
      if (![82, 90, 100].includes(params.csAngle)) {
        console.warn(`Non-standard countersink angle: ${params.csAngle}°`);
      }
      return true;
    },
    async execute(params, context) {
      const shapeId = context.selection?.[0];
      if (!shapeId) throw new Error('Select a shape to add hole to');

      const position = parsePosition(params.position) || context.clickPosition || DEFAULT_POSITION;
      const direction = parseDirection(params.direction) || DEFAULT_DIRECTION;

      const result = await kernel.createCountersinkHole(
        shapeId,
        position,
        direction,
        params.holeDiameter,
        params.csDiameter,
        params.csAngle,
        params.holeDepth
      );

      if (context.document) {
        context.document.updateBody(shapeId, result.id, {
          type: 'countersinkHole',
          params: { ...params, position, direction },
          mesh: result.mesh,
        });
      }

      return result;
    },
  });

  // HOLE TAP - Direct tapped hole command
  registerCommand('hole-tap', {
    aliases: ['tap', 'tappedhole', 'thread'],
    description: 'Create a tapped hole (visual thread representation)',
    category: 'feature',
    params: [
      {
        name: 'threadSpec',
        type: 'string',
        required: true,
        description: 'Thread spec: M5, M5x0.8, #10, 1/4-20',
      },
      { name: 'depth', type: 'number', required: true, description: 'Thread depth' },
      {
        name: 'position',
        type: 'string',
        required: false,
        description: 'Position "x,y" or "x,y,z"',
      },
      {
        name: 'direction',
        type: 'string',
        required: false,
        default: '-z',
        description: 'Direction',
      },
    ],
    validate(params) {
      if (params.depth <= 0) return 'Depth must be positive';
      try {
        parseThreadSpec(params.threadSpec);
      } catch (e) {
        return `Invalid thread spec: ${e.message}`;
      }
      return true;
    },
    async execute(params, context) {
      const shapeId = context.selection?.[0];
      if (!shapeId) throw new Error('Select a shape to add hole to');

      const position = parsePosition(params.position) || context.clickPosition || DEFAULT_POSITION;
      const direction = parseDirection(params.direction) || DEFAULT_DIRECTION;

      const thread = parseThreadSpec(params.threadSpec);

      const result = await kernel.createTappedHole(
        shapeId,
        position,
        direction,
        thread.nominalDiameter || parseFloat(thread.size.replace('M', '')),
        thread.pitch,
        params.depth
      );

      if (context.document) {
        context.document.updateBody(shapeId, result.id, {
          type: 'tappedHole',
          params: { threadSpec: params.threadSpec, depth: params.depth, position, direction },
          mesh: result.mesh,
          threadInfo: result.threadInfo,
        });
      }

      return result;
    },
  });

  // HOLE STANDARD - Create hole from standard fastener size
  registerCommand('hole-std', {
    aliases: ['standardhole', 'fastenerhole'],
    description: 'Create a hole for a standard fastener (e.g., M5 socket head cap screw)',
    category: 'feature',
    params: [
      {
        name: 'size',
        type: 'string',
        required: true,
        description: 'Fastener size: M3, M5, #10, 1/4, etc.',
      },
      {
        name: 'type',
        type: 'string',
        required: false,
        default: 'simple',
        description: 'Hole type: simple, counterbore, countersink, tap',
      },
      {
        name: 'fit',
        type: 'string',
        required: false,
        default: 'normal',
        description: 'Fit: close, normal, loose',
      },
      {
        name: 'depth',
        type: 'number',
        required: false,
        default: 0,
        description: 'Depth (0 = through-all or standard)',
      },
      {
        name: 'position',
        type: 'string',
        required: false,
        description: 'Position "x,y" or "x,y,z"',
      },
      {
        name: 'direction',
        type: 'string',
        required: false,
        default: '-z',
        description: 'Direction',
      },
    ],
    async execute(params, context) {
      const shapeId = context.selection?.[0];
      if (!shapeId) throw new Error('Select a shape to add hole to');

      const position = parsePosition(params.position) || context.clickPosition || DEFAULT_POSITION;
      const direction = parseDirection(params.direction) || DEFAULT_DIRECTION;

      // Get standard parameters
      const stdParams = getStandardHoleParams(params.size, params.type, params.fit);

      let result;

      switch (params.type.toLowerCase()) {
        case 'simple':
        case 'clearance':
          result = await kernel.createSimpleHole(
            shapeId,
            position,
            direction,
            stdParams.diameter,
            params.depth
          );
          break;

        case 'counterbore':
        case 'cbore':
          result = await kernel.createCounterboreHole(
            shapeId,
            position,
            direction,
            stdParams.holeDiameter,
            stdParams.cbDiameter,
            stdParams.cbDepth,
            params.depth
          );
          break;

        case 'countersink':
        case 'csink':
          result = await kernel.createCountersinkHole(
            shapeId,
            position,
            direction,
            stdParams.holeDiameter,
            stdParams.csDiameter,
            stdParams.csAngle,
            params.depth
          );
          break;

        case 'tap':
        case 'tapped':
          result = await kernel.createTappedHole(
            shapeId,
            position,
            direction,
            parseFloat(params.size.replace('M', '')),
            stdParams.pitch,
            params.depth || 12 // Default tapped hole depth
          );
          break;

        default:
          throw new Error(`Unknown hole type: ${params.type}`);
      }

      if (context.document) {
        context.document.updateBody(shapeId, result.id, {
          type: `standard${params.type}Hole`,
          params: { size: params.size, type: params.type, fit: params.fit, ...stdParams },
          mesh: result.mesh,
        });
      }

      return result;
    },
  });

  // LIST HOLE SIZES - Show available standard sizes
  registerCommand('hole-sizes', {
    aliases: ['holesizes', 'fastenersizes'],
    description: 'List available standard hole sizes',
    category: 'help',
    params: [
      {
        name: 'metric',
        type: 'boolean',
        required: false,
        default: true,
        description: 'Show metric sizes',
      },
      {
        name: 'imperial',
        type: 'boolean',
        required: false,
        default: true,
        description: 'Show imperial sizes',
      },
    ],
    async execute(params) {
      const result = [];

      if (params.metric) {
        result.push('Metric sizes: ' + listStandardSizes(true).join(', '));
      }
      if (params.imperial) {
        result.push('Imperial sizes: ' + listStandardSizes(false).join(', '));
      }

      console.log(result.join('\n'));
      return { sizes: { metric: listStandardSizes(true), imperial: listStandardSizes(false) } };
    },
  });
}

// ==================== Helper Execute Functions ====================

/**
 * Execute simple hole from "hole simple" command args
 */
async function executeSimpleHole(kernel, shapeId, args, context) {
  // Args: diameter [depth] [position] [direction]
  if (args.length < 1) {
    throw new Error('Usage: hole simple <diameter> [depth] [pos:x,y,z] [dir:-z]');
  }

  const diameter = parseFloat(args[0]);
  const depth = args[1] ? parseFloat(args[1]) : 0;
  const position = context.clickPosition || DEFAULT_POSITION;
  const direction = args[2] ? parseDirection(args[2]) : DEFAULT_DIRECTION;

  const result = await kernel.createSimpleHole(shapeId, position, direction, diameter, depth);

  if (context.document) {
    context.document.updateBody(shapeId, result.id, {
      type: 'simpleHole',
      params: { diameter, depth, position, direction },
      mesh: result.mesh,
    });
  }

  return result;
}

/**
 * Execute counterbore hole from "hole counterbore" command args
 */
async function executeCounterboreHole(kernel, shapeId, args, context) {
  // Args: holeDia cbDia cbDepth [holeDepth]
  // Or: M5 (standard size)
  if (args.length < 1) {
    throw new Error(
      'Usage: hole counterbore <holeDia> <cbDia> <cbDepth> [holeDepth]\n       hole counterbore M5 (standard size)'
    );
  }

  let holeDiameter,
    cbDiameter,
    cbDepth,
    holeDepth = 0;
  const position = context.clickPosition || DEFAULT_POSITION;
  const direction = DEFAULT_DIRECTION;

  if (args[0].match(/^[M#]/i) || args[0].includes('/')) {
    // Standard size
    const stdParams = getStandardHoleParams(args[0], 'counterbore');
    holeDiameter = stdParams.holeDiameter;
    cbDiameter = stdParams.cbDiameter;
    cbDepth = stdParams.cbDepth;
    holeDepth = args[1] ? parseFloat(args[1]) : 0;
  } else {
    if (args.length < 3) {
      throw new Error('Counterbore requires: holeDia cbDia cbDepth');
    }
    holeDiameter = parseFloat(args[0]);
    cbDiameter = parseFloat(args[1]);
    cbDepth = parseFloat(args[2]);
    holeDepth = args[3] ? parseFloat(args[3]) : 0;
  }

  const result = await kernel.createCounterboreHole(
    shapeId,
    position,
    direction,
    holeDiameter,
    cbDiameter,
    cbDepth,
    holeDepth
  );

  if (context.document) {
    context.document.updateBody(shapeId, result.id, {
      type: 'counterboreHole',
      params: { holeDiameter, cbDiameter, cbDepth, holeDepth, position, direction },
      mesh: result.mesh,
    });
  }

  return result;
}

/**
 * Execute countersink hole from "hole countersink" command args
 */
async function executeCountersinkHole(kernel, shapeId, args, context) {
  // Args: holeDia csDia [angle] [holeDepth]
  // Or: M5 [angle]
  if (args.length < 1) {
    throw new Error(
      'Usage: hole countersink <holeDia> <csDia> [angle:82] [holeDepth]\n       hole countersink M5 [angle:82]'
    );
  }

  let holeDiameter,
    csDiameter,
    csAngle = 82,
    holeDepth = 0;
  const position = context.clickPosition || DEFAULT_POSITION;
  const direction = DEFAULT_DIRECTION;

  if (args[0].match(/^[M#]/i) || args[0].includes('/')) {
    // Standard size
    const stdParams = getStandardHoleParams(args[0], 'countersink');
    holeDiameter = stdParams.holeDiameter;
    csDiameter = stdParams.csDiameter;
    csAngle = args[1] ? parseFloat(args[1]) : stdParams.csAngle;
    holeDepth = args[2] ? parseFloat(args[2]) : 0;
  } else {
    if (args.length < 2) {
      throw new Error('Countersink requires: holeDia csDia');
    }
    holeDiameter = parseFloat(args[0]);
    csDiameter = parseFloat(args[1]);
    csAngle = args[2] ? parseFloat(args[2]) : 82;
    holeDepth = args[3] ? parseFloat(args[3]) : 0;
  }

  const result = await kernel.createCountersinkHole(
    shapeId,
    position,
    direction,
    holeDiameter,
    csDiameter,
    csAngle,
    holeDepth
  );

  if (context.document) {
    context.document.updateBody(shapeId, result.id, {
      type: 'countersinkHole',
      params: { holeDiameter, csDiameter, csAngle, holeDepth, position, direction },
      mesh: result.mesh,
    });
  }

  return result;
}

/**
 * Execute tapped hole from "hole tap" command args
 */
async function executeTappedHole(kernel, shapeId, args, context) {
  // Args: threadSpec depth
  // threadSpec: M5, M5x0.8, #10-24, 1/4-20
  if (args.length < 2) {
    throw new Error('Usage: hole tap <threadSpec> <depth>\n       e.g., hole tap M5 12');
  }

  const thread = parseThreadSpec(args[0]);
  const depth = parseFloat(args[1]);
  const position = context.clickPosition || DEFAULT_POSITION;
  const direction = DEFAULT_DIRECTION;

  const nominalDiameter = thread.nominalDiameter || parseFloat(thread.size.replace(/^[M#]/, ''));

  const result = await kernel.createTappedHole(
    shapeId,
    position,
    direction,
    nominalDiameter,
    thread.pitch,
    depth
  );

  if (context.document) {
    context.document.updateBody(shapeId, result.id, {
      type: 'tappedHole',
      params: { threadSpec: args[0], depth, position, direction },
      mesh: result.mesh,
      threadInfo: result.threadInfo,
    });
  }

  return result;
}

export default { registerHoleCommands };
