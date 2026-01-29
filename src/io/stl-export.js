/**
 * Ameri-CAD STL Export
 * 
 * Exports tessellated mesh data to STL format for 3D printing.
 * Supports both ASCII and binary formats.
 */

/**
 * Convert mesh data to ASCII STL format
 * @param {Object} meshData - Mesh with vertices, normals, indices
 * @param {string} name - Solid name for the STL file
 * @returns {string} ASCII STL content
 */
export function meshToSTL(meshData, name = 'americad') {
    const { vertices, normals, indices } = meshData;
    const lines = [];
    
    // Sanitize name (no spaces or special chars)
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    lines.push(`solid ${safeName}`);
    
    // Process each triangle (every 3 indices)
    const triangleCount = indices.length / 3;
    
    for (let t = 0; t < triangleCount; t++) {
        const i0 = indices[t * 3];
        const i1 = indices[t * 3 + 1];
        const i2 = indices[t * 3 + 2];
        
        // Get vertex positions
        const v0 = getVertex(vertices, i0);
        const v1 = getVertex(vertices, i1);
        const v2 = getVertex(vertices, i2);
        
        // Calculate face normal from vertices (more reliable than averaged vertex normals)
        const normal = calculateFaceNormal(v0, v1, v2);
        
        lines.push(`  facet normal ${formatFloat(normal.x)} ${formatFloat(normal.y)} ${formatFloat(normal.z)}`);
        lines.push(`    outer loop`);
        lines.push(`      vertex ${formatFloat(v0.x)} ${formatFloat(v0.y)} ${formatFloat(v0.z)}`);
        lines.push(`      vertex ${formatFloat(v1.x)} ${formatFloat(v1.y)} ${formatFloat(v1.z)}`);
        lines.push(`      vertex ${formatFloat(v2.x)} ${formatFloat(v2.y)} ${formatFloat(v2.z)}`);
        lines.push(`    endloop`);
        lines.push(`  endfacet`);
    }
    
    lines.push(`endsolid ${safeName}`);
    
    return lines.join('\n');
}

/**
 * Convert mesh data to binary STL format
 * Binary STL is much smaller and faster to parse than ASCII
 * @param {Object} meshData - Mesh with vertices, normals, indices
 * @param {string} header - Optional 80-byte header text
 * @returns {ArrayBuffer} Binary STL data
 */
export function meshToSTLBinary(meshData, header = 'Ameri-CAD Binary STL Export') {
    const { vertices, indices } = meshData;
    const triangleCount = indices.length / 3;
    
    // Binary STL format:
    // - 80 bytes: header (text, no null terminator required)
    // - 4 bytes: number of triangles (uint32 little-endian)
    // - For each triangle (50 bytes each):
    //   - 12 bytes: normal vector (3x float32)
    //   - 36 bytes: 3 vertices (9x float32)
    //   - 2 bytes: attribute byte count (usually 0)
    
    const bufferSize = 80 + 4 + (triangleCount * 50);
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    
    // Write header (padded to 80 bytes)
    const headerBytes = new TextEncoder().encode(header.slice(0, 80).padEnd(80, ' '));
    for (let i = 0; i < 80; i++) {
        view.setUint8(i, headerBytes[i] || 0x20); // 0x20 = space
    }
    
    // Write triangle count
    view.setUint32(80, triangleCount, true); // little-endian
    
    // Write triangles
    let offset = 84;
    
    for (let t = 0; t < triangleCount; t++) {
        const i0 = indices[t * 3];
        const i1 = indices[t * 3 + 1];
        const i2 = indices[t * 3 + 2];
        
        // Get vertex positions
        const v0 = getVertex(vertices, i0);
        const v1 = getVertex(vertices, i1);
        const v2 = getVertex(vertices, i2);
        
        // Calculate face normal
        const normal = calculateFaceNormal(v0, v1, v2);
        
        // Write normal (3x float32)
        view.setFloat32(offset, normal.x, true); offset += 4;
        view.setFloat32(offset, normal.y, true); offset += 4;
        view.setFloat32(offset, normal.z, true); offset += 4;
        
        // Write vertex 0
        view.setFloat32(offset, v0.x, true); offset += 4;
        view.setFloat32(offset, v0.y, true); offset += 4;
        view.setFloat32(offset, v0.z, true); offset += 4;
        
        // Write vertex 1
        view.setFloat32(offset, v1.x, true); offset += 4;
        view.setFloat32(offset, v1.y, true); offset += 4;
        view.setFloat32(offset, v1.z, true); offset += 4;
        
        // Write vertex 2
        view.setFloat32(offset, v2.x, true); offset += 4;
        view.setFloat32(offset, v2.y, true); offset += 4;
        view.setFloat32(offset, v2.z, true); offset += 4;
        
        // Attribute byte count (unused, set to 0)
        view.setUint16(offset, 0, true); offset += 2;
    }
    
    return buffer;
}

/**
 * Merge multiple meshes into a single STL
 * @param {Array<Object>} meshes - Array of mesh data objects
 * @param {string} name - Solid name
 * @param {boolean} binary - Whether to output binary format
 * @returns {string|ArrayBuffer} STL content
 */
export function mergeMeshesToSTL(meshes, name = 'americad', binary = false) {
    // Merge all meshes into one
    const merged = mergeMeshes(meshes);
    
    if (binary) {
        return meshToSTLBinary(merged, `Ameri-CAD: ${name}`);
    } else {
        return meshToSTL(merged, name);
    }
}

/**
 * Merge multiple mesh data objects into one
 * @param {Array<Object>} meshes - Array of mesh data objects
 * @returns {Object} Merged mesh data
 */
export function mergeMeshes(meshes) {
    if (meshes.length === 0) {
        return { vertices: new Float32Array(0), normals: new Float32Array(0), indices: new Uint32Array(0) };
    }
    
    if (meshes.length === 1) {
        return meshes[0];
    }
    
    // Calculate total sizes
    let totalVertices = 0;
    let totalIndices = 0;
    
    for (const mesh of meshes) {
        totalVertices += mesh.vertices.length;
        totalIndices += mesh.indices.length;
    }
    
    // Allocate merged arrays
    const vertices = new Float32Array(totalVertices);
    const normals = new Float32Array(totalVertices);
    const indices = new Uint32Array(totalIndices);
    
    let vertexOffset = 0;
    let indexOffset = 0;
    let baseVertex = 0;
    
    for (const mesh of meshes) {
        // Copy vertices
        vertices.set(mesh.vertices, vertexOffset);
        
        // Copy normals
        if (mesh.normals) {
            normals.set(mesh.normals, vertexOffset);
        }
        
        // Copy and offset indices
        for (let i = 0; i < mesh.indices.length; i++) {
            indices[indexOffset + i] = mesh.indices[i] + baseVertex;
        }
        
        baseVertex += mesh.vertices.length / 3;
        vertexOffset += mesh.vertices.length;
        indexOffset += mesh.indices.length;
    }
    
    return { vertices, normals, indices };
}

/**
 * Get vertex position from vertex array
 * @param {Float32Array} vertices - Vertex array (xyz xyz xyz ...)
 * @param {number} index - Vertex index
 * @returns {{x: number, y: number, z: number}}
 */
function getVertex(vertices, index) {
    const i = index * 3;
    return {
        x: vertices[i],
        y: vertices[i + 1],
        z: vertices[i + 2]
    };
}

/**
 * Calculate face normal from three vertices using cross product
 * @param {{x,y,z}} v0 - First vertex
 * @param {{x,y,z}} v1 - Second vertex
 * @param {{x,y,z}} v2 - Third vertex
 * @returns {{x,y,z}} Normalized face normal
 */
function calculateFaceNormal(v0, v1, v2) {
    // Edge vectors
    const e1 = {
        x: v1.x - v0.x,
        y: v1.y - v0.y,
        z: v1.z - v0.z
    };
    
    const e2 = {
        x: v2.x - v0.x,
        y: v2.y - v0.y,
        z: v2.z - v0.z
    };
    
    // Cross product
    const normal = {
        x: e1.y * e2.z - e1.z * e2.y,
        y: e1.z * e2.x - e1.x * e2.z,
        z: e1.x * e2.y - e1.y * e2.x
    };
    
    // Normalize
    const length = Math.sqrt(normal.x ** 2 + normal.y ** 2 + normal.z ** 2);
    
    if (length > 1e-10) {
        normal.x /= length;
        normal.y /= length;
        normal.z /= length;
    } else {
        // Degenerate triangle, return up vector
        normal.x = 0;
        normal.y = 0;
        normal.z = 1;
    }
    
    return normal;
}

/**
 * Format float for STL (scientific notation with proper precision)
 * @param {number} num - Number to format
 * @returns {string} Formatted string
 */
function formatFloat(num) {
    // Handle edge cases
    if (!Number.isFinite(num)) return '0';
    
    // Use scientific notation for consistency
    return num.toExponential(6);
}

/**
 * Extract mesh data from Three.js BufferGeometry
 * Useful for exporting when you have Three.js geometry instead of raw mesh data
 * @param {THREE.BufferGeometry} geometry - Three.js geometry
 * @returns {Object} Mesh data compatible with STL export
 */
export function geometryToMeshData(geometry) {
    const positions = geometry.getAttribute('position');
    const index = geometry.getIndex();
    
    // Get vertices
    const vertices = new Float32Array(positions.array);
    
    // Get or generate indices
    let indices;
    if (index) {
        indices = new Uint32Array(index.array);
    } else {
        // Non-indexed geometry - create sequential indices
        indices = new Uint32Array(positions.count);
        for (let i = 0; i < positions.count; i++) {
            indices[i] = i;
        }
    }
    
    // Get normals if available
    const normalAttr = geometry.getAttribute('normal');
    const normals = normalAttr ? new Float32Array(normalAttr.array) : null;
    
    return { vertices, normals, indices };
}

/**
 * Download STL file in the browser
 * @param {string|ArrayBuffer} content - STL content
 * @param {string} filename - Download filename
 * @param {boolean} binary - Whether content is binary
 */
export function downloadSTL(content, filename = 'model.stl', binary = false) {
    let blob;
    
    if (binary || content instanceof ArrayBuffer) {
        blob = new Blob([content], { type: 'application/sla' });
    } else {
        blob = new Blob([content], { type: 'text/plain' });
    }
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.stl') ? filename : `${filename}.stl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Get STL file statistics
 * @param {Object} meshData - Mesh data
 * @returns {Object} Statistics about the mesh
 */
export function getSTLStats(meshData) {
    const { vertices, indices } = meshData;
    const triangleCount = indices.length / 3;
    const vertexCount = vertices.length / 3;
    
    // Calculate bounding box
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (let i = 0; i < vertices.length; i += 3) {
        minX = Math.min(minX, vertices[i]);
        maxX = Math.max(maxX, vertices[i]);
        minY = Math.min(minY, vertices[i + 1]);
        maxY = Math.max(maxY, vertices[i + 1]);
        minZ = Math.min(minZ, vertices[i + 2]);
        maxZ = Math.max(maxZ, vertices[i + 2]);
    }
    
    // Estimate file sizes
    const asciiSize = 80 + triangleCount * 250; // ~250 chars per facet in ASCII
    const binarySize = 84 + triangleCount * 50;  // 50 bytes per triangle in binary
    
    return {
        triangleCount,
        vertexCount,
        boundingBox: {
            min: { x: minX, y: minY, z: minZ },
            max: { x: maxX, y: maxY, z: maxZ },
            size: {
                x: maxX - minX,
                y: maxY - minY,
                z: maxZ - minZ
            }
        },
        estimatedSize: {
            ascii: asciiSize,
            binary: binarySize,
            asciiFormatted: formatBytes(asciiSize),
            binaryFormatted: formatBytes(binarySize)
        }
    };
}

/**
 * Format bytes into human-readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default {
    meshToSTL,
    meshToSTLBinary,
    mergeMeshesToSTL,
    mergeMeshes,
    geometryToMeshData,
    downloadSTL,
    getSTLStats
};
