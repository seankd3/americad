/**
 * Ameri-CAD CAD SYSTEM - Transform Utilities
 * Raycasting, world position calculations, and transform helpers
 */

import * as THREE from 'three';

/**
 * Update mouse coordinates from event
 * @param {MouseEvent} event
 * @param {HTMLCanvasElement} canvas
 * @returns {THREE.Vector2}
 */
export function updateMouseCoords(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
}

/**
 * Get world position from mouse coordinates via raycasting
 * @param {THREE.Vector2} mouse Normalized device coordinates
 * @param {THREE.Camera} camera
 * @param {THREE.Raycaster} raycaster
 * @param {THREE.Object3D[]} objects Objects to check for intersection
 * @returns {THREE.Vector3 | null}
 */
export function getWorldPosition(mouse, camera, raycaster, objects) {
  raycaster.setFromCamera(mouse, camera);

  // Check object intersection first
  const intersects = raycaster.intersectObjects(objects, true);
  if (intersects.length > 0) {
    return intersects[0].point.clone();
  }

  // Fall back to ground plane intersection
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const target = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, target);

  return target;
}

/**
 * Perform raycast and find intersected objects
 * @param {THREE.Vector2} mouse Normalized device coordinates
 * @param {THREE.Camera} camera
 * @param {THREE.Raycaster} raycaster
 * @param {THREE.Object3D[]} objects Selectable objects
 * @returns {THREE.Object3D | null} Root mesh object or null
 */
export function performRaycast(mouse, camera, raycaster, objects) {
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(objects, true);

  if (intersects.length > 0) {
    // Find the root mesh (not edges or children)
    let obj = intersects[0].object;
    while (obj.parent && obj.parent.type !== 'Scene') {
      obj = obj.parent;
    }
    return obj;
  }

  return null;
}

/**
 * Copy transform from one object to another
 * @param {THREE.Object3D} source
 * @param {THREE.Object3D} target
 */
export function copyTransform(source, target) {
  target.position.copy(source.position);
  target.rotation.copy(source.rotation);
  target.scale.copy(source.scale);
}

/**
 * Serialize a Matrix4 to an array
 * @param {THREE.Matrix4} matrix
 * @returns {number[]}
 */
export function serializeMatrix4(matrix) {
  return matrix.toArray();
}

/**
 * Deserialize an array back to a Matrix4
 * @param {number[]} array
 * @returns {THREE.Matrix4}
 */
export function deserializeMatrix4(array) {
  const matrix = new THREE.Matrix4();
  matrix.fromArray(array);
  return matrix;
}

/**
 * Apply a Matrix4 to an object's transform
 * @param {THREE.Object3D} object
 * @param {THREE.Matrix4} matrix
 */
export function applyMatrix4ToObject(object, matrix) {
  object.matrix.copy(matrix);
  object.matrix.decompose(object.position, object.quaternion, object.scale);
}

/**
 * Get current transform as Matrix4
 * @param {THREE.Object3D} object
 * @returns {THREE.Matrix4}
 */
export function getObjectMatrix4(object) {
  object.updateMatrix();
  return object.matrix.clone();
}
