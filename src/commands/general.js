/**
 * Ameri-CAD General Commands
 * 
 * Utility commands: help, undo, redo, delete, select, view, etc.
 */

import { registerCommand, listCommands, help as getHelp } from '../core/commands.js';

/**
 * Register all general commands
 */
export function registerGeneralCommands(app) {
    
    // HELP - Show help
    registerCommand('help', {
        aliases: ['?', 'h'],
        description: 'Show help for a command or list all commands',
        category: 'general',
        params: [
            { name: 'command', type: 'string', required: false, description: 'Command to get help for' }
        ],
        execute(params) {
            return getHelp(params.command);
        }
    });
    
    // UNDO - Undo last action
    registerCommand('undo', {
        aliases: ['u', 'z'],
        description: 'Undo the last action',
        category: 'general',
        params: [
            { name: 'count', type: 'int', required: false, default: 1, description: 'Number of steps to undo' }
        ],
        execute(params, context) {
            for (let i = 0; i < params.count; i++) {
                if (context.history?.canUndo()) {
                    context.history.undo();
                } else {
                    return `Undid ${i} action(s)`;
                }
            }
            return `Undid ${params.count} action(s)`;
        }
    });
    
    // REDO - Redo last undone action
    registerCommand('redo', {
        aliases: ['y'],
        description: 'Redo the last undone action',
        category: 'general',
        params: [
            { name: 'count', type: 'int', required: false, default: 1, description: 'Number of steps to redo' }
        ],
        execute(params, context) {
            for (let i = 0; i < params.count; i++) {
                if (context.history?.canRedo()) {
                    context.history.redo();
                } else {
                    return `Redid ${i} action(s)`;
                }
            }
            return `Redid ${params.count} action(s)`;
        }
    });
    
    // DELETE - Delete selected objects
    registerCommand('delete', {
        aliases: ['del', 'remove', 'rm', 'erase'],
        description: 'Delete selected objects',
        category: 'general',
        validate(params, context) {
            if (!context.selection?.length) return 'Nothing selected';
            return true;
        },
        execute(params, context) {
            const count = context.selection.length;
            for (const id of [...context.selection]) {
                context.document?.removeBody(id);
            }
            context.selection.length = 0;
            return `Deleted ${count} object(s)`;
        }
    });
    
    // SELECT - Select objects
    registerCommand('select', {
        aliases: ['sel', 'pick'],
        description: 'Select objects by ID or type',
        category: 'general',
        params: [
            { name: 'target', type: 'string', required: false, default: 'all', description: 'Object ID, type, or "all"' }
        ],
        execute(params, context) {
            if (params.target === 'all') {
                const all = context.document?.getAllBodies() || [];
                context.selection = all.map(b => b.id);
                return `Selected ${context.selection.length} object(s)`;
            }
            
            if (params.target === 'none' || params.target === 'clear') {
                context.selection = [];
                return 'Selection cleared';
            }
            
            // Try to find by ID
            const body = context.document?.getBody(params.target);
            if (body) {
                context.selection = [params.target];
                return `Selected ${params.target}`;
            }
            
            // Try to find by type
            const byType = context.document?.getBodiesByType(params.target) || [];
            if (byType.length > 0) {
                context.selection = byType.map(b => b.id);
                return `Selected ${byType.length} ${params.target}(s)`;
            }
            
            return `No objects found matching: ${params.target}`;
        }
    });
    
    // DESELECT - Clear selection
    registerCommand('deselect', {
        aliases: ['desel', 'unselect', 'clear'],
        description: 'Clear the current selection',
        category: 'general',
        execute(params, context) {
            context.selection = [];
            return 'Selection cleared';
        }
    });
    
    // LIST - List objects in document
    registerCommand('list', {
        aliases: ['ls', 'objects'],
        description: 'List all objects in the document',
        category: 'general',
        params: [
            { name: 'type', type: 'string', required: false, description: 'Filter by type' }
        ],
        execute(params, context) {
            const bodies = params.type 
                ? context.document?.getBodiesByType(params.type) || []
                : context.document?.getAllBodies() || [];
            
            if (bodies.length === 0) {
                return 'No objects in document';
            }
            
            return bodies.map(b => `${b.id}: ${b.type}`).join('\n');
        }
    });
    
    // INFO - Get info about selected objects
    registerCommand('info', {
        aliases: ['properties', 'props'],
        description: 'Show information about selected objects',
        category: 'general',
        validate(params, context) {
            if (!context.selection?.length) return 'Nothing selected';
            return true;
        },
        async execute(params, context) {
            const results = [];
            
            for (const id of context.selection) {
                const body = context.document?.getBody(id);
                if (body) {
                    const info = {
                        id: body.id,
                        type: body.type,
                        params: body.params
                    };
                    
                    // Get volume if kernel available
                    if (context.kernel) {
                        const volume = await context.kernel.calculateVolume(id);
                        info.volume = volume;
                    }
                    
                    results.push(info);
                }
            }
            
            return JSON.stringify(results, null, 2);
        }
    });
    
    // ZOOM - Zoom view
    registerCommand('zoom', {
        aliases: ['z'],
        description: 'Zoom the view',
        category: 'view',
        params: [
            { name: 'mode', type: 'string', required: false, default: 'fit', description: 'fit, in, out, or factor' }
        ],
        execute(params, context) {
            const camera = context.camera;
            if (!camera) return 'No camera available';
            
            switch (params.mode) {
                case 'fit':
                case 'all':
                case 'extents':
                    context.view?.fitAll();
                    return 'Zoomed to fit';
                    
                case 'in':
                    camera.zoom *= 1.2;
                    return 'Zoomed in';
                    
                case 'out':
                    camera.zoom *= 0.8;
                    return 'Zoomed out';
                    
                default:
                    const factor = parseFloat(params.mode);
                    if (!isNaN(factor) && factor > 0) {
                        camera.zoom = factor;
                        return `Zoom set to ${factor}`;
                    }
                    return 'Invalid zoom mode';
            }
        }
    });
    
    // VIEW - Set view angle
    registerCommand('view', {
        aliases: ['v'],
        description: 'Set view to standard angle',
        category: 'view',
        params: [
            { name: 'angle', type: 'string', required: true, description: 'front, back, top, bottom, left, right, iso' }
        ],
        execute(params, context) {
            const views = {
                front: { x: 0, y: 0, z: 1 },
                back: { x: 0, y: 0, z: -1 },
                top: { x: 0, y: 1, z: 0 },
                bottom: { x: 0, y: -1, z: 0 },
                left: { x: -1, y: 0, z: 0 },
                right: { x: 1, y: 0, z: 0 },
                iso: { x: 1, y: 1, z: 1 },
                isometric: { x: 1, y: 1, z: 1 }
            };
            
            const dir = views[params.angle.toLowerCase()];
            if (!dir) {
                return `Unknown view: ${params.angle}. Use: ${Object.keys(views).join(', ')}`;
            }
            
            context.view?.setViewDirection(dir);
            return `View set to ${params.angle}`;
        }
    });
    
    // EXPORT - Export model
    registerCommand('export', {
        aliases: ['save'],
        description: 'Export model to file',
        category: 'general',
        params: [
            { name: 'format', type: 'string', required: false, default: 'step', description: 'Format: step, stl, obj, gltf' },
            { name: 'filename', type: 'string', required: false, description: 'Output filename' }
        ],
        async execute(params, context) {
            if (!context.kernel) return 'No kernel available';
            
            const result = await context.kernel.export(params.format);
            
            // Trigger download
            const blob = new Blob([result.data], { type: result.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = params.filename || `model.${params.format}`;
            a.click();
            URL.revokeObjectURL(url);
            
            return `Exported to ${a.download}`;
        }
    });
    
    // IMPORT - Import model
    registerCommand('import', {
        aliases: ['load', 'open'],
        description: 'Import model from file',
        category: 'general',
        params: [
            { name: 'file', type: 'string', required: false, description: 'File path or URL' }
        ],
        async execute(params, context) {
            // Open file picker if no file specified
            if (!params.file) {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.step,.stp,.stl,.obj,.gltf,.glb';
                
                return new Promise((resolve) => {
                    input.onchange = async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const result = await context.kernel.import(file);
                            resolve(`Imported ${result.bodies.length} bodies from ${file.name}`);
                        } else {
                            resolve('Import cancelled');
                        }
                    };
                    input.click();
                });
            }
            
            const result = await context.kernel.importUrl(params.file);
            return `Imported ${result.bodies.length} bodies`;
        }
    });
    
    // NEW - New document
    registerCommand('new', {
        description: 'Create a new empty document',
        category: 'general',
        execute(params, context) {
            if (confirm('Create new document? Unsaved changes will be lost.')) {
                context.document?.clear();
                context.selection = [];
                return 'New document created';
            }
            return 'Cancelled';
        }
    });
    
    // CLEAR - Clear document
    registerCommand('clearall', {
        description: 'Clear all objects from document',
        category: 'general',
        execute(params, context) {
            context.document?.clear();
            context.selection = [];
            return 'Document cleared';
        }
    });
}

export default { registerGeneralCommands };
