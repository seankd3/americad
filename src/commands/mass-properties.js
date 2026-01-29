/**
 * Ameri-CAD Mass Properties Commands
 * 
 * Commands for calculating and displaying mass properties.
 */

import { registerCommand } from '../core/commands.js';
import { getMassPropertiesPanel } from '../ui/mass-properties-panel.js';

/**
 * Register all mass properties commands
 */
export function registerMassPropertiesCommands(_app) {
    
    // MASSPROPS - Show mass properties of selection
    registerCommand('massprops', {
        aliases: ['mp', 'massprop', 'mass', 'weight', 'volume', 'properties'],
        description: 'Calculate and display mass properties of selected geometry',
        category: 'tools',
        params: [
            { name: 'subcommand', type: 'string', required: false, description: 'Subcommand or density value' },
            { name: 'value', type: 'number', required: false, description: 'Density value for "density" subcommand' }
        ],
        async execute(params, context) {
            const panel = getMassPropertiesPanel();
            const kernel = context.kernel || context.app?.kernel;
            
            if (!kernel) {
                return 'Kernel not available';
            }
            
            panel.setKernel(kernel);
            
            const subcommand = params.subcommand?.toLowerCase();
            
            // Handle density subcommand
            if (subcommand === 'density' || subcommand === 'd') {
                const densityValue = params.value;
                if (typeof densityValue !== 'number' || isNaN(densityValue)) {
                    return 'Usage: massprops density <value>\nExample: massprops density 7.85 (for steel)';
                }
                if (densityValue <= 0) {
                    return 'Density must be a positive number';
                }
                
                // Set density and recalculate if there's a selection
                panel.density = densityValue;
                
                if (!context.selection?.length) {
                    panel.show();
                    return `Density set to ${densityValue} g/cm³. Select a solid to calculate.`;
                }
                
                // Get selected feature's kernel shape ID
                const selectedId = context.selection[0];
                const feature = context.document?.bodies?.get(selectedId);
                
                if (!feature?.kernelId) {
                    return 'Selected object has no kernel geometry';
                }
                
                panel.show();
                await panel.calculate(feature.kernelId, densityValue);
                return `Mass properties calculated with density ${densityValue} g/cm³`;
            }
            
            // Handle hide/close
            if (subcommand === 'hide' || subcommand === 'close' || subcommand === 'off') {
                panel.hide();
                return 'Mass properties panel closed';
            }
            
            // Handle clear
            if (subcommand === 'clear') {
                panel.clear();
                return 'Mass properties cleared';
            }
            
            // Handle copy
            if (subcommand === 'copy') {
                await panel.copyToClipboard();
                return 'Mass properties copied to clipboard';
            }
            
            // If subcommand looks like a number, treat it as density shortcut
            const directDensity = parseFloat(subcommand);
            if (!isNaN(directDensity) && directDensity > 0) {
                panel.density = directDensity;
                
                if (!context.selection?.length) {
                    panel.show();
                    return `Density set to ${directDensity} g/cm³. Select a solid to calculate.`;
                }
                
                const selectedId = context.selection[0];
                const feature = context.document?.bodies?.get(selectedId);
                
                if (!feature?.kernelId) {
                    return 'Selected object has no kernel geometry';
                }
                
                panel.show();
                await panel.calculate(feature.kernelId, directDensity);
                return `Mass properties calculated with density ${directDensity} g/cm³`;
            }
            
            // Default behavior: show mass properties of selection
            if (!context.selection?.length) {
                panel.show();
                panel.showEmpty('Select a solid to view mass properties');
                return 'Select a solid to calculate mass properties';
            }
            
            // Get selected feature's kernel shape ID
            const selectedId = context.selection[0];
            const feature = context.document?.bodies?.get(selectedId);
            
            if (!feature?.kernelId) {
                return 'Selected object has no kernel geometry';
            }
            
            panel.show();
            await panel.calculate(feature.kernelId);
            
            // Return summary
            const data = panel.getData();
            if (data) {
                return [
                    `Mass Properties:`,
                    `  Volume: ${panel.formatVolume(data.volume, data.volumeCm3)}`,
                    `  Surface Area: ${panel.formatArea(data.surfaceArea, data.surfaceAreaCm2)}`,
                    `  Mass: ${panel.formatMass(data.mass)} (at ${data.density} g/cm³)`,
                    `  Center of Gravity: (${data.centerOfGravity.x.toFixed(2)}, ${data.centerOfGravity.y.toFixed(2)}, ${data.centerOfGravity.z.toFixed(2)})`
                ].join('\n');
            }
            
            return 'Mass properties calculated';
        }
    });
    
    // Convenience aliases as separate commands
    
    // CENTROID - Quick access to center of gravity
    registerCommand('centroid', {
        aliases: ['cog', 'centerofgravity', 'centermass'],
        description: 'Show center of gravity of selected geometry',
        category: 'tools',
        async execute(params, context) {
            const kernel = context.kernel || context.app?.kernel;
            
            if (!kernel) {
                return 'Kernel not available';
            }
            
            if (!context.selection?.length) {
                return 'Select a solid to find centroid';
            }
            
            const selectedId = context.selection[0];
            const feature = context.document?.bodies?.get(selectedId);
            
            if (!feature?.kernelId) {
                return 'Selected object has no kernel geometry';
            }
            
            try {
                const props = await kernel.getMassProperties(feature.kernelId, 1.0);
                const cog = props.centerOfGravity;
                return `Center of Gravity: X=${cog.x.toFixed(4)}, Y=${cog.y.toFixed(4)}, Z=${cog.z.toFixed(4)} mm`;
            } catch (e) {
                return 'Failed to calculate centroid: ' + e.message;
            }
        }
    });
    
    // SURFAREA - Quick surface area
    registerCommand('surfarea', {
        aliases: ['sa', 'area', 'surfacearea'],
        description: 'Show surface area of selected geometry',
        category: 'tools',
        async execute(params, context) {
            const kernel = context.kernel || context.app?.kernel;
            
            if (!kernel) {
                return 'Kernel not available';
            }
            
            if (!context.selection?.length) {
                return 'Select a solid to calculate surface area';
            }
            
            const selectedId = context.selection[0];
            const feature = context.document?.bodies?.get(selectedId);
            
            if (!feature?.kernelId) {
                return 'Selected object has no kernel geometry';
            }
            
            try {
                const props = await kernel.getMassProperties(feature.kernelId, 1.0);
                const mm2 = props.surfaceArea;
                const cm2 = props.surfaceAreaCm2;
                
                if (cm2 >= 1) {
                    return `Surface Area: ${cm2.toFixed(4)} cm² (${mm2.toFixed(2)} mm²)`;
                }
                return `Surface Area: ${mm2.toFixed(4)} mm²`;
            } catch (e) {
                return 'Failed to calculate surface area: ' + e.message;
            }
        }
    });
}

export default { registerMassPropertiesCommands };
