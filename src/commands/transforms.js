/**
 * Ameri-CAD Transform Commands
 * 
 * Commands for transforming geometry: move, rotate, scale, mirror, copy.
 */

import { registerCommand } from '../core/commands.js';

/**
 * Register all transform commands
 */
export function registerTransformCommands(kernel) {
    
    // MOVE - Move selected objects
    registerCommand('move', {
        aliases: ['m', 'translate', 'mv'],
        description: 'Move selected objects by a vector or to a point',
        category: 'transform',
        params: [
            { name: 'dx', type: 'number', required: true, description: 'X displacement' },
            { name: 'dy', type: 'number', required: false, default: 0, description: 'Y displacement' },
            { name: 'dz', type: 'number', required: false, default: 0, description: 'Z displacement' }
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
        }
    });
    
    // ROTATE - Rotate selected objects
    registerCommand('rotate', {
        aliases: ['rot', 'r'],
        description: 'Rotate selected objects around an axis',
        category: 'transform',
        params: [
            { name: 'angle', type: 'number', required: true, description: 'Angle in degrees' },
            { name: 'axis', type: 'string', required: false, default: 'z', description: 'Axis: x, y, or z' },
            { name: 'center', type: 'point', required: false, default: { x: 0, y: 0, z: 0 }, description: 'Center of rotation' }
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
                z: { x: 0, y: 0, z: 1 }
            }[params.axis.toLowerCase()];
            
            for (const id of context.selection) {
                const result = await kernel.rotate(id, params.angle, axisVec, params.center);
                results.push(result);
            }
            
            return results;
        }
    });
    
    // SCALE - Scale selected objects
    registerCommand('scale', {
        aliases: ['sc', 'resize'],
        description: 'Scale selected objects',
        category: 'transform',
        params: [
            { name: 'factor', type: 'number', required: true, description: 'Scale factor (1 = no change)' },
            { name: 'center', type: 'point', required: false, default: { x: 0, y: 0, z: 0 }, description: 'Center of scaling' }
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
        }
    });
    
    // MIRROR - Mirror selected objects
    registerCommand('mirror', {
        aliases: ['mir', 'flip'],
        description: 'Mirror selected objects across a plane',
        category: 'transform',
        params: [
            { name: 'plane', type: 'string', required: false, default: 'xy', description: 'Mirror plane: xy, xz, or yz' },
            { name: 'copy', type: 'boolean', required: false, default: false, description: 'Keep original' }
        ],
        validate(params, context) {
            if (!context.selection?.length) return 'Nothing selected';
            if (!['xy', 'xz', 'yz'].includes(params.plane.toLowerCase())) {
                return 'Plane must be xy, xz, or yz';
            }
            return true;
        },
        async execute(params, context) {
            const results = [];
            
            for (const id of context.selection) {
                const result = await kernel.mirror(id, params.plane, params.copy);
                results.push(result);
            }
            
            return results;
        }
    });
    
    // COPY - Copy selected objects
    registerCommand('copy', {
        aliases: ['cp', 'duplicate', 'dup'],
        description: 'Copy selected objects with optional offset',
        category: 'transform',
        params: [
            { name: 'dx', type: 'number', required: false, default: 10, description: 'X offset for copy' },
            { name: 'dy', type: 'number', required: false, default: 0, description: 'Y offset' },
            { name: 'dz', type: 'number', required: false, default: 0, description: 'Z offset' }
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
        }
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
            { name: 'dz', type: 'number', required: false, default: 0, description: 'Z spacing' }
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
                    const result = await kernel.copy(
                        id,
                        params.dx * i,
                        params.dy * i,
                        params.dz * i
                    );
                    results.push(result);
                    
                    if (context.document && result.id) {
                        context.document.addBody(result.id, result);
                    }
                }
            }
            
            return results;
        }
    });
    
    // PATTERN LINEAR - Create linear pattern as B-Rep compound
    registerCommand('pattern', {
        aliases: ['pat'],
        description: 'Create patterns: pattern linear <count> <spacing> [axis]',
        category: 'transform',
        params: [
            { name: 'type', type: 'string', required: true, description: 'Pattern type: linear' },
            { name: 'count', type: 'int', required: true, description: 'Number of copies (including original)' },
            { name: 'spacing', type: 'number', required: true, description: 'Distance between copies' },
            { name: 'axis', type: 'string', required: false, default: 'x', description: 'Direction: x, y, z, or custom vector' }
        ],
        validate(params, context) {
            if (!context.selection?.length) return 'Nothing selected';
            if (params.type.toLowerCase() !== 'linear') {
                return `Unknown pattern type: ${params.type}. Supported: linear`;
            }
            if (params.count < 1) return 'Count must be at least 1';
            if (params.count > 1000) return 'Count too large (max 1000)';
            if (params.spacing <= 0) return 'Spacing must be positive';
            return true;
        },
        async execute(params, context) {
            const results = [];
            
            // Parse direction from axis parameter
            let direction;
            const axisLower = params.axis.toLowerCase();
            
            if (axisLower === 'x') {
                direction = [1, 0, 0];
            } else if (axisLower === 'y') {
                direction = [0, 1, 0];
            } else if (axisLower === 'z') {
                direction = [0, 0, 1];
            } else if (axisLower === '-x') {
                direction = [-1, 0, 0];
            } else if (axisLower === '-y') {
                direction = [0, -1, 0];
            } else if (axisLower === '-z') {
                direction = [0, 0, -1];
            } else {
                // Try to parse as vector "x,y,z"
                const parts = params.axis.split(',').map(p => parseFloat(p.trim()));
                if (parts.length === 3 && parts.every(p => !isNaN(p))) {
                    // Normalize the vector
                    const len = Math.sqrt(parts[0]**2 + parts[1]**2 + parts[2]**2);
                    if (len < 1e-10) {
                        throw new Error('Direction vector cannot be zero');
                    }
                    direction = [parts[0]/len, parts[1]/len, parts[2]/len];
                } else {
                    throw new Error(`Invalid axis: ${params.axis}. Use x, y, z, -x, -y, -z, or x,y,z vector`);
                }
            }
            
            for (const id of context.selection) {
                const result = await kernel.linearPattern(
                    id,
                    direction,
                    params.count,
                    params.spacing
                );
                results.push(result);
                
                // Add pattern result to document
                if (context.document && result.id) {
                    context.document.addBody(result.id, {
                        ...result,
                        type: 'linearPattern',
                        sourceId: id,
                        params: {
                            count: params.count,
                            spacing: params.spacing,
                            direction
                        }
                    });
                }
            }
            
            return results;
        }
    });
}

export default { registerTransformCommands };
