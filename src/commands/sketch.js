/**
 * Ameri-CAD Sketch Commands
 * 
 * Commands for creating and editing 2D sketches.
 */

import { registerCommand } from '../core/commands.js';
import { sketchManager, SketchMode } from '../sketch/sketch-manager.js';

/**
 * Register all sketch-related commands
 */
export function registerSketchCommands(context) {
    
    // SKETCH - Enter sketch mode
    registerCommand('sketch', {
        aliases: ['sk'],
        description: 'Enter sketch mode on a plane',
        category: 'sketch',
        params: [
            { name: 'plane', type: 'string', required: false, default: 'xy', description: 'Plane to sketch on (xy, xz, yz)' }
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
        }
    });
    
    // EXIT - Exit sketch mode
    registerCommand('exit', {
        aliases: ['finish', 'done'],
        description: 'Exit sketch mode',
        category: 'sketch',
        params: [],
        async execute(params, ctx) {
            if (ctx.exitSketchMode) {
                const sketch = ctx.exitSketchMode();
                return { success: true, sketch };
            }
            return { success: false, error: 'Not in sketch mode' };
        }
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
        }
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
        }
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
        }
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
        }
    });
    
    // EXTRUDE - Extrude sketch profiles
    registerCommand('extrude', {
        aliases: ['ext', 'push'],
        description: 'Extrude sketch profile into 3D',
        category: 'sketch',
        params: [
            { name: 'height', type: 'number', required: true, description: 'Extrusion height' },
            { name: 'direction', type: 'string', required: false, default: 'normal', description: 'Direction (normal, both, reverse)' }
        ],
        validate(params) {
            if (params.height === 0) return 'Height cannot be zero';
            return true;
        },
        async execute(params, ctx) {
            if (ctx.extrudeSketch) {
                await ctx.extrudeSketch(Math.abs(params.height));
                return { success: true, height: params.height };
            }
            return { success: false, error: 'Extrude not available' };
        }
    });
    
    // REVOLVE - Revolve sketch profiles around an axis
    registerCommand('revolve', {
        aliases: ['rev', 'spin', 'lathe'],
        description: 'Revolve sketch profile around an axis (like a lathe)',
        category: 'sketch',
        params: [
            { name: 'angle', type: 'number', required: false, default: 360, description: 'Revolution angle in degrees' },
            { name: 'axis', type: 'string', required: false, default: 'y', description: 'Revolution axis (x, y, z)' }
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
        }
    });
    
    // GRID - Toggle or set grid size
    registerCommand('grid', {
        description: 'Toggle grid or set grid size',
        category: 'sketch',
        params: [
            { name: 'size', type: 'number', required: false, description: 'Grid size (omit to toggle)' }
        ],
        async execute(params, ctx) {
            if (params.size !== undefined) {
                sketchManager.gridSize = params.size;
                return { success: true, gridSize: params.size };
            } else {
                sketchManager.gridSnap = !sketchManager.gridSnap;
                return { success: true, gridSnap: sketchManager.gridSnap };
            }
        }
    });
    
    // SNAP - Toggle endpoint snapping
    registerCommand('snap', {
        description: 'Toggle endpoint snapping',
        category: 'sketch',
        params: [
            { name: 'tolerance', type: 'number', required: false, description: 'Snap tolerance' }
        ],
        async execute(params, ctx) {
            if (params.tolerance !== undefined) {
                sketchManager.snapTolerance = params.tolerance;
                return { success: true, tolerance: params.tolerance };
            } else {
                sketchManager.endpointSnap = !sketchManager.endpointSnap;
                return { success: true, endpointSnap: sketchManager.endpointSnap };
            }
        }
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
        }
    });
}

export default { registerSketchCommands };
