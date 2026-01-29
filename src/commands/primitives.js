/**
 * Ameri-CAD Primitive Commands
 * 
 * Commands for creating geometric primitives.
 * All mirror the kernel operations and can be invoked via UI or CLI.
 */

import { registerCommand } from '../core/commands.js';

/**
 * Register all primitive creation commands
 */
export function registerPrimitiveCommands(kernel) {
    
    // BOX - Create a box primitive
    registerCommand('box', {
        aliases: ['cube', 'block'],
        description: 'Create a box primitive',
        category: 'primitives',
        params: [
            { name: 'width', type: 'number', required: true, description: 'Width (X dimension)' },
            { name: 'height', type: 'number', required: false, default: null, description: 'Height (Y dimension), defaults to width' },
            { name: 'depth', type: 'number', required: false, default: null, description: 'Depth (Z dimension), defaults to width' },
            { name: 'center', type: 'point', required: false, default: { x: 0, y: 0, z: 0 }, description: 'Center point' }
        ],
        validate(params) {
            if (params.width <= 0) return 'Width must be positive';
            return true;
        },
        async execute(params, context) {
            const width = params.width;
            const height = params.height ?? width;
            const depth = params.depth ?? width;
            
            const result = await kernel.createBox(width, height, depth, params.center);
            
            // Add to document
            if (context.document) {
                context.document.addBody(result.id, {
                    type: 'box',
                    params: { width, height, depth, center: params.center },
                    mesh: result.mesh
                });
            }
            
            return result;
        }
    });
    
    // CYLINDER - Create a cylinder primitive
    registerCommand('cylinder', {
        aliases: ['cyl', 'tube'],
        description: 'Create a cylinder primitive',
        category: 'primitives',
        params: [
            { name: 'radius', type: 'number', required: true, description: 'Radius' },
            { name: 'height', type: 'number', required: true, description: 'Height' },
            { name: 'center', type: 'point', required: false, default: { x: 0, y: 0, z: 0 }, description: 'Base center point' }
        ],
        validate(params) {
            if (params.radius <= 0) return 'Radius must be positive';
            if (params.height <= 0) return 'Height must be positive';
            return true;
        },
        async execute(params, context) {
            const result = await kernel.createCylinder(params.radius, params.height, params.center);
            
            if (context.document) {
                context.document.addBody(result.id, {
                    type: 'cylinder',
                    params,
                    mesh: result.mesh
                });
            }
            
            return result;
        }
    });
    
    // SPHERE - Create a sphere primitive
    registerCommand('sphere', {
        aliases: ['ball'],
        description: 'Create a sphere primitive',
        category: 'primitives',
        params: [
            { name: 'radius', type: 'number', required: true, description: 'Radius' },
            { name: 'center', type: 'point', required: false, default: { x: 0, y: 0, z: 0 }, description: 'Center point' }
        ],
        validate(params) {
            if (params.radius <= 0) return 'Radius must be positive';
            return true;
        },
        async execute(params, context) {
            const result = await kernel.createSphere(params.radius, params.center);
            
            if (context.document) {
                context.document.addBody(result.id, {
                    type: 'sphere',
                    params,
                    mesh: result.mesh
                });
            }
            
            return result;
        }
    });
    
    // CONE - Create a cone primitive
    registerCommand('cone', {
        description: 'Create a cone primitive',
        category: 'primitives',
        params: [
            { name: 'radius1', type: 'number', required: true, description: 'Base radius' },
            { name: 'radius2', type: 'number', required: false, default: 0, description: 'Top radius (0 for point)' },
            { name: 'height', type: 'number', required: true, description: 'Height' },
            { name: 'center', type: 'point', required: false, default: { x: 0, y: 0, z: 0 }, description: 'Base center point' }
        ],
        validate(params) {
            if (params.radius1 <= 0) return 'Base radius must be positive';
            if (params.radius2 < 0) return 'Top radius cannot be negative';
            if (params.height <= 0) return 'Height must be positive';
            return true;
        },
        async execute(params, context) {
            const result = await kernel.createCone(params.radius1, params.radius2, params.height, params.center);
            
            if (context.document) {
                context.document.addBody(result.id, {
                    type: 'cone',
                    params,
                    mesh: result.mesh
                });
            }
            
            return result;
        }
    });
    
    // TORUS - Create a torus primitive
    registerCommand('torus', {
        aliases: ['donut', 'ring'],
        description: 'Create a torus (donut) primitive',
        category: 'primitives',
        params: [
            { name: 'majorRadius', type: 'number', required: true, description: 'Major radius (center of tube to center of torus)' },
            { name: 'minorRadius', type: 'number', required: true, description: 'Minor radius (tube radius)' },
            { name: 'center', type: 'point', required: false, default: { x: 0, y: 0, z: 0 }, description: 'Center point' }
        ],
        validate(params) {
            if (params.majorRadius <= 0) return 'Major radius must be positive';
            if (params.minorRadius <= 0) return 'Minor radius must be positive';
            if (params.minorRadius >= params.majorRadius) return 'Minor radius must be less than major radius';
            return true;
        },
        async execute(params, context) {
            const result = await kernel.createTorus(params.majorRadius, params.minorRadius, params.center);
            
            if (context.document) {
                context.document.addBody(result.id, {
                    type: 'torus',
                    params,
                    mesh: result.mesh
                });
            }
            
            return result;
        }
    });
    
    // WEDGE - Create a wedge primitive
    registerCommand('wedge', {
        description: 'Create a wedge primitive',
        category: 'primitives',
        params: [
            { name: 'dx', type: 'number', required: true, description: 'X dimension' },
            { name: 'dy', type: 'number', required: true, description: 'Y dimension' },
            { name: 'dz', type: 'number', required: true, description: 'Z dimension' },
            { name: 'ltx', type: 'number', required: false, default: 0, description: 'Top X dimension' }
        ],
        async execute(params, context) {
            const result = await kernel.createWedge(params.dx, params.dy, params.dz, params.ltx);
            
            if (context.document) {
                context.document.addBody(result.id, {
                    type: 'wedge',
                    params,
                    mesh: result.mesh
                });
            }
            
            return result;
        }
    });
}

export default { registerPrimitiveCommands };
