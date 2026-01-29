/**
 * Ameri-CAD Export Commands
 * 
 * Commands for exporting geometry to various formats
 */

import { registerCommand } from '../core/commands.js';
import { meshToSTL, meshToSTLBinary, mergeMeshesToSTL, downloadSTL, getSTLStats, geometryToMeshData } from '../io/stl-export.js';

/**
 * Register all export commands
 */
export function registerExportCommands(_app) {
    
    // EXPORT STL - Export to STL format
    registerCommand('export stl', {
        aliases: ['stl', 'exportstl'],
        description: 'Export selected geometry to STL format for 3D printing',
        category: 'export',
        params: [
            { name: 'format', type: 'string', required: false, default: 'binary', description: 'Format: binary or ascii' },
            { name: 'filename', type: 'string', required: false, default: 'model', description: 'Output filename (without extension)' },
            { name: 'all', type: 'boolean', required: false, default: false, description: 'Export all visible bodies instead of selection' }
        ],
        async execute(params, context) {
            const binary = params.format !== 'ascii';
            const filename = params.filename || 'model';
            
            // Determine what to export
            let featureIds = [];
            
            if (params.all) {
                // Export all visible features
                const features = Array.from(context.document?.features?.values() || []);
                featureIds = features.filter(f => f.visible).map(f => f.id);
            } else if (context.selection?.length > 0) {
                // Export selected features
                featureIds = [...context.selection];
            } else if (context.app?.selectedFeatureId) {
                // Single selected feature
                featureIds = [context.app.selectedFeatureId];
            }
            
            if (featureIds.length === 0) {
                return 'Nothing to export. Select geometry or use --all flag.';
            }
            
            // Collect mesh data from features
            const meshes = [];
            const evaluator = context.app?.evaluator;
            
            for (const id of featureIds) {
                const mesh = evaluator?.getMesh(id);
                if (mesh?.geometry) {
                    const meshData = geometryToMeshData(mesh.geometry);
                    meshes.push(meshData);
                }
            }
            
            if (meshes.length === 0) {
                return 'No mesh data found for selected features.';
            }
            
            // Generate STL
            let content;
            if (meshes.length === 1) {
                content = binary 
                    ? meshToSTLBinary(meshes[0], `Ameri-CAD: ${filename}`)
                    : meshToSTL(meshes[0], filename);
            } else {
                content = mergeMeshesToSTL(meshes, filename, binary);
            }
            
            // Get stats for feedback
            const totalTriangles = meshes.reduce((sum, m) => sum + m.indices.length / 3, 0);
            
            // Trigger download
            downloadSTL(content, `${filename}.stl`, binary);
            
            const formatName = binary ? 'binary' : 'ASCII';
            return `Exported ${formatName} STL: ${totalTriangles} triangles, ${meshes.length} body(s) → ${filename}.stl`;
        }
    });
    
    // EXPORT STL STATS - Show STL export statistics without downloading
    registerCommand('stl stats', {
        aliases: ['stlstats', 'stlinfo'],
        description: 'Show STL export statistics for selected geometry',
        category: 'export',
        async execute(params, context) {
            let featureIds = [];
            
            if (context.selection?.length > 0) {
                featureIds = [...context.selection];
            } else if (context.app?.selectedFeatureId) {
                featureIds = [context.app.selectedFeatureId];
            }
            
            if (featureIds.length === 0) {
                return 'Nothing selected. Select geometry to see STL stats.';
            }
            
            const evaluator = context.app?.evaluator;
            const meshes = [];
            
            for (const id of featureIds) {
                const mesh = evaluator?.getMesh(id);
                if (mesh?.geometry) {
                    meshes.push(geometryToMeshData(mesh.geometry));
                }
            }
            
            if (meshes.length === 0) {
                return 'No mesh data found.';
            }
            
            // Calculate combined stats
            let totalTriangles = 0;
            let totalVertices = 0;
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
            
            for (const mesh of meshes) {
                const stats = getSTLStats(mesh);
                totalTriangles += stats.triangleCount;
                totalVertices += stats.vertexCount;
                
                minX = Math.min(minX, stats.boundingBox.min.x);
                minY = Math.min(minY, stats.boundingBox.min.y);
                minZ = Math.min(minZ, stats.boundingBox.min.z);
                maxX = Math.max(maxX, stats.boundingBox.max.x);
                maxY = Math.max(maxY, stats.boundingBox.max.y);
                maxZ = Math.max(maxZ, stats.boundingBox.max.z);
            }
            
            const binarySize = 84 + totalTriangles * 50;
            const asciiSize = 80 + totalTriangles * 250;
            
            return [
                `STL Export Statistics`,
                `─────────────────────`,
                `Bodies: ${meshes.length}`,
                `Triangles: ${totalTriangles.toLocaleString()}`,
                `Vertices: ${totalVertices.toLocaleString()}`,
                ``,
                `Bounding Box:`,
                `  Min: (${minX.toFixed(2)}, ${minY.toFixed(2)}, ${minZ.toFixed(2)})`,
                `  Max: (${maxX.toFixed(2)}, ${maxY.toFixed(2)}, ${maxZ.toFixed(2)})`,
                `  Size: ${(maxX - minX).toFixed(2)} × ${(maxY - minY).toFixed(2)} × ${(maxZ - minZ).toFixed(2)}`,
                ``,
                `Estimated File Size:`,
                `  Binary: ${formatBytes(binarySize)}`,
                `  ASCII:  ${formatBytes(asciiSize)}`
            ].join('\n');
        }
    });
    
    // EXPORT STEP - Export to STEP format (via kernel)
    registerCommand('export step', {
        aliases: ['step', 'exportstep'],
        description: 'Export selected geometry to STEP format',
        category: 'export',
        params: [
            { name: 'filename', type: 'string', required: false, default: 'model', description: 'Output filename' }
        ],
        async execute(params, context) {
            const featureId = context.selection?.[0] || context.app?.selectedFeatureId;
            
            if (!featureId) {
                return 'Nothing selected for STEP export.';
            }
            
            if (!context.app?.kernelReady) {
                return 'STEP export requires the geometry kernel. Kernel not ready.';
            }
            
            try {
                await context.app.exportSTEP(featureId);
                return `Exported STEP: ${params.filename}.step`;
            } catch (error) {
                return `STEP export failed: ${error.message}`;
            }
        }
    });
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default { registerExportCommands };
