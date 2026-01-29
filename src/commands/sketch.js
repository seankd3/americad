/**
 * Ameri-CAD Sketch Commands
 *
 * Commands for creating and editing 2D sketches.
 */

import { registerCommand } from '../core/commands.js';
import {
  sketchManager,
  SketchMode,
  ConstraintType,
  SketchLine,
  SketchCircle,
  SketchArc,
} from '../sketch/sketch-manager.js';
import { solveSketch } from '../sketch/constraint-solver.js';
import { snapManager } from '../ui/snap-manager.js';
import { trimEntity } from '../sketch/trim.js';
import { extendEntity } from '../sketch/extend.js';
import {
  detectProfiles as _detectProfiles,
  getExtrudeDirection as _getExtrudeDirection,
  getOuterProfiles as _getOuterProfiles,
} from '../sketch/profile-detector.js';

/**
 * Register all sketch-related commands
 */
export function registerSketchCommands(_context) {
  // SKETCH - Enter sketch mode
  registerCommand('sketch', {
    aliases: ['sk'],
    description: 'Enter sketch mode on a plane',
    category: 'sketch',
    params: [
      {
        name: 'plane',
        type: 'string',
        required: false,
        default: 'xy',
        description: 'Plane to sketch on (xy, xz, yz)',
      },
    ],
    validate(params) {
      const validPlanes = ['xy', 'xz', 'yz'];
      if (params.plane && !validPlanes.includes(params.plane.toLowerCase())) {
        return `Invalid plane: ${params.plane}. Use xy, xz, or yz`;
      }
      return true;
    },
    async execute(params, ctx) {
      const plane = (params.plane || 'xy').toLowerCase();

      if (ctx.enterSketchMode) {
        ctx.enterSketchMode(plane);
        return { success: true, plane };
      }

      return { success: false, error: 'Sketch mode not available' };
    },
  });

  // EXIT - Exit sketch mode (quick exit without profile info)
  registerCommand('exit', {
    aliases: ['quit', 'q'],
    description: 'Exit sketch mode quickly',
    category: 'sketch',
    params: [],
    async execute(_params, ctx) {
      if (ctx.exitSketchMode) {
        const sketch = ctx.exitSketchMode();
        return { success: true, sketch: sketch?.id };
      }
      return { success: false, error: 'Not in sketch mode' };
    },
  });

  // LINE - Set line drawing mode
  registerCommand('line', {
    aliases: ['l'],
    description: 'Line drawing tool (in sketch mode)',
    category: 'sketch',
    params: [],
    async execute(params, ctx) {
      if (!ctx.inSketchMode) {
        return { success: false, error: 'Enter sketch mode first' };
      }
      sketchManager.setMode(SketchMode.LINE);
      return { success: true, mode: 'line' };
    },
  });

  // RECTANGLE - Set rectangle drawing mode
  registerCommand('rect', {
    aliases: ['rectangle', 'r'],
    description: 'Rectangle drawing tool (in sketch mode)',
    category: 'sketch',
    params: [],
    async execute(params, ctx) {
      if (!ctx.inSketchMode) {
        return { success: false, error: 'Enter sketch mode first' };
      }
      sketchManager.setMode(SketchMode.RECTANGLE);
      return { success: true, mode: 'rectangle' };
    },
  });

  // CIRCLE - Set circle drawing mode
  registerCommand('circle', {
    aliases: ['c', 'cir'],
    description: 'Circle drawing tool (in sketch mode)',
    category: 'sketch',
    params: [],
    async execute(params, ctx) {
      if (!ctx.inSketchMode) {
        return { success: false, error: 'Enter sketch mode first' };
      }
      sketchManager.setMode(SketchMode.CIRCLE);
      return { success: true, mode: 'circle' };
    },
  });

  // ARC - Set arc drawing mode
  registerCommand('arc', {
    aliases: ['a'],
    description: 'Three-point arc drawing tool (in sketch mode)',
    category: 'sketch',
    params: [],
    async execute(params, ctx) {
      if (!ctx.inSketchMode) {
        return { success: false, error: 'Enter sketch mode first' };
      }
      sketchManager.setMode(SketchMode.ARC);
      return { success: true, mode: 'arc' };
    },
  });

  // SPLINE - Set spline drawing mode
  registerCommand('spline', {
    aliases: ['sp', 'curve', 'bezier'],
    description:
      'Spline curve drawing tool (in sketch mode). Click to add points, Enter/double-click to finish.',
    category: 'sketch',
    params: [
      {
        name: 'action',
        type: 'string',
        required: false,
        description: 'Optional action: "close" to close the spline',
      },
    ],
    async execute(params, ctx) {
      if (!ctx.inSketchMode) {
        return { success: false, error: 'Enter sketch mode first' };
      }

      if (params.action === 'close') {
        // Close the current spline
        const spline = sketchManager.finishSpline(true);
        if (spline) {
          return { success: true, action: 'closed', splineId: spline.id };
        }
        return { success: false, error: 'No spline to close' };
      }

      sketchManager.setMode(SketchMode.SPLINE);
      return { success: true, mode: 'spline' };
    },
  });

  // EXTRUDE - Extrude sketch profiles (Fusion 360-style)
  registerCommand('extrude', {
    aliases: ['ext', 'push', 'e'],
    description:
      'Extrude sketch profile into 3D. Supports: extrude 50, extrude -50 (reverse), ' +
      'extrude 50 symmetric, extrude 50 new, extrude 50 cut, extrude 50 toface',
    category: 'sketch',
    params: [
      {
        name: 'height',
        type: 'number',
        required: false,
        description: 'Extrusion height (negative = reverse direction)',
      },
      {
        name: 'mode',
        type: 'string',
        required: false,
        default: 'join',
        description: 'Operation: join (default), new, cut, intersect, symmetric, toface',
      },
    ],
    validate(params) {
      if (params.height !== undefined && params.height === 0) {
        return 'Height cannot be zero';
      }
      const validModes = ['join', 'new', 'cut', 'intersect', 'symmetric', 'toface', 'both'];
      if (params.mode && !validModes.includes(params.mode.toLowerCase())) {
        return `Invalid mode: ${params.mode}. Use: ${validModes.join(', ')}`;
      }
      return true;
    },
    async execute(params, ctx) {
      // Parse height and direction
      let height = params.height;
      const mode = (params.mode || 'join').toLowerCase();
      let direction = 'normal';

      // Handle negative height as reverse direction
      if (height < 0) {
        height = Math.abs(height);
        direction = 'reverse';
      }

      // Symmetric mode splits height in both directions
      if (mode === 'symmetric' || mode === 'both') {
        direction = 'both';
        // Height stays the same - will be split 50/50 in each direction
      }

      // If no height specified, prompt for it or use default
      if (height === undefined || height === null) {
        // Try to get from selected profile or use default
        height = 10; // Default fallback
      }

      // Call the context's extrude function with enhanced options
      if (ctx.extrudeSketch) {
        const options = {
          height: height,
          direction: direction,
          operation: mode === 'symmetric' || mode === 'both' ? 'join' : mode,
        };

        await ctx.extrudeSketch(height, options);

        return {
          success: true,
          height: height,
          direction: direction,
          operation: options.operation,
        };
      }
      return { success: false, error: 'Extrude not available' };
    },
  });

  // FINISH - Exit sketch mode (trigger profile detection)
  registerCommand('finish', {
    aliases: ['done', 'ok'],
    description: 'Finish sketch mode and detect profiles for extrusion',
    category: 'sketch',
    params: [],
    async execute(_params, ctx) {
      if (!ctx.inSketchMode) {
        return { success: false, error: 'Not in sketch mode' };
      }

      // Exit sketch mode - this triggers profile detection
      if (ctx.exitSketchMode) {
        const sketch = ctx.exitSketchMode();

        // Detect profiles in the completed sketch
        let profileCount = 0;
        if (sketch && sketch.getClosedProfiles) {
          const profiles = sketch.getClosedProfiles();
          profileCount = profiles.length;
        }

        return {
          success: true,
          sketch: sketch?.id,
          profilesDetected: profileCount,
          message:
            profileCount > 0
              ? `Sketch finished. ${profileCount} profile(s) detected. Use 'extrude <height>' to create solid.`
              : 'Sketch finished. No closed profiles found - draw closed shapes to extrude.',
        };
      }

      return { success: false, error: 'Exit sketch mode not available' };
    },
  });

  // PROFILES - List and select detected profiles
  registerCommand('profiles', {
    aliases: ['prof', 'regions'],
    description: 'List detected profiles in the current or last sketch',
    category: 'sketch',
    params: [
      {
        name: 'index',
        type: 'number',
        required: false,
        description: 'Profile index to select (1-based)',
      },
    ],
    async execute(params, ctx) {
      // Get the active sketch or the last sketch
      const sketch =
        (ctx.inSketchMode && sketchManager.activeSketch) ||
        (ctx.sketches && ctx.sketches[ctx.sketches.length - 1]) ||
        sketchManager.activeSketch;

      if (!sketch) {
        return { success: false, error: 'No sketch available' };
      }

      // Detect profiles using enhanced detector
      const profiles = detectProfiles(sketch);

      if (profiles.length === 0) {
        return {
          success: true,
          profiles: [],
          message: 'No closed profiles detected. Draw closed shapes (rectangles, circles, or connected lines).',
        };
      }

      // Filter to outer profiles only for listing
      const outerProfiles = getOuterProfiles(profiles);

      // If an index is provided, select that profile
      if (params.index !== undefined) {
        const idx = params.index - 1; // Convert to 0-based
        if (idx < 0 || idx >= outerProfiles.length) {
          return {
            success: false,
            error: `Invalid profile index. Use 1-${outerProfiles.length}`,
          };
        }

        const selectedProfile = outerProfiles[idx];

        // Store selected profile for extrusion
        if (ctx.setSelectedProfile) {
          ctx.setSelectedProfile(selectedProfile);
        }

        // Highlight the profile visually
        if (ctx.highlightProfile) {
          ctx.highlightProfile(selectedProfile);
        }

        return {
          success: true,
          selected: idx + 1,
          profile: {
            id: selectedProfile.id,
            type: selectedProfile.type,
            area: selectedProfile.area?.toFixed(2),
            hasHoles: (selectedProfile.holes?.length || 0) > 0,
          },
          message: `Selected profile ${idx + 1}: ${selectedProfile.type}`,
        };
      }

      // List all profiles
      const profileList = outerProfiles.map((p, i) => ({
        index: i + 1,
        id: p.id,
        type: p.type,
        area: p.area?.toFixed(2) || 'N/A',
        holes: p.holes?.length || 0,
        center: p.center || p.centroid,
      }));

      return {
        success: true,
        count: outerProfiles.length,
        profiles: profileList,
        message: `Found ${outerProfiles.length} profile(s). Use 'profiles <n>' to select or 'extrude <height>' to extrude all.`,
      };
    },
  });

  // REVOLVE - Revolve sketch profiles around an axis
  registerCommand('revolve', {
    aliases: ['rev', 'spin', 'lathe'],
    description: 'Revolve sketch profile around an axis (like a lathe)',
    category: 'sketch',
    params: [
      {
        name: 'angle',
        type: 'number',
        required: false,
        default: 360,
        description: 'Revolution angle in degrees',
      },
      {
        name: 'axis',
        type: 'string',
        required: false,
        default: 'y',
        description: 'Revolution axis (x, y, z)',
      },
    ],
    validate(params) {
      if (params.angle <= 0 || params.angle > 360) return 'Angle must be between 0 and 360';
      const validAxes = ['x', 'y', 'z'];
      if (params.axis && !validAxes.includes(params.axis.toLowerCase())) {
        return `Invalid axis: ${params.axis}. Use x, y, or z`;
      }
      return true;
    },
    async execute(params, ctx) {
      if (ctx.revolveSketch) {
        await ctx.revolveSketch(params.angle, params.axis || 'y');
        return { success: true, angle: params.angle, axis: params.axis };
      }
      return { success: false, error: 'Revolve not available' };
    },
  });

  // GRID - Toggle or set grid size
  registerCommand('grid', {
    description: 'Toggle grid or set grid size',
    category: 'sketch',
    params: [
      { name: 'size', type: 'number', required: false, description: 'Grid size (omit to toggle)' },
    ],
    async execute(params, _ctx) {
      if (params.size !== undefined) {
        sketchManager.gridSize = params.size;
        return { success: true, gridSize: params.size };
      } else {
        sketchManager.gridSnap = !sketchManager.gridSnap;
        return { success: true, gridSnap: sketchManager.gridSnap };
      }
    },
  });

  // SNAP - Comprehensive snap control
  // Usage: snap [on|off|<type>] [value]
  // Examples: snap on, snap off, snap grid 10, snap point on, snap endpoint off
  registerCommand('snap', {
    aliases: ['s'],
    description: 'Control snapping (snap on/off, snap grid <size>, snap <type> on/off)',
    category: 'sketch',
    params: [
      {
        name: 'type',
        type: 'string',
        required: false,
        description: 'on/off or snap type (grid, point, midpoint, center, intersection, nearest)',
      },
      { name: 'value', type: 'string', required: false, description: 'on/off or grid size' },
    ],
    async execute(params, _ctx) {
      const type = params.type?.toLowerCase();
      const value = params.value?.toLowerCase();

      // No args - show status
      if (!type) {
        return {
          success: true,
          active: snapManager.active,
          settings: snapManager.getSettings(),
          status: snapManager.getStatusString(),
        };
      }

      // Master toggle: snap on/off
      if (type === 'on') {
        snapManager.setActive(true);
        return { success: true, active: true, message: 'Snapping enabled' };
      }
      if (type === 'off') {
        snapManager.setActive(false);
        return { success: true, active: false, message: 'Snapping disabled' };
      }

      // Grid size: snap grid <size>
      if (type === 'grid') {
        const size = parseFloat(value);
        if (!isNaN(size) && size > 0) {
          snapManager.setGridSize(size);
          sketchManager.gridSize = size;
          return { success: true, gridSize: size, message: `Grid size set to ${size}` };
        } else if (value === 'on' || value === 'off') {
          snapManager.setEnabled('grid', value === 'on');
          sketchManager.gridSnap = value === 'on';
          return { success: true, gridEnabled: value === 'on' };
        } else {
          // Toggle grid snap
          const current = snapManager.enabled.grid;
          snapManager.setEnabled('grid', !current);
          sketchManager.gridSnap = !current;
          return { success: true, gridEnabled: !current };
        }
      }

      // Tolerance: snap tolerance <value>
      if (type === 'tolerance' || type === 'tol') {
        const tol = parseFloat(value);
        if (!isNaN(tol) && tol > 0) {
          snapManager.setTolerance(tol);
          sketchManager.snapTolerance = tol;
          return { success: true, tolerance: tol };
        }
        return { success: false, error: 'Invalid tolerance value' };
      }

      // Snap type toggles: snap point on/off, snap midpoint on/off, etc.
      const snapTypes = {
        point: 'endpoint',
        endpoint: 'endpoint',
        end: 'endpoint',
        mid: 'midpoint',
        midpoint: 'midpoint',
        center: 'center',
        cen: 'center',
        int: 'intersection',
        intersection: 'intersection',
        perp: 'perpendicular',
        perpendicular: 'perpendicular',
        tan: 'tangent',
        tangent: 'tangent',
        near: 'nearest',
        nearest: 'nearest',
      };

      const snapType = snapTypes[type];
      if (snapType) {
        if (value === 'on' || value === 'off') {
          snapManager.setEnabled(snapType, value === 'on');
          if (snapType === 'endpoint') {
            sketchManager.endpointSnap = value === 'on';
          }
          return { success: true, type: snapType, enabled: value === 'on' };
        } else {
          // Toggle
          const current = snapManager.enabled[snapType];
          snapManager.setEnabled(snapType, !current);
          if (snapType === 'endpoint') {
            sketchManager.endpointSnap = !current;
          }
          return { success: true, type: snapType, enabled: !current };
        }
      }

      return {
        success: false,
        error: `Unknown snap type: ${type}. Valid types: grid, point, midpoint, center, intersection, nearest`,
      };
    },
  });

  // DELETE - Delete selected sketch entities
  registerCommand('delete', {
    aliases: ['del', 'rm', 'remove'],
    description: 'Delete selected entities',
    category: 'general',
    params: [],
    async execute(params, ctx) {
      if (ctx.inSketchMode && sketchManager.selectedEntities.size > 0) {
        sketchManager.deleteSelected();
        return { success: true, deleted: sketchManager.selectedEntities.size };
      } else if (ctx.deleteSelected) {
        ctx.deleteSelected();
        return { success: true };
      }
      return { success: false, error: 'Nothing selected' };
    },
  });

  // CONSTRAIN - Add constraint to selected entity
  registerCommand('constrain', {
    aliases: ['con'],
    description: 'Add constraint to selected line (horizontal, vertical)',
    category: 'sketch',
    params: [
      {
        name: 'type',
        type: 'string',
        required: true,
        description: 'Constraint type (horizontal, vertical)',
      },
    ],
    validate(params) {
      const validTypes = ['horizontal', 'vertical', 'h', 'v'];
      if (!validTypes.includes(params.type?.toLowerCase())) {
        return `Invalid constraint type: ${params.type}. Use horizontal or vertical`;
      }
      return true;
    },
    async execute(params, ctx) {
      if (!ctx.inSketchMode) {
        return { success: false, error: 'Enter sketch mode first' };
      }

      const sketch = sketchManager.activeSketch;
      if (!sketch) {
        return { success: false, error: 'No active sketch' };
      }

      // Find selected lines
      const selectedLines = [];
      for (const id of sketchManager.selectedEntities) {
        const entity = sketch.getEntity(id);
        if (entity && sketch.lines.has(id)) {
          selectedLines.push(entity);
        }
      }

      if (selectedLines.length === 0) {
        return { success: false, error: 'Select a line first' };
      }

      // Normalize constraint type
      let constraintType;
      const typeInput = params.type.toLowerCase();
      if (typeInput === 'horizontal' || typeInput === 'h') {
        constraintType = ConstraintType.HORIZONTAL;
      } else if (typeInput === 'vertical' || typeInput === 'v') {
        constraintType = ConstraintType.VERTICAL;
      }

      // Add constraints to all selected lines
      let addedCount = 0;
      for (const line of selectedLines) {
        // Check if already has this constraint
        const existingConstraints = Array.from(sketch.constraints.values()).filter(
          c => c.entities.includes(line.id) && c.type === constraintType
        );

        if (existingConstraints.length === 0) {
          sketch.addConstraint(constraintType, [line.id]);
          addedCount++;
        }
      }

      // Solve the sketch to apply constraints
      const result = solveSketch(sketch);

      // Trigger UI update
      if (ctx.updateSketchView) {
        ctx.updateSketchView();
      } else if (sketchManager.onSketchUpdate) {
        sketchManager.onSketchUpdate(sketch);
      }

      return {
        success: true,
        type: constraintType,
        count: addedCount,
        solverStatus: result.status,
        converged: result.converged,
      };
    },
  });

  // H - Shortcut for horizontal constraint
  registerCommand('h', {
    aliases: ['horizontal'],
    description: 'Make selected line(s) horizontal',
    category: 'sketch',
    params: [],
    async execute(params, ctx) {
      // Delegate to constrain command
      return registerCommand._executeDelegate('constrain', { type: 'horizontal' }, ctx);
    },
  });

  // V - Shortcut for vertical constraint
  registerCommand('v', {
    aliases: ['vertical'],
    description: 'Make selected line(s) vertical',
    category: 'sketch',
    params: [],
    async execute(params, ctx) {
      // Delegate to constrain command
      return registerCommand._executeDelegate('constrain', { type: 'vertical' }, ctx);
    },
  });

  // Internal helper for command delegation
  registerCommand._executeDelegate = async function (cmdName, params, ctx) {
    if (!ctx.inSketchMode) {
      return { success: false, error: 'Enter sketch mode first' };
    }

    const sketch = sketchManager.activeSketch;
    if (!sketch) {
      return { success: false, error: 'No active sketch' };
    }

    // Find selected lines
    const selectedLines = [];
    for (const id of sketchManager.selectedEntities) {
      const entity = sketch.getEntity(id);
      if (entity && sketch.lines.has(id)) {
        selectedLines.push(entity);
      }
    }

    if (selectedLines.length === 0) {
      return { success: false, error: 'Select a line first' };
    }

    // Normalize constraint type
    let constraintType;
    const typeInput = params.type.toLowerCase();
    if (typeInput === 'horizontal' || typeInput === 'h') {
      constraintType = ConstraintType.HORIZONTAL;
    } else if (typeInput === 'vertical' || typeInput === 'v') {
      constraintType = ConstraintType.VERTICAL;
    }

    // Add constraints to all selected lines
    let addedCount = 0;
    for (const line of selectedLines) {
      // Check if already has this constraint
      const existingConstraints = Array.from(sketch.constraints.values()).filter(
        c => c.entities.includes(line.id) && c.type === constraintType
      );

      if (existingConstraints.length === 0) {
        sketch.addConstraint(constraintType, [line.id]);
        addedCount++;
      }
    }

    // Solve the sketch to apply constraints
    const result = solveSketch(sketch);

    // Trigger UI update
    if (ctx.updateSketchView) {
      ctx.updateSketchView();
    } else if (sketchManager.onSketchUpdate) {
      sketchManager.onSketchUpdate(sketch);
    }

    return {
      success: true,
      type: constraintType,
      count: addedCount,
      solverStatus: result.status,
      converged: result.converged,
    };
  };

  // DIMENSION - Set exact length/dimension on selected element
  registerCommand('dimension', {
    aliases: ['dim', 'distance', 'd'],
    description: 'Set dimension (length) on selected line or radius on circle',
    category: 'sketch',
    params: [{ name: 'value', type: 'number', required: true, description: 'Dimension value' }],
    validate(params) {
      if (params.value === undefined || params.value === null) {
        return 'Value is required';
      }
      if (params.value <= 0) {
        return 'Value must be positive';
      }
      return true;
    },
    async execute(params, ctx) {
      if (!ctx.inSketchMode) {
        return { success: false, error: 'Enter sketch mode first' };
      }

      const sketch = sketchManager.activeSketch;
      if (!sketch) {
        return { success: false, error: 'No active sketch' };
      }

      // Find selected entities (lines or circles)
      const selectedEntities = [];
      for (const id of sketchManager.selectedEntities) {
        const entity = sketch.getEntity(id);
        if (entity) {
          if (entity instanceof SketchLine) {
            selectedEntities.push({ entity, type: 'line' });
          } else if (entity instanceof SketchCircle) {
            selectedEntities.push({ entity, type: 'circle' });
          }
        }
      }

      if (selectedEntities.length === 0) {
        return { success: false, error: 'Select a line or circle first' };
      }

      // Add dimension constraints
      let addedCount = 0;
      const constraints = [];

      for (const { entity, type } of selectedEntities) {
        // Check if already has a length/radius constraint
        const existingLength = Array.from(sketch.constraints.values()).filter(
          c =>
            c.entities.includes(entity.id) &&
            (c.type === ConstraintType.LENGTH || c.type === ConstraintType.RADIUS)
        );

        if (existingLength.length > 0) {
          // Update existing constraint value
          existingLength[0].value = params.value;
        } else {
          // Add new constraint
          const constraintType = type === 'circle' ? ConstraintType.RADIUS : ConstraintType.LENGTH;
          const constraint = sketch.addConstraint(constraintType, [entity.id], params.value);
          constraints.push(constraint);
          addedCount++;
        }
      }

      // Solve the sketch to apply constraints
      const result = solveSketch(sketch);

      // Trigger UI update
      if (ctx.updateSketchView) {
        ctx.updateSketchView();
      } else if (sketchManager.onSketchUpdate) {
        sketchManager.onSketchUpdate(sketch);
      }

      return {
        success: true,
        value: params.value,
        count: addedCount,
        solverStatus: result.status,
        converged: result.converged,
      };
    },
  });

  // LENGTH - Alias for dimension (specifically for lines)
  registerCommand('length', {
    aliases: ['len'],
    description: 'Set length of selected line',
    category: 'sketch',
    params: [{ name: 'value', type: 'number', required: true, description: 'Length value' }],
    validate(params) {
      if (params.value === undefined || params.value === null) {
        return 'Value is required';
      }
      if (params.value <= 0) {
        return 'Value must be positive';
      }
      return true;
    },
    async execute(params, ctx) {
      // Delegate to dimension command
      if (!ctx.inSketchMode) {
        return { success: false, error: 'Enter sketch mode first' };
      }

      const sketch = sketchManager.activeSketch;
      if (!sketch) {
        return { success: false, error: 'No active sketch' };
      }

      // Only process lines
      const selectedLines = [];
      for (const id of sketchManager.selectedEntities) {
        const entity = sketch.getEntity(id);
        if (entity instanceof SketchLine) {
          selectedLines.push(entity);
        }
      }

      if (selectedLines.length === 0) {
        return { success: false, error: 'Select a line first' };
      }

      let addedCount = 0;
      for (const line of selectedLines) {
        // Check if already has a length constraint
        const existing = Array.from(sketch.constraints.values()).filter(
          c => c.entities.includes(line.id) && c.type === ConstraintType.LENGTH
        );

        if (existing.length > 0) {
          existing[0].value = params.value;
        } else {
          sketch.addConstraint(ConstraintType.LENGTH, [line.id], params.value);
          addedCount++;
        }
      }

      const result = solveSketch(sketch);

      if (ctx.updateSketchView) {
        ctx.updateSketchView();
      } else if (sketchManager.onSketchUpdate) {
        sketchManager.onSketchUpdate(sketch);
      }

      return {
        success: true,
        value: params.value,
        count: addedCount,
        solverStatus: result.status,
        converged: result.converged,
      };
    },
  });

  // RADIUS - Set radius on selected circle
  registerCommand('radius', {
    aliases: ['rad'],
    description: 'Set radius of selected circle',
    category: 'sketch',
    params: [{ name: 'value', type: 'number', required: true, description: 'Radius value' }],
    validate(params) {
      if (params.value === undefined || params.value === null) {
        return 'Value is required';
      }
      if (params.value <= 0) {
        return 'Value must be positive';
      }
      return true;
    },
    async execute(params, ctx) {
      if (!ctx.inSketchMode) {
        return { success: false, error: 'Enter sketch mode first' };
      }

      const sketch = sketchManager.activeSketch;
      if (!sketch) {
        return { success: false, error: 'No active sketch' };
      }

      // Only process circles
      const selectedCircles = [];
      for (const id of sketchManager.selectedEntities) {
        const entity = sketch.getEntity(id);
        if (entity instanceof SketchCircle) {
          selectedCircles.push(entity);
        }
      }

      if (selectedCircles.length === 0) {
        return { success: false, error: 'Select a circle first' };
      }

      let addedCount = 0;
      for (const circle of selectedCircles) {
        // Check if already has a radius constraint
        const existing = Array.from(sketch.constraints.values()).filter(
          c => c.entities.includes(circle.id) && c.type === ConstraintType.RADIUS
        );

        if (existing.length > 0) {
          existing[0].value = params.value;
        } else {
          sketch.addConstraint(ConstraintType.RADIUS, [circle.id], params.value);
          addedCount++;
        }
      }

      const result = solveSketch(sketch);

      if (ctx.updateSketchView) {
        ctx.updateSketchView();
      } else if (sketchManager.onSketchUpdate) {
        sketchManager.onSketchUpdate(sketch);
      }

      return {
        success: true,
        value: params.value,
        count: addedCount,
        solverStatus: result.status,
        converged: result.converged,
      };
    },
  });

  // SKETCH STATUS - Show constraint status and DOF analysis
  registerCommand('status', {
    aliases: ['stat', 'dof'],
    description: 'Show sketch constraint status and degrees of freedom',
    category: 'sketch',
    params: [],
    async execute(_params, ctx) {
      if (!ctx.inSketchMode) {
        return { success: false, error: 'Enter sketch mode first' };
      }

      const sketch = sketchManager.activeSketch;
      if (!sketch) {
        return { success: false, error: 'No active sketch' };
      }

      // Run solver to get full status
      const result = solveSketch(sketch);

      // Get formatted status string
      const statusString = getStatusString(result);

      // Update sketch view with entity states if available
      if (ctx.updateSketchView) {
        ctx.updateSketchView(result.entityStates);
      } else if (sketchManager.onSketchUpdate) {
        sketchManager.onSketchUpdate(sketch);
      }

      // Count entities by state
      let underCount = 0;
      let fullyCount = 0;
      let overCount = 0;

      result.entityStates.forEach(state => {
        switch (state) {
          case EntityState.UNDER_CONSTRAINED:
            underCount++;
            break;
          case EntityState.FULLY_CONSTRAINED:
            fullyCount++;
            break;
          case EntityState.OVER_CONSTRAINED:
            overCount++;
            break;
        }
      });

      return {
        success: true,
        status: result.status,
        dofRemaining: result.degreesOfFreedom,
        constraintCount: sketch.constraints.size,
        entityCount: sketch.points.size + sketch.lines.size + sketch.circles.size,
        underConstrained: underCount,
        fullyConstrained: fullyCount,
        overConstrained: overCount,
        conflicts: result.conflicts,
        message: statusString,
        details: result.statusMessage?.details || [],
      };
    },
  });

  // SKETCH LOCK - Fix all free (unconstrained) points
  registerCommand('lock', {
    aliases: ['fix', 'freeze'],
    description: 'Fix all free points in place (add FIXED constraints)',
    category: 'sketch',
    params: [],
    async execute(_params, ctx) {
      if (!ctx.inSketchMode) {
        return { success: false, error: 'Enter sketch mode first' };
      }

      const sketch = sketchManager.activeSketch;
      if (!sketch) {
        return { success: false, error: 'No active sketch' };
      }

      // Find all points that don't have a FIXED constraint
      const fixedPointIds = new Set();
      sketch.constraints.forEach(constraint => {
        if (constraint.type === ConstraintType.FIXED) {
          constraint.entities.forEach(id => fixedPointIds.add(id));
        }
      });

      let addedCount = 0;
      sketch.points.forEach(point => {
        if (!fixedPointIds.has(point.id) && !point.fixed) {
          sketch.addConstraint(ConstraintType.FIXED, [point.id]);
          point.fixed = true;
          addedCount++;
        }
      });

      // Solve to verify
      const result = solveSketch(sketch);

      if (ctx.updateSketchView) {
        ctx.updateSketchView(result.entityStates);
      } else if (sketchManager.onSketchUpdate) {
        sketchManager.onSketchUpdate(sketch);
      }

      return {
        success: true,
        fixedCount: addedCount,
        status: result.status,
        message:
          addedCount > 0
            ? `Fixed ${addedCount} point(s). Sketch is now ${result.status}.`
            : 'All points were already fixed.',
      };
    },
  });

  // SKETCH UNLOCK - Remove all FIXED constraints
  registerCommand('unlock', {
    aliases: ['unfix', 'thaw'],
    description: 'Remove all FIXED constraints from points',
    category: 'sketch',
    params: [],
    async execute(_params, ctx) {
      if (!ctx.inSketchMode) {
        return { success: false, error: 'Enter sketch mode first' };
      }

      const sketch = sketchManager.activeSketch;
      if (!sketch) {
        return { success: false, error: 'No active sketch' };
      }

      // Find and remove all FIXED constraints
      const toRemove = [];
      sketch.constraints.forEach((constraint, id) => {
        if (constraint.type === ConstraintType.FIXED) {
          toRemove.push(id);
          // Also unset the fixed flag on points
          constraint.entities.forEach(entityId => {
            const point = sketch.points.get(entityId);
            if (point) {
              point.fixed = false;
            }
          });
        }
      });

      toRemove.forEach(id => sketch.constraints.delete(id));

      // Solve to get new status
      const result = solveSketch(sketch);

      if (ctx.updateSketchView) {
        ctx.updateSketchView(result.entityStates);
      } else if (sketchManager.onSketchUpdate) {
        sketchManager.onSketchUpdate(sketch);
      }

      return {
        success: true,
        removedCount: toRemove.length,
        status: result.status,
        dofRemaining: result.degreesOfFreedom,
        message:
          toRemove.length > 0
            ? `Removed ${toRemove.length} FIXED constraint(s). ${result.degreesOfFreedom} DOF remaining.`
            : 'No FIXED constraints to remove.',
      };
    },
  });

  // TRIM - Trim entities at intersections
  registerCommand('trim', {
    aliases: ['tr', 'cut'],
    description:
      'Trim entity at intersections (removes clicked segment). Enter trim mode or specify entity ID.',
    category: 'sketch',
    params: [
      {
        name: 'entity_id',
        type: 'string',
        required: false,
        description: 'Entity ID to trim (optional - click to trim in interactive mode)',
      },
    ],
    async execute(params, ctx) {
      if (!ctx.inSketchMode) {
        return { success: false, error: 'Enter sketch mode first' };
      }

      const sketch = sketchManager.activeSketch;
      if (!sketch) {
        return { success: false, error: 'No active sketch' };
      }

      // If entity_id provided, trim selected entities or the specified one
      if (params.entity_id) {
        const entity = sketch.getEntity(params.entity_id);
        if (!entity) {
          return { success: false, error: `Entity ${params.entity_id} not found` };
        }

        if (!(entity instanceof SketchLine) && !(entity instanceof SketchArc)) {
          return { success: false, error: 'Can only trim lines and arcs' };
        }

        // Use entity midpoint as click point
        let clickPoint;
        if (entity instanceof SketchLine) {
          clickPoint = {
            x: (entity.start.x + entity.end.x) / 2,
            y: (entity.start.y + entity.end.y) / 2,
          };
        } else {
          // Arc - use midpoint of arc
          const midAngle = entity.startAngle + entity.sweepAngle / 2;
          clickPoint = {
            x: entity.center.x + entity.radius * Math.cos(midAngle),
            y: entity.center.y + entity.radius * Math.sin(midAngle),
          };
        }

        const result = trimEntity(entity, clickPoint, sketch);

        if (ctx.updateSketchView) {
          ctx.updateSketchView();
        } else if (sketchManager.onSketchUpdate) {
          sketchManager.onSketchUpdate(sketch);
        }

        if (result.success) {
          return {
            success: true,
            message: `Trimmed entity, kept ${result.kept.length} segment(s)`,
            intersections: result.intersectionCount,
            keptSegments: result.kept.map(e => e.id),
          };
        }
        return result;
      }

      // No entity ID - check if entities are selected
      if (sketchManager.selectedEntities.size > 0) {
        let trimmedCount = 0;
        const errors = [];

        for (const id of sketchManager.selectedEntities) {
          const entity = sketch.getEntity(id);
          if (!entity) continue;

          if (!(entity instanceof SketchLine) && !(entity instanceof SketchArc)) {
            continue;
          }

          let clickPoint;
          if (entity instanceof SketchLine) {
            clickPoint = {
              x: (entity.start.x + entity.end.x) / 2,
              y: (entity.start.y + entity.end.y) / 2,
            };
          } else {
            const midAngle = entity.startAngle + entity.sweepAngle / 2;
            clickPoint = {
              x: entity.center.x + entity.radius * Math.cos(midAngle),
              y: entity.center.y + entity.radius * Math.sin(midAngle),
            };
          }

          const result = trimEntity(entity, clickPoint, sketch);
          if (result.success) {
            trimmedCount++;
          } else {
            errors.push(result.error);
          }
        }

        sketchManager.selectedEntities.clear();

        if (ctx.updateSketchView) {
          ctx.updateSketchView();
        } else if (sketchManager.onSketchUpdate) {
          sketchManager.onSketchUpdate(sketch);
        }

        if (trimmedCount > 0) {
          return {
            success: true,
            message: `Trimmed ${trimmedCount} entity/entities`,
            errors: errors.length > 0 ? errors : undefined,
          };
        }
        return {
          success: false,
          error: errors.length > 0 ? errors.join('; ') : 'No entities could be trimmed',
        };
      }

      // Enter trim mode (interactive) - set a mode flag in context
      if (ctx.setTrimMode) {
        ctx.setTrimMode(true);
        return { success: true, mode: 'trim', message: 'Click on segments to trim them' };
      }

      return {
        success: true,
        mode: 'trim',
        message:
          'Trim mode: click on the portion of an entity to remove. Select an entity first or provide entity_id.',
      };
    },
  });

  // EXTEND - Extend entities to nearest boundary
  registerCommand('extend', {
    aliases: ['ext', 'ex'],
    description:
      'Extend entity to nearest boundary. Enter extend mode or specify entity ID.',
    category: 'sketch',
    params: [
      {
        name: 'entity_id',
        type: 'string',
        required: false,
        description: 'Entity ID to extend (optional - click to extend in interactive mode)',
      },
    ],
    async execute(params, ctx) {
      if (!ctx.inSketchMode) {
        return { success: false, error: 'Enter sketch mode first' };
      }

      const sketch = sketchManager.activeSketch;
      if (!sketch) {
        return { success: false, error: 'No active sketch' };
      }

      // If entity_id provided, extend the specified entity
      if (params.entity_id) {
        const entity = sketch.getEntity(params.entity_id);
        if (!entity) {
          return { success: false, error: `Entity ${params.entity_id} not found` };
        }

        if (!(entity instanceof SketchLine) && !(entity instanceof SketchArc)) {
          return { success: false, error: 'Can only extend lines and arcs' };
        }

        // Use end point as click point (extend from end by default)
        let clickPoint;
        if (entity instanceof SketchLine) {
          clickPoint = { x: entity.end.x, y: entity.end.y };
        } else {
          clickPoint = { x: entity.end.x, y: entity.end.y };
        }

        const result = extendEntity(entity, clickPoint, sketch);

        if (ctx.updateSketchView) {
          ctx.updateSketchView();
        } else if (sketchManager.onSketchUpdate) {
          sketchManager.onSketchUpdate(sketch);
        }

        if (result.success) {
          return {
            success: true,
            message: `Extended entity ${result.direction} to (${result.newEndpoint.x.toFixed(2)}, ${result.newEndpoint.y.toFixed(2)})`,
            direction: result.direction,
            newEndpoint: result.newEndpoint,
            boundaryEntity: result.boundaryEntity?.id,
          };
        }
        return result;
      }

      // No entity ID - check if entities are selected
      if (sketchManager.selectedEntities.size > 0) {
        let extendedCount = 0;
        const errors = [];

        for (const id of sketchManager.selectedEntities) {
          const entity = sketch.getEntity(id);
          if (!entity) continue;

          if (!(entity instanceof SketchLine) && !(entity instanceof SketchArc)) {
            continue;
          }

          // Extend from end by default
          let clickPoint;
          if (entity instanceof SketchLine) {
            clickPoint = { x: entity.end.x, y: entity.end.y };
          } else {
            clickPoint = { x: entity.end.x, y: entity.end.y };
          }

          const result = extendEntity(entity, clickPoint, sketch);
          if (result.success) {
            extendedCount++;
          } else {
            errors.push(result.error);
          }
        }

        sketchManager.selectedEntities.clear();

        if (ctx.updateSketchView) {
          ctx.updateSketchView();
        } else if (sketchManager.onSketchUpdate) {
          sketchManager.onSketchUpdate(sketch);
        }

        if (extendedCount > 0) {
          return {
            success: true,
            message: `Extended ${extendedCount} entity/entities`,
            errors: errors.length > 0 ? errors : undefined,
          };
        }
        return {
          success: false,
          error: errors.length > 0 ? errors.join('; ') : 'No entities could be extended',
        };
      }

      // Enter extend mode (interactive)
      if (ctx.setExtendMode) {
        ctx.setExtendMode(true);
        return { success: true, mode: 'extend', message: 'Click near endpoint to extend' };
      }

      return {
        success: true,
        mode: 'extend',
        message:
          'Extend mode: click near the endpoint of an entity to extend it to the nearest boundary. Select an entity first or provide entity_id.',
      };
    },
  });
}

export default { registerSketchCommands };
