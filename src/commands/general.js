/**
 * Ameri-CAD General Commands
 * 
 * Utility commands: help, undo, redo, delete, select, view, etc.
 */

import { registerCommand, help as getHelp } from '../core/commands.js';
import { hasEditableParams } from '../ui/param-editor.js';

/**
 * Register all general commands
 */
export function registerGeneralCommands(_app) {
    
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
    
    // EDIT - Edit feature parameters
    registerCommand('edit', {
        aliases: ['modify', 'params', 'properties'],
        description: 'Edit parameters of selected feature or specified feature by ID',
        category: 'general',
        params: [
            { name: 'featureId', type: 'string', required: false, description: 'Feature ID to edit (default: selected)' }
        ],
        execute(params, context) {
            // Determine which feature to edit
            let featureId = params.featureId;
            
            if (!featureId) {
                // Use selected feature
                if (context.app?.selectedFeatureId) {
                    featureId = context.app.selectedFeatureId;
                } else if (context.selection?.length === 1) {
                    featureId = context.selection[0];
                } else if (context.selection?.length > 1) {
                    return 'Multiple features selected. Specify one or select a single feature.';
                } else {
                    return 'No feature selected. Select a feature or specify an ID.';
                }
            }
            
            // Get the feature
            const feature = context.document?.getFeature?.(featureId) || context.app?.document?.getFeature?.(featureId);
            if (!feature) {
                return `Feature not found: ${featureId}`;
            }
            
            // Check if feature has editable parameters
            if (!hasEditableParams(feature.type)) {
                return `Feature '${feature.name}' (${feature.type}) has no editable parameters`;
            }
            
            // Open the parameter editor
            if (context.app?.editFeature) {
                context.app.editFeature(featureId);
                return `Opening parameter editor for ${feature.name}...`;
            }
            
            return `Cannot edit feature: app context not available`;
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
    
    // VIEW - Set view angle (with orthographic support)
    registerCommand('view', {
        aliases: ['v'],
        description: 'Set view to standard angle or toggle ortho/perspective',
        category: 'view',
        params: [
            { name: 'angle', type: 'string', required: true, description: 'front, back, top, bottom, left, right, iso, ortho, reset' }
        ],
        execute(params, context) {
            const angle = params.angle.toLowerCase();
            
            // Use camera preset manager if available
            if (context.cameraPresets) {
                if (angle === 'ortho' || angle === 'toggle') {
                    const isOrtho = context.cameraPresets.toggleOrtho();
                    return `Projection: ${isOrtho ? 'ORTHOGRAPHIC' : 'PERSPECTIVE'}`;
                }
                
                if (angle === 'reset') {
                    context.cameraPresets.reset();
                    return 'View reset to default';
                }
                
                // Standard view presets
                const validViews = ['front', 'back', 'left', 'right', 'top', 'bottom', 'iso'];
                if (validViews.includes(angle)) {
                    context.cameraPresets.setView(angle);
                    return `View: ${angle.toUpperCase()}`;
                }
                
                // Handle aliases
                if (angle === 'isometric') {
                    context.cameraPresets.setView('iso');
                    return 'View: ISO';
                }
                
                return `Unknown view: ${angle}. Use: ${validViews.join(', ')}, ortho, reset`;
            }
            
            // Fallback to basic view direction
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
            
            const dir = views[angle];
            if (!dir) {
                return `Unknown view: ${angle}. Use: ${Object.keys(views).join(', ')}`;
            }
            
            context.view?.setViewDirection(dir);
            return `View set to ${angle}`;
        }
    });
    
    // EXPORT - Export model
    registerCommand('export', {
        aliases: ['save'],
        description: 'Export model to file format (STEP, STL)',
        category: 'general',
        params: [
            { name: 'format', type: 'string', required: false, default: 'step', description: 'Format: step, stl' },
            { name: 'filename', type: 'string', required: false, description: 'Output filename' }
        ],
        async execute(params, context) {
            // Import kernel bridge for direct export
            const { kernel, downloadFile } = await import('../kernel/bridge.js');
            
            if (!kernel.isReady()) {
                return 'Kernel not ready - cannot export';
            }
            
            const format = params.format.toLowerCase();
            const filename = params.filename || `model.${format === 'stp' ? 'step' : format}`;
            
            try {
                let result;
                
                switch (format) {
                    case 'step':
                    case 'stp':
                        // Export all shapes in kernel memory
                        result = await kernel.exportSTEPAll();
                        downloadFile(result.content, filename, 'application/step');
                        const count = result.count ? ` (${result.count} shape${result.count > 1 ? 's' : ''})` : '';
                        return `Exported STEP to ${filename}${count}`;
                        
                    case 'stl':
                        // STL requires a specific shape ID
                        if (!context.selection?.length) {
                            return 'Select a shape to export to STL';
                        }
                        // Get kernel ID from selection
                        const selectedId = context.selection[0];
                        result = await kernel.exportSTL(selectedId);
                        downloadFile(result.content, filename, 'application/sla');
                        return `Exported STL to ${filename}`;
                        
                    default:
                        return `Unsupported format: ${format}. Use: step, stl`;
                }
            } catch (error) {
                return `Export failed: ${error.message}`;
            }
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
    
    // SUPPRESS - Suppress selected feature(s)
    registerCommand('suppress', {
        aliases: ['sup'],
        description: 'Suppress selected feature(s) - skips during regeneration',
        category: 'general',
        params: [
            { name: 'target', type: 'string', required: false, default: '', description: '"all" to suppress all, or feature ID' }
        ],
        validate(params, context) {
            if (params.target === 'all') return true;
            if (params.target) return true;
            if (!context.selection?.length && !context.app?.selectedFeatureId) {
                return 'Nothing selected. Select a feature or specify "suppress all"';
            }
            return true;
        },
        async execute(params, context) {
            const doc = context.document || context.app?.document;
            if (!doc) return 'No document available';
            
            if (params.target === 'all') {
                doc.suppressAll();
                // Re-evaluate if evaluator available
                if (context.evaluator) {
                    await context.evaluator.evaluateAll();
                } else if (context.app?.evaluator) {
                    await context.app.evaluator.evaluateAll();
                }
                return 'Suppressed all features';
            }
            
            // Get feature IDs to suppress
            let featureIds = [];
            if (params.target) {
                featureIds = [params.target];
            } else if (context.app?.selectedFeatureId) {
                featureIds = [context.app.selectedFeatureId];
            } else if (context.selection?.length) {
                featureIds = [...context.selection];
            }
            
            let suppressed = 0;
            for (const id of featureIds) {
                const feature = doc.getFeature(id);
                if (feature && !feature.suppressed) {
                    doc.setSuppression(id, true);
                    suppressed++;
                    // Re-evaluate from this feature
                    const evaluator = context.evaluator || context.app?.evaluator;
                    if (evaluator) {
                        await evaluator.handleSuppressionChange(id);
                    }
                }
            }
            
            return `Suppressed ${suppressed} feature(s)`;
        }
    });
    
    // UNSUPPRESS - Unsuppress selected feature(s)
    registerCommand('unsuppress', {
        aliases: ['unsup'],
        description: 'Unsuppress selected feature(s) - restores during regeneration',
        category: 'general',
        params: [
            { name: 'target', type: 'string', required: false, default: '', description: '"all" to unsuppress all, or feature ID' }
        ],
        validate(params, context) {
            if (params.target === 'all') return true;
            if (params.target) return true;
            if (!context.selection?.length && !context.app?.selectedFeatureId) {
                return 'Nothing selected. Select a feature or specify "unsuppress all"';
            }
            return true;
        },
        async execute(params, context) {
            const doc = context.document || context.app?.document;
            if (!doc) return 'No document available';
            
            if (params.target === 'all') {
                doc.unsuppressAll();
                // Re-evaluate if evaluator available
                if (context.evaluator) {
                    await context.evaluator.evaluateAll();
                } else if (context.app?.evaluator) {
                    await context.app.evaluator.evaluateAll();
                }
                return 'Unsuppressed all features';
            }
            
            // Get feature IDs to unsuppress
            let featureIds = [];
            if (params.target) {
                featureIds = [params.target];
            } else if (context.app?.selectedFeatureId) {
                featureIds = [context.app.selectedFeatureId];
            } else if (context.selection?.length) {
                featureIds = [...context.selection];
            }
            
            let unsuppressed = 0;
            for (const id of featureIds) {
                const feature = doc.getFeature(id);
                if (feature && feature.suppressed) {
                    doc.setSuppression(id, false);
                    unsuppressed++;
                    // Re-evaluate from this feature
                    const evaluator = context.evaluator || context.app?.evaluator;
                    if (evaluator) {
                        await evaluator.handleSuppressionChange(id);
                    }
                }
            }
            
            return `Unsuppressed ${unsuppressed} feature(s)`;
        }
    });
}

export default { registerGeneralCommands };
