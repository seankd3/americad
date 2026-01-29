/**
 * Ameri-CAD CAD SYSTEM - Math Utilities
 * Pure functions for vector/matrix operations
 */

import * as THREE from 'three';

/**
 * Generate a unique ID string
 * @returns {string} Uppercase alphanumeric ID
 */
export function generateId() {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
}

/**
 * Clamp a value between min and max
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between two values
 * @param {number} a Start value
 * @param {number} b End value
 * @param {number} t Interpolation factor (0-1)
 * @returns {number}
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Convert degrees to radians
 * @param {number} degrees 
 * @returns {number}
 */
export function degToRad(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 * @param {number} radians 
 * @returns {number}
 */
export function radToDeg(radians) {
    return radians * (180 / Math.PI);
}

/**
 * Compute bounding box for an array of objects
 * @param {THREE.Object3D[]} objects 
 * @returns {{ box: THREE.Box3, center: THREE.Vector3, size: THREE.Vector3 }}
 */
export function computeBoundingBox(objects) {
    const box = new THREE.Box3();
    
    if (objects.length === 0) {
        return { box, center: new THREE.Vector3(), size: new THREE.Vector3() };
    }
    
    // Iterate over objects and expand the bounding box
    for (const object of objects) {
        box.expandByObject(object);
    }
    
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    return { box, center, size };
}

/**
 * Calculate camera distance to fit bounding box in view
 * @param {number} maxDim Maximum dimension of the bounding box
 * @param {number} fovDegrees Camera field of view in degrees
 * @param {number} padding Multiplier for extra padding (default 1.5)
 * @returns {number}
 */
export function calculateFitDistance(maxDim, fovDegrees, padding = 1.5) {
    const fovRadians = degToRad(fovDegrees);
    return (maxDim / 2) / Math.tan(fovRadians / 2) * padding;
}

/**
 * Calculate triangle normal from three vertices
 * @param {THREE.Vector3} v1 
 * @param {THREE.Vector3} v2 
 * @param {THREE.Vector3} v3 
 * @returns {THREE.Vector3}
 */
export function calculateTriangleNormal(v1, v2, v3) {
    return new THREE.Vector3()
        .subVectors(v2, v1)
        .cross(new THREE.Vector3().subVectors(v3, v1))
        .normalize();
}

/**
 * Snap a value to a grid
 * @param {number} value 
 * @param {number} gridSize 
 * @returns {number}
 */
export function snapToGrid(value, gridSize) {
    return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap a Vector3 to a grid
 * @param {THREE.Vector3} vector 
 * @param {number} gridSize 
 * @returns {THREE.Vector3}
 */
export function snapVector3ToGrid(vector, gridSize) {
    return new THREE.Vector3(
        snapToGrid(vector.x, gridSize),
        snapToGrid(vector.y, gridSize),
        snapToGrid(vector.z, gridSize)
    );
}
