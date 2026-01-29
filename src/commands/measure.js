/**
 * Ameri-CAD Measure Commands
 *
 * Commands for measuring distances and angles in CAD geometry.
 */

import { registerCommand } from '../core/commands.js';
import { MeasureMode } from '../ui/measure-tool.js';

/**
 * Register all measure commands
 */
export function registerMeasureCommands(_app) {
  // MEASURE - Enter measure mode or show submenu
  registerCommand('measure', {
    aliases: ['m', 'dist', 'dimension'],
    description: 'Measure distances and angles between geometry',
    category: 'tools',
    params: [
      {
        name: 'subcommand',
        type: 'string',
        required: false,
        description: 'Subcommand: distance, angle, clear, or list',
      },
    ],
    execute(params, context) {
      const measureTool = context.measureTool || context.app?.measureTool;

      if (!measureTool) {
        return 'Measure tool not available';
      }

      const subcommand = params.subcommand?.toLowerCase();

      switch (subcommand) {
        case 'distance':
        case 'dist':
        case 'd':
          measureTool.activate(MeasureMode.DISTANCE);
          return 'Measure mode: DISTANCE - Click two points to measure';

        case 'angle':
        case 'ang':
        case 'a':
          measureTool.activate(MeasureMode.ANGLE);
          return 'Measure mode: ANGLE - Click two faces to measure angle';

        case 'clear':
        case 'reset':
          return measureTool.clearAll();

        case 'list':
        case 'ls':
          const measurements = measureTool.getMeasurements();
          if (measurements.length === 0) {
            return 'No measurements';
          }
          return measurements
            .map(m => {
              if (m.type === 'distance') {
                return `${m.id}: ${m.data.distance.toFixed(2)} mm`;
              } else if (m.type === 'angle') {
                return `${m.id}: ${m.data.angle.toFixed(1)}°`;
              }
              return `${m.id}: ${m.type}`;
            })
            .join('\n');

        case 'off':
        case 'exit':
        case 'cancel':
          measureTool.deactivate();
          return 'Measure mode deactivated';

        default:
          // No subcommand - toggle distance mode
          if (measureTool.active) {
            measureTool.deactivate();
            return 'Measure mode deactivated';
          } else {
            measureTool.activate(MeasureMode.DISTANCE);
            return 'Measure mode: DISTANCE - Click two points to measure';
          }
      }
    },
  });

  // DISTANCE - Shortcut for measure distance
  registerCommand('distance', {
    aliases: ['len', 'length'],
    description: 'Measure distance between two points',
    category: 'tools',
    execute(params, context) {
      const measureTool = context.measureTool || context.app?.measureTool;

      if (!measureTool) {
        return 'Measure tool not available';
      }

      measureTool.activate(MeasureMode.DISTANCE);
      return 'Measure mode: DISTANCE - Click two points to measure';
    },
  });

  // ANGLE - Shortcut for measure angle
  registerCommand('angle', {
    aliases: ['ang'],
    description: 'Measure angle between two faces or edges',
    category: 'tools',
    execute(params, context) {
      const measureTool = context.measureTool || context.app?.measureTool;

      if (!measureTool) {
        return 'Measure tool not available';
      }

      measureTool.activate(MeasureMode.ANGLE);
      return 'Measure mode: ANGLE - Click two faces to measure angle';
    },
  });

  // CLEARMEASURE - Clear all measurements
  registerCommand('clearmeasure', {
    aliases: ['clearmeasurements', 'clearmsmt'],
    description: 'Clear all measurement annotations',
    category: 'tools',
    execute(params, context) {
      const measureTool = context.measureTool || context.app?.measureTool;

      if (!measureTool) {
        return 'Measure tool not available';
      }

      return measureTool.clearAll();
    },
  });
}

export default { registerMeasureCommands };
