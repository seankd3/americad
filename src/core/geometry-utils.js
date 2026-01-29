/**
 * Ameri-CAD Geometry Utilities
 * Functions for mesh analysis: volume calculation, bounding box, manifold checks
 */

import * as THREE from 'three';

/**
 * Calculate volume of a mesh using signed tetrahedron method
 * Works for closed/manifold meshes
 * @param {THREE.Mesh} mesh 
 * @returns {number}
 */
export function calculateVolume(mesh) {
    if (!mesh || !mesh.geometry) return 0;
    
    const geometry = mesh.geometry;
    const position = geometry.attributes.position;
    const index = geometry.index;
    
    let volume = 0;
    
    if (index) {
        // Indexed geometry
        for (let i = 0; i < index.count; i += 3) {
            const i0 = index.getX(i);
            const i1 = index.getX(i + 1);
            const i2 = index.getX(i + 2);
            
            const v0 = new THREE.Vector3().fromBufferAttribute(position, i0);
            const v1 = new THREE.Vector3().fromBufferAttribute(position, i1);
            const v2 = new THREE.Vector3().fromBufferAttribute(position, i2);
            
            // Apply mesh world transform
            v0.applyMatrix4(mesh.matrixWorld);
            v1.applyMatrix4(mesh.matrixWorld);
            v2.applyMatrix4(mesh.matrixWorld);
            
            // Signed volume of tetrahedron with origin
            volume += v0.dot(v1.clone().cross(v2)) / 6;
        }
    } else {
        // Non-indexed geometry
        for (let i = 0; i < position.count; i += 3) {
            const v0 = new THREE.Vector3().fromBufferAttribute(position, i);
            const v1 = new THREE.Vector3().fromBufferAttribute(position, i + 1);
            const v2 = new THREE.Vector3().fromBufferAttribute(position, i + 2);
            
            v0.applyMatrix4(mesh.matrixWorld);
            v1.applyMatrix4(mesh.matrixWorld);
            v2.applyMatrix4(mesh.matrixWorld);
            
            volume += v0.dot(v1.clone().cross(v2)) / 6;
        }
    }
    
    return Math.abs(volume);
}

/**
 * Validate bounding box of a mesh
 * @param {THREE.Mesh} mesh 
 * @returns {{ min: {x,y,z}, max: {x,y,z}, size: {x,y,z}, center: {x,y,z} } | null}
 */
export function validateBoundingBox(mesh) {
    if (!mesh || !mesh.geometry) {
        return null;
    }
    
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox.clone();
    
    // Apply world transform
    box.applyMatrix4(mesh.matrixWorld);
    
    const size = new THREE.Vector3();
    box.getSize(size);
    
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    return {
        min: { x: box.min.x, y: box.min.y, z: box.min.z },
        max: { x: box.max.x, y: box.max.y, z: box.max.z },
        size: { x: size.x, y: size.y, z: size.z },
        center: { x: center.x, y: center.y, z: center.z }
    };
}

/**
 * Check if mesh is manifold using Euler characteristic
 * For closed manifold: V - E + F = 2
 * @param {THREE.Mesh} mesh 
 * @returns {{ isManifold: boolean, vertices?: number, edges?: number, faces?: number, euler?: number, error?: string }}
 */
export function checkManifold(mesh) {
    if (!mesh || !mesh.geometry) {
        return { isManifold: false, error: 'No geometry' };
    }
    
    const geometry = mesh.geometry;
    const position = geometry.attributes.position;
    const index = geometry.index;
    
    // Build edge set using vertex pairs
    const edgeSet = new Set();
    const vertexSet = new Set();
    let faceCount = 0;
    
    const makeEdgeKey = (a, b) => {
        return a < b ? `${a}-${b}` : `${b}-${a}`;
    };
    
    const roundVertex = (v) => {
        // Round to avoid floating point issues
        return `${v.x.toFixed(6)},${v.y.toFixed(6)},${v.z.toFixed(6)}`;
    };
    
    if (index) {
        for (let i = 0; i < index.count; i += 3) {
            const i0 = index.getX(i);
            const i1 = index.getX(i + 1);
            const i2 = index.getX(i + 2);
            
            // Track unique vertices
            const v0 = new THREE.Vector3().fromBufferAttribute(position, i0);
            const v1 = new THREE.Vector3().fromBufferAttribute(position, i1);
            const v2 = new THREE.Vector3().fromBufferAttribute(position, i2);
            
            vertexSet.add(roundVertex(v0));
            vertexSet.add(roundVertex(v1));
            vertexSet.add(roundVertex(v2));
            
            // Track edges
            edgeSet.add(makeEdgeKey(i0, i1));
            edgeSet.add(makeEdgeKey(i1, i2));
            edgeSet.add(makeEdgeKey(i2, i0));
            
            faceCount++;
        }
    } else {
        for (let i = 0; i < position.count; i += 3) {
            const v0 = new THREE.Vector3().fromBufferAttribute(position, i);
            const v1 = new THREE.Vector3().fromBufferAttribute(position, i + 1);
            const v2 = new THREE.Vector3().fromBufferAttribute(position, i + 2);
            
            vertexSet.add(roundVertex(v0));
            vertexSet.add(roundVertex(v1));
            vertexSet.add(roundVertex(v2));
            
            edgeSet.add(makeEdgeKey(i, i + 1));
            edgeSet.add(makeEdgeKey(i + 1, i + 2));
            edgeSet.add(makeEdgeKey(i + 2, i));
            
            faceCount++;
        }
    }
    
    const V = vertexSet.size;
    const E = edgeSet.size;
    const F = faceCount;
    const euler = V - E + F;
    
    return {
        isManifold: euler === 2,
        vertices: V,
        edges: E,
        faces: F,
        euler: euler,
        expected: 2
    };
}

/**
 * Get mesh statistics for comparison
 * @param {THREE.Mesh} mesh 
 * @returns {{ volume: number, boundingBox: object, manifold: object, vertexCount: number, faceCount: number }}
 */
export function getMeshStats(mesh) {
    const volume = calculateVolume(mesh);
    const bbox = validateBoundingBox(mesh);
    const manifold = checkManifold(mesh);
    
    return {
        volume,
        boundingBox: bbox,
        manifold,
        vertexCount: mesh.geometry.attributes.position.count,
        faceCount: manifold.faces
    };
}

// Default export for convenience
export const GeometryUtils = {
    calculateVolume,
    validateBoundingBox,
    checkManifold,
    getMeshStats
};

export default GeometryUtils;
