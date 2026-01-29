/**
 * Ameri-CAD Sketch Commands
 * 
 * Commands for creating and editing 2D sketches.
 */

import { registerCommand } from '../core/commands.js';
import { sketchManager, SketchMode, ConstraintType, SketchLine, SketchCircle } from '../sketch/sketch-manager.js';
import { solveSketch } from '../sketch/constraint-solver.js';
import { snapManager, SnapType } from '../ui/snap-manager.js';

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
    
    // SPLINE - Set spline drawing mode
    registerCommand('spline', {
        aliases: ['sp', 'curve', 'bezier'],
        description: 'Spline curve drawing tool (in sketch mode). Click to add points, Enter/double-click to finish.',
        category: 'sketch',
        params: [
            { name: 'action', type: 'string', required: false, description: 'Optional action: "close" to close the spline' }
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
    
    // SNAP - Comprehensive snap control
    // Usage: snap [on|off|<type>] [value]
    // Examples: snap on, snap off, snap grid 10, snap point on, snap endpoint off
    registerCommand('snap', {
        aliases: ['s'],
        description: 'Control snapping (snap on/off, snap grid <size>, snap <type> on/off)',
        category: 'sketch',
        params: [
            { name: 'type', type: 'string', required: false, description: 'on/off or snap type (grid, point, midpoint, center, intersection, nearest)' },
            { name: 'value', type: 'string', required: false, description: 'on/off or grid size' }
        ],
        async execute(params, ctx) {
            const type = params.type?.toLowerCase();
            const value = params.value?.toLowerCase();
            
            // No args - show status
            if (!type) {
                return {
                    success: true,
                    active: snapManager.active,
                    settings: snapManager.getSettings(),
                    status: snapManager.getStatusString()
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
                'point': 'endpoint',
                'endpoint': 'endpoint',
                'end': 'endpoint',
                'mid': 'midpoint',
                'midpoint': 'midpoint',
                'center': 'center',
                'cen': 'center',
                'int': 'intersection',
                'intersection': 'intersection',
                'perp': 'perpendicular',
                'perpendicular': 'perpendicular',
                'tan': 'tangent',
                'tangent': 'tangent',
                'near': 'nearest',
                'nearest': 'nearest'
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
                error: `Unknown snap type: ${type}. Valid types: grid, point, midpoint, center, intersection, nearest` 
            };
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
    
    // CONSTRAIN - Add constraint to selected entity
    registerCommand('constrain', {
        aliases: ['con'],
        description: 'Add constraint to selected line (horizontal, vertical)',
        category: 'sketch',
        params: [
            { name: 'type', type: 'string', required: true, description: 'Constraint type (horizontal, vertical)' }
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
                const existingConstraints = Array.from(sketch.constraints.values())
                    .filter(c => c.entities.includes(line.id) && c.type === constraintType);
                
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
                converged: result.converged
            };
        }
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
        }
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
        }
    });
    
    // Internal helper for command delegation
    registerCommand._executeDelegate = async function(cmdName, params, ctx) {
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
            const existingConstraints = Array.from(sketch.constraints.values())
                .filter(c => c.entities.includes(line.id) && c.type === constraintType);
            
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
            converged: result.converged
        };
    };
    
    // DIMENSION - Set exact length/dimension on selected element
    registerCommand('dimension', {
        aliases: ['dim', 'distance', 'd'],
        description: 'Set dimension (length) on selected line or radius on circle',
        category: 'sketch',
        params: [
            { name: 'value', type: 'number', required: true, description: 'Dimension value' }
        ],
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
                const existingLength = Array.from(sketch.constraints.values())
                    .filter(c => c.entities.includes(entity.id) && 
                                (c.type === ConstraintType.LENGTH || c.type === ConstraintType.RADIUS));
                
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
                converged: result.converged
            };
        }
    });
    
    // LENGTH - Alias for dimension (specifically for lines)
    registerCommand('length', {
        aliases: ['len'],
        description: 'Set length of selected line',
        category: 'sketch',
        params: [
            { name: 'value', type: 'number', required: true, description: 'Length value' }
        ],
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
                const existing = Array.from(sketch.constraints.values())
                    .filter(c => c.entities.includes(line.id) && c.type === ConstraintType.LENGTH);
                
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
                converged: result.converged
            };
        }
    });
    
    // RADIUS - Set radius on selected circle
    registerCommand('radius', {
        aliases: ['rad'],
        description: 'Set radius of selected circle',
        category: 'sketch',
        params: [
            { name: 'value', type: 'number', required: true, description: 'Radius value' }
        ],
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
                const existing = Array.from(sketch.constraints.values())
                    .filter(c => c.entities.includes(circle.id) && c.type === ConstraintType.RADIUS);
                
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
                converged: result.converged
            };
        }
    });
}

export default { registerSketchCommands };
