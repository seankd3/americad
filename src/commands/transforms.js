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
        usage: 'mirror [plane] [keep]\n  mirror       - Mirror across YZ plane (X=0)\n  mirror xy    - Mirror across XY plane\n  mirror xz    - Mirror across XZ plane\n  mirror yz    - Mirror across YZ plane\n  mirror yz keep - Mirror and keep original (symmetric part)',
        category: 'transform',
        params: [
            { name: 'plane', type: 'string', required: false, default: 'yz', description: 'Mirror plane: xy, xz, or yz (default: yz)' },
            { name: 'keep', type: 'flag', required: false, default: false, description: 'Keep original (makes symmetric part)' }
        ],
        validate(params, context) {
            if (!context.selection?.length) return 'Nothing selected';
            const plane = params.plane.toLowerCase();
            if (!['xy', 'xz', 'yz'].includes(plane)) {
                return `Invalid plane: ${params.plane}. Use xy, xz, or yz`;
            }
            return true;
        },
        async execute(params, context) {
            const results = [];
            const plane = params.plane.toLowerCase();
            
            for (const id of context.selection) {
                // Get original mesh info for document tracking
                const originalBody = context.document?.features?.get(id);
                
                // Mirror the shape
                const result = await kernel.mirror(id, plane);
                
                if (params.keep) {
                    // Keep original, add mirrored as new body
                    if (context.document && result.id) {
                        context.document.addBody(result.id, {
                            ...result,
                            type: 'mirror',
                            name: `${originalBody?.name || 'Shape'}_mirrored`
                        });
                    }
                } else {
                    // Replace original with mirrored
                    // Remove old shape from kernel and document
                    await kernel.deleteShape(id);
                    if (context.document) {
                        context.document.removeFeature(id);
                        context.document.addBody(result.id, {
                            ...result,
                            type: 'mirror',
                            name: originalBody?.name || 'Mirrored'
                        });
                    }
                }
                
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
    
    // PATTERN - Create linear or circular patterns as B-Rep compound
    registerCommand('pattern', {
        aliases: ['pat'],
        description: 'Create patterns: pattern linear <count> <spacing> [axis] | pattern circular <count> [angle]',
        category: 'transform',
        params: [
            { name: 'type', type: 'string', required: true, description: 'Pattern type: linear or circular' },
            { name: 'count', type: 'int', required: true, description: 'Number of copies (including original)' },
            { name: 'arg1', type: 'number', required: false, default: null, description: 'For linear: spacing. For circular: angle in degrees (default 360)' },
            { name: 'arg2', type: 'string', required: false, default: null, description: 'For linear: axis (x/y/z). For circular: axis (x/y/z, default z)' }
        ],
        validate(params, context) {
            if (!context.selection?.length) return 'Nothing selected';
            const type = params.type.toLowerCase();
            if (!['linear', 'lin', 'l', 'circular', 'circ', 'c'].includes(type)) {
                return `Unknown pattern type: ${params.type}. Supported: linear, circular`;
            }
            if (params.count < 2) return 'Count must be at least 2';
            if (params.count > 1000) return 'Count too large (max 1000)';
            
            const isLinear = ['linear', 'lin', 'l'].includes(type);
            if (isLinear && (params.arg1 === null || params.arg1 <= 0)) {
                return 'Linear pattern requires positive spacing';
            }
            return true;
        },
        async execute(params, context) {
            const results = [];
            const type = params.type.toLowerCase();
            const isCircular = ['circular', 'circ', 'c'].includes(type);
            
            if (isCircular) {
                // Circular pattern
                const angle = params.arg1 !== null ? params.arg1 : 360;
                const axisStr = (params.arg2 || 'z').toLowerCase();
                
                // Parse axis direction
                let axisDirection;
                if (axisStr === 'x') {
                    axisDirection = [1, 0, 0];
                } else if (axisStr === 'y') {
                    axisDirection = [0, 1, 0];
                } else if (axisStr === 'z') {
                    axisDirection = [0, 0, 1];
                } else if (axisStr === '-x') {
                    axisDirection = [-1, 0, 0];
                } else if (axisStr === '-y') {
                    axisDirection = [0, -1, 0];
                } else if (axisStr === '-z') {
                    axisDirection = [0, 0, -1];
                } else {
                    // Try to parse as vector "x,y,z"
                    const parts = axisStr.split(',').map(p => parseFloat(p.trim()));
                    if (parts.length === 3 && parts.every(p => !isNaN(p))) {
                        const len = Math.sqrt(parts[0]**2 + parts[1]**2 + parts[2]**2);
                        if (len < 1e-10) {
                            throw new Error('Axis vector cannot be zero');
                        }
                        axisDirection = [parts[0]/len, parts[1]/len, parts[2]/len];
                    } else {
                        throw new Error(`Invalid axis: ${params.arg2}. Use x, y, z, or x,y,z vector`);
                    }
                }
                
                for (const id of context.selection) {
                    const result = await kernel.circularPattern(
                        id,
                        params.count,
                        angle,
                        [0, 0, 0],     // axis origin at world origin
                        axisDirection
                    );
                    results.push(result);
                    
                    if (context.document && result.id) {
                        context.document.addBody(result.id, {
                            ...result,
                            type: 'circularPattern',
                            sourceId: id,
                            params: {
                                count: params.count,
                                angle,
                                axisDirection
                            }
                        });
                    }
                }
            } else {
                // Linear pattern
                const spacing = params.arg1;
                const axisStr = (params.arg2 || 'x').toLowerCase();
                
                // Parse direction from axis parameter
                let direction;
                if (axisStr === 'x') {
                    direction = [1, 0, 0];
                } else if (axisStr === 'y') {
                    direction = [0, 1, 0];
                } else if (axisStr === 'z') {
                    direction = [0, 0, 1];
                } else if (axisStr === '-x') {
                    direction = [-1, 0, 0];
                } else if (axisStr === '-y') {
                    direction = [0, -1, 0];
                } else if (axisStr === '-z') {
                    direction = [0, 0, -1];
                } else {
                    // Try to parse as vector "x,y,z"
                    const parts = axisStr.split(',').map(p => parseFloat(p.trim()));
                    if (parts.length === 3 && parts.every(p => !isNaN(p))) {
                        const len = Math.sqrt(parts[0]**2 + parts[1]**2 + parts[2]**2);
                        if (len < 1e-10) {
                            throw new Error('Direction vector cannot be zero');
                        }
                        direction = [parts[0]/len, parts[1]/len, parts[2]/len];
                    } else {
                        throw new Error(`Invalid axis: ${params.arg2}. Use x, y, z, -x, -y, -z, or x,y,z vector`);
                    }
                }
                
                for (const id of context.selection) {
                    const result = await kernel.linearPattern(
                        id,
                        direction,
                        params.count,
                        spacing
                    );
                    results.push(result);
                    
                    if (context.document && result.id) {
                        context.document.addBody(result.id, {
                            ...result,
                            type: 'linearPattern',
                            sourceId: id,
                            params: {
                                count: params.count,
                                spacing,
                                direction
                            }
                        });
                    }
                }
            }
            
            return results;
        }
    });
}

export default { registerTransformCommands };
