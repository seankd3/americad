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
            { name: 'target', type: 'string', required: false, description: 'Target shape ID (or use selection)' },
            { name: 'tool', type: 'string', required: false, description: 'Tool shape ID' }
        ],
        validate(params, context) {
            const shapes = params.target && params.tool 
                ? [params.target, params.tool]
                : context.selection || [];
            
            if (shapes.length < 2) return 'Union requires at least 2 shapes';
            return true;
        },
        async execute(params, context) {
            const shapes = params.target && params.tool
                ? [params.target, params.tool]
                : context.selection;
            
            // Union all selected shapes
            let result = shapes[0];
            for (let i = 1; i < shapes.length; i++) {
                result = await kernel.boolean(result, shapes[i], 'union');
            }
            
            return result;
        }
    });
    
    // SUBTRACT - Boolean subtraction (cut)
    registerCommand('subtract', {
        aliases: ['sub', 'cut', 'difference', 's'],
        description: 'Boolean subtraction - cut tool from target',
        category: 'boolean',
        params: [
            { name: 'target', type: 'string', required: false, description: 'Target shape to cut from' },
            { name: 'tool', type: 'string', required: false, description: 'Tool shape to cut with' }
        ],
        validate(params, context) {
            const shapes = params.target && params.tool 
                ? [params.target, params.tool]
                : context.selection || [];
            
            if (shapes.length < 2) return 'Subtract requires 2 shapes';
            return true;
        },
        async execute(params, context) {
            const shapes = params.target && params.tool
                ? [params.target, params.tool]
                : context.selection;
            
            const result = await kernel.boolean(shapes[0], shapes[1], 'subtract');
            return result;
        }
    });
    
    // INTERSECT - Boolean intersection (common)
    registerCommand('intersect', {
        aliases: ['int', 'common', 'i'],
        description: 'Boolean intersection - keep only overlapping region',
        category: 'boolean',
        params: [
            { name: 'target', type: 'string', required: false, description: 'First shape' },
            { name: 'tool', type: 'string', required: false, description: 'Second shape' }
        ],
        validate(params, context) {
            const shapes = params.target && params.tool 
                ? [params.target, params.tool]
                : context.selection || [];
            
            if (shapes.length < 2) return 'Intersect requires 2 shapes';
            return true;
        },
        async execute(params, context) {
            const shapes = params.target && params.tool
                ? [params.target, params.tool]
                : context.selection;
            
            const result = await kernel.boolean(shapes[0], shapes[1], 'intersect');
            return result;
        }
    });
    
    // FILLET - Add fillet to edges
    registerCommand('fillet', {
        aliases: ['round', 'fil'],
        description: 'Add fillet (rounded edge) to selected edges',
        category: 'feature',
        params: [
            { name: 'radius', type: 'number', required: true, description: 'Fillet radius' }
        ],
        validate(params, context) {
            if (!context.selection?.length) return 'Select edges to fillet';
            if (params.radius <= 0) return 'Radius must be positive';
            return true;
        },
        async execute(params, context) {
            const result = await kernel.fillet(context.selection, params.radius);
            return result;
        }
    });
    
    // CHAMFER - Add chamfer to edges
    registerCommand('chamfer', {
        aliases: ['bevel', 'cham'],
        description: 'Add chamfer (angled edge) to selected edges',
        category: 'feature',
        params: [
            { name: 'distance', type: 'number', required: true, description: 'Chamfer distance' }
        ],
        validate(params, context) {
            if (!context.selection?.length) return 'Select edges to chamfer';
            if (params.distance <= 0) return 'Distance must be positive';
            return true;
        },
        async execute(params, context) {
            const result = await kernel.chamfer(context.selection, params.distance);
            return result;
        }
    });
    
    // EXTRUDE - Extrude a face or sketch
    registerCommand('extrude', {
        aliases: ['ext', 'push', 'e'],
        description: 'Extrude selected face or sketch',
        category: 'feature',
        params: [
            { name: 'distance', type: 'number', required: true, description: 'Extrusion distance' },
            { name: 'direction', type: 'string', required: false, default: 'normal', description: 'Direction: normal, x, y, z' }
        ],
        validate(params, context) {
            if (!context.selection?.length) return 'Select a face or sketch to extrude';
            return true;
        },
        async execute(params, context) {
            const result = await kernel.extrude(context.selection[0], params.distance, params.direction);
            return result;
        }
    });
    
    // REVOLVE - Revolve a face or sketch
    registerCommand('revolve', {
        aliases: ['rev', 'spin'],
        description: 'Revolve selected face or sketch around an axis',
        category: 'feature',
        params: [
            { name: 'angle', type: 'number', required: false, default: 360, description: 'Angle in degrees' },
            { name: 'axis', type: 'string', required: false, default: 'y', description: 'Axis: x, y, or z' }
        ],
        validate(params, context) {
            if (!context.selection?.length) return 'Select a face or sketch to revolve';
            if (params.angle <= 0 || params.angle > 360) return 'Angle must be between 0 and 360';
            return true;
        },
        async execute(params, context) {
            const result = await kernel.revolve(context.selection[0], params.angle, params.axis);
            return result;
        }
    });
    
    // SHELL - Hollow out a solid
    registerCommand('shell', {
        aliases: ['hollow'],
        description: 'Hollow out a solid, optionally removing faces',
        category: 'feature',
        params: [
            { name: 'thickness', type: 'number', required: true, description: 'Wall thickness' }
        ],
        validate(params, context) {
            if (!context.selection?.length) return 'Select a solid to shell';
            if (params.thickness <= 0) return 'Thickness must be positive';
            return true;
        },
        async execute(params, context) {
            const result = await kernel.shell(context.selection[0], params.thickness);
            return result;
        }
    });
    
    // LOFT - Loft between profiles
    registerCommand('loft', {
        aliases: ['blend'],
        description: 'Create a loft between selected profiles',
        category: 'feature',
        params: [
            { name: 'solid', type: 'boolean', required: false, default: true, description: 'Create solid (vs surface)' }
        ],
        validate(params, context) {
            if (!context.selection?.length || context.selection.length < 2) {
                return 'Select at least 2 profiles to loft';
            }
            return true;
        },
        async execute(params, context) {
            const result = await kernel.loft(context.selection, params.solid);
            return result;
        }
    });
    
    // SWEEP - Sweep profile along path
    registerCommand('sweep', {
        description: 'Sweep a profile along a path',
        category: 'feature',
        params: [
            { name: 'profile', type: 'string', required: false, description: 'Profile shape ID' },
            { name: 'path', type: 'string', required: false, description: 'Path curve ID' }
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
        }
    });
}

export default { registerBooleanCommands };
