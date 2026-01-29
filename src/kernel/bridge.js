/**
 * Ameri-CAD Kernel Bridge
 * Main thread interface to the OpenCASCADE Web Worker
 *
 * Supports zero-copy mesh transfer via SharedArrayBuffer when cross-origin
 * isolation is enabled (COOP/COEP headers required).
 */

// SharedArrayBuffer configuration
// Conservative defaults - expandable for complex models
const SAB_CONFIG = {
  MAX_VERTICES: 2_000_000, // 2M vertices (covers most CAD models)
  MAX_INDICES: 6_000_000, // 6M indices (triangles * 3)
  VERTEX_STRIDE: 3, // x, y, z
  NORMAL_STRIDE: 3, // nx, ny, nz
};

export class KernelBridge {
  constructor() {
    this.worker = null;
    this.pending = new Map();
    this.nextId = 1;
    this.initialized = false;
    this.initPromise = null;

    // SharedArrayBuffer support
    this.useSAB = false;
    this.sharedBuffers = null;
    this.sharedViews = null;

    // Event listeners
    this.onProgress = null;
    this.onError = null;
  }

  /**
   * Check if SharedArrayBuffer is available (requires COOP/COEP headers)
   */
  static checkSABSupport() {
    try {
      // Check if SAB is available and functional
      if (typeof SharedArrayBuffer === 'undefined') return false;

      // Test actual creation (some browsers block this)
      const test = new SharedArrayBuffer(8);
      return test.byteLength === 8;
    } catch {
      return false;
    }
  }

  /**
   * Initialize shared buffers for zero-copy mesh transfer
   */
  _initSharedBuffers() {
    if (!KernelBridge.checkSABSupport()) {
      console.warn('[KernelBridge] SharedArrayBuffer not available - using postMessage fallback');
      return false;
    }

    try {
      const vertexBytes = SAB_CONFIG.MAX_VERTICES * SAB_CONFIG.VERTEX_STRIDE * 4; // Float32
      const normalBytes = SAB_CONFIG.MAX_VERTICES * SAB_CONFIG.NORMAL_STRIDE * 4; // Float32
      const indexBytes = SAB_CONFIG.MAX_INDICES * 4; // Uint32
      const metaBytes = 64; // Metadata: counts, status, etc.

      this.sharedBuffers = {
        vertices: new SharedArrayBuffer(vertexBytes),
        normals: new SharedArrayBuffer(normalBytes),
        indices: new SharedArrayBuffer(indexBytes),
        meta: new SharedArrayBuffer(metaBytes),
      };

      // Create typed array views for main thread reading
      this.sharedViews = {
        vertices: new Float32Array(this.sharedBuffers.vertices),
        normals: new Float32Array(this.sharedBuffers.normals),
        indices: new Uint32Array(this.sharedBuffers.indices),
        meta: new Int32Array(this.sharedBuffers.meta),
        // meta layout: [0]=vertexCount, [1]=indexCount, [2]=ready flag, [3]=error
      };

      console.log('[KernelBridge] SharedArrayBuffer initialized:', {
        vertexCapacity: SAB_CONFIG.MAX_VERTICES,
        indexCapacity: SAB_CONFIG.MAX_INDICES,
        totalBytes: (vertexBytes + normalBytes + indexBytes + metaBytes) / 1024 / 1024 + 'MB',
      });

      return true;
    } catch (e) {
      console.error('[KernelBridge] Failed to create SharedArrayBuffers:', e);
      return false;
    }
  }

  /**
   * Initialize the kernel worker
   */
  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      try {
        // Create worker with ES module support
        this.worker = new Worker('./src/kernel/worker.js', { type: 'module' });

        // Handle messages from worker
        this.worker.onmessage = e => {
          const { id, success, result, error, meshReady } = e.data;

          // Handle SharedArrayBuffer mesh-ready signal
          if (meshReady && this.useSAB) {
            const handler = this.pending.get(id);
            if (handler) {
              this.pending.delete(id);
              // Read mesh from shared buffers
              const mesh = this._readMeshFromSAB(result.vertexCount, result.indexCount);
              mesh.faceIds = result.faceIds; // Preserve topology info
              handler.resolve({ ...result, mesh });
            }
            return;
          }

          const handler = this.pending.get(id);
          if (handler) {
            this.pending.delete(id);
            if (success) {
              handler.resolve(result);
            } else {
              handler.reject(new Error(error));
            }
          }
        };

        this.worker.onerror = e => {
          console.error('[KernelBridge] Worker error:', e);
          if (this.onError) this.onError(e);
        };

        // Try to initialize SharedArrayBuffer
        this.useSAB = this._initSharedBuffers();

        // Initialize OCCT first
        this._call('init')
          .then(async () => {
            // If SAB is available, initialize worker with shared buffers
            if (this.useSAB) {
              await this._call('initSharedBuffers', {
                buffers: this.sharedBuffers,
              });
              console.log(
                '[KernelBridge] SharedArrayBuffer mode active - zero-copy mesh transfer enabled'
              );
            }

            this.initialized = true;
            console.log('[KernelBridge] Kernel initialized');
            resolve(true);
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });

    return this.initPromise;
  }

  /**
   * Read mesh data from SharedArrayBuffers
   * Creates sliced copies for Three.js (SAB views can't be used directly)
   */
  _readMeshFromSAB(vertexCount, indexCount) {
    const views = this.sharedViews;

    // Create copies for Three.js (BufferAttribute needs owned arrays)
    const vertices = new Float32Array(views.vertices.buffer, 0, vertexCount * 3).slice();
    const normals = new Float32Array(views.normals.buffer, 0, vertexCount * 3).slice();
    const indices = new Uint32Array(views.indices.buffer, 0, indexCount).slice();

    return { vertices, normals, indices };
  }

  /**
   * Internal call to worker
   */
  _call(action, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });

      this.worker.postMessage({ id, action, params });
    });
  }

  /**
   * Check if kernel is ready
   */
  isReady() {
    return this.initialized;
  }

  // ==================== Primitive Creation ====================

  /**
   * Create a box primitive
   * @returns {Promise<{id: string, mesh: Object, params: Object}>}
   */
  async createBox(width, height, depth, center = { x: 0, y: 0, z: 0 }) {
    await this.init();
    return this._call('createBox', { width, height, depth, center });
  }

  /**
   * Create a cylinder primitive
   * @returns {Promise<{id: string, mesh: Object, params: Object}>}
   */
  async createCylinder(radius, height, center = { x: 0, y: 0, z: 0 }) {
    await this.init();
    return this._call('createCylinder', { radius, height, center });
  }

  /**
   * Create a sphere primitive
   * @returns {Promise<{id: string, mesh: Object, params: Object}>}
   */
  async createSphere(radius, center = { x: 0, y: 0, z: 0 }) {
    await this.init();
    return this._call('createSphere', { radius, center });
  }

  /**
   * Create a cone primitive
   * @returns {Promise<{id: string, mesh: Object, params: Object}>}
   */
  async createCone(radius1, radius2, height, center = { x: 0, y: 0, z: 0 }) {
    await this.init();
    return this._call('createCone', { radius1, radius2, height, center });
  }

  // ==================== Boolean Operations ====================

  /**
   * Unified boolean operation dispatcher
   * @param {string} targetId - Target shape ID
   * @param {string} toolId - Tool shape ID
   * @param {string} type - Operation type: 'union', 'subtract', 'intersect'
   * @returns {Promise<{id: string, mesh: Object}>}
   */
  async boolean(targetId, toolId, type) {
    await this.init();
    switch (type) {
      case 'union':
      case 'add':
      case 'fuse':
        return this._call('booleanUnion', { id1: targetId, id2: toolId });
      case 'subtract':
      case 'cut':
      case 'difference':
        return this._call('booleanSubtract', { id1: targetId, id2: toolId });
      case 'intersect':
      case 'common':
        return this._call('booleanIntersect', { id1: targetId, id2: toolId });
      default:
        throw new Error(`Unknown boolean type: ${type}`);
    }
  }

  /**
   * Union two shapes
   * @returns {Promise<{id: string, mesh: Object}>}
   */
  async union(id1, id2) {
    await this.init();
    return this._call('booleanUnion', { id1, id2 });
  }

  /**
   * Subtract shape2 from shape1
   * @returns {Promise<{id: string, mesh: Object}>}
   */
  async subtract(id1, id2) {
    await this.init();
    return this._call('booleanSubtract', { id1, id2 });
  }

  /**
   * Intersect two shapes
   * @returns {Promise<{id: string, mesh: Object}>}
   */
  async intersect(id1, id2) {
    await this.init();
    return this._call('booleanIntersect', { id1, id2 });
  }

  // ==================== Modifications ====================

  /**
   * Apply fillet to edges
   * @param {string} shapeId - Shape ID
   * @param {string[]} edgeIds - Array of edge IDs to fillet
   * @param {number} radius - Fillet radius
   * @returns {Promise<{id: string, mesh: Object}>}
   */
  async fillet(shapeId, edgeIds, radius) {
    await this.init();
    return this._call('fillet', { shapeId, edgeIds, radius });
  }

  /**
   * Apply chamfer to edges
   * @param {string} shapeId - Shape ID
   * @param {string[]} edgeIds - Array of edge IDs to chamfer
   * @param {number} distance - Chamfer distance
   * @returns {Promise<{id: string, mesh: Object}>}
   */
  async chamfer(shapeId, edgeIds, distance) {
    await this.init();
    return this._call('chamfer', { shapeId, edgeIds, distance });
  }

  /**
   * Apply fillet to ALL edges of a shape
   * @param {string} shapeId - Shape ID
   * @param {number} radius - Fillet radius
   * @returns {Promise<{id: string, mesh: Object, edgeCount: number}>}
   */
  async filletAll(shapeId, radius) {
    await this.init();
    return this._call('filletAll', { shapeId, radius });
  }

  /**
   * Apply chamfer to ALL edges of a shape
   * @param {string} shapeId - Shape ID
   * @param {number} distance - Chamfer distance
   * @returns {Promise<{id: string, mesh: Object, edgeCount: number}>}
   */
  async chamferAll(shapeId, distance) {
    await this.init();
    return this._call('chamferAll', { shapeId, distance });
  }

  /**
   * Get all edge IDs for a shape
   * @param {string} shapeId - Shape ID
   * @returns {Promise<{edgeIds: string[]}>}
   */
  async getEdges(shapeId) {
    await this.init();
    return this._call('getEdges', { shapeId });
  }

  /**
   * Get all face IDs for a shape
   * @param {string} shapeId - Shape ID
   * @returns {Promise<{faceIds: string[]}>}
   */
  async getFaces(shapeId) {
    await this.init();
    return this._call('getFaces', { shapeId });
  }

  /**
   * Apply draft angle to faces for manufacturing (injection molding, casting)
   * Draft tilts faces by an angle relative to a pull direction, making parts
   * easier to eject from molds.
   *
   * @param {string} shapeId - Shape ID
   * @param {number} angleDegrees - Draft angle in degrees (typically 1-5°)
   * @param {string|[number,number,number]} direction - Pull direction: 'x', 'y', 'z', '-x', '-y', '-z', or [dx,dy,dz] vector
   * @param {string[]|null} faceIds - Specific face IDs to draft, or null for auto-selection (vertical walls)
   * @param {{x,y,z}|null} neutralPlanePoint - Point on neutral plane (default: origin)
   * @returns {Promise<{id: string, mesh: Object, facesModified: number}>}
   */
  async draft(shapeId, angleDegrees, direction = 'z', faceIds = null, neutralPlanePoint = null) {
    await this.init();

    // Parse direction
    let dirVec;
    if (typeof direction === 'string') {
      switch (direction.toLowerCase()) {
        case 'x':
          dirVec = { x: 1, y: 0, z: 0 };
          break;
        case 'y':
          dirVec = { x: 0, y: 1, z: 0 };
          break;
        case 'z':
          dirVec = { x: 0, y: 0, z: 1 };
          break;
        case '-x':
          dirVec = { x: -1, y: 0, z: 0 };
          break;
        case '-y':
          dirVec = { x: 0, y: -1, z: 0 };
          break;
        case '-z':
          dirVec = { x: 0, y: 0, z: -1 };
          break;
        default:
          // Try parsing as "x,y,z" vector string
          const parts = direction.split(',').map(p => parseFloat(p.trim()));
          if (parts.length === 3 && parts.every(p => !isNaN(p))) {
            dirVec = { x: parts[0], y: parts[1], z: parts[2] };
          } else {
            throw new Error(
              `Invalid direction: ${direction}. Use 'x', 'y', 'z', '-x', '-y', '-z', or 'x,y,z' vector`
            );
          }
      }
    } else if (Array.isArray(direction) && direction.length === 3) {
      dirVec = { x: direction[0], y: direction[1], z: direction[2] };
    } else if (typeof direction === 'object' && 'x' in direction) {
      dirVec = direction;
    } else {
      throw new Error('Direction must be a string axis name, [x,y,z] array, or {x,y,z} object');
    }

    return this._call('draft', {
      shapeId,
      angle: angleDegrees,
      direction: dirVec,
      faceIds: faceIds || [],
      neutralPlanePoint: neutralPlanePoint || { x: 0, y: 0, z: 0 },
    });
  }

  /**
   * Extrude a profile along a direction
   * @param {string} profileId - Profile (face/wire) ID
   * @param {{x,y,z}} direction - Extrusion direction vector
   * @param {number} distance - Extrusion distance
   * @returns {Promise<{id: string, mesh: Object}>}
   */
  async extrude(profileId, direction, distance) {
    await this.init();
    return this._call('extrude', { profileId, direction, distance });
  }

  /**
   * Extrude a sketch profile directly (from sketch geometry data)
   * @param {Object} profile - Profile data with type, dimensions, center
   * @param {number} height - Extrusion height
   * @param {string} plane - Sketch plane ('xy', 'xz', 'yz')
   * @returns {Promise<{id: string, mesh: Object}>}
   */
  async extrudeSketchProfile(profile, height, plane = 'xy') {
    await this.init();
    return this._call('extrudeSketchProfile', { profile, height, plane });
  }

  /**
   * Create a wire from polygon points
   * @param {Array<{x,y,z}>} points - 3D points
   * @returns {Promise<{id: string}>}
   */
  async createWireFromPolygon(points) {
    await this.init();
    return this._call('createWireFromPolygon', { points });
  }

  /**
   * Create a circular wire
   * @param {{x,y,z}} center - Center point
   * @param {number} radius - Circle radius
   * @param {{x,y,z}} normal - Plane normal
   * @returns {Promise<{id: string}>}
   */
  async createCircleWire(center, radius, normal = { x: 0, y: 0, z: 1 }) {
    await this.init();
    return this._call('createCircleWire', { center, radius, normal });
  }

  /**
   * Create a line wire (straight path)
   * @param {{x,y,z}} start - Start point
   * @param {{x,y,z}} end - End point
   * @returns {Promise<{id: string}>}
   */
  async createLineWire(start, end) {
    await this.init();
    return this._call('createLineWire', { start, end });
  }

  /**
   * Create an arc wire (three-point arc path)
   * @param {{x,y,z}} start - Start point
   * @param {{x,y,z}} mid - Middle point on arc
   * @param {{x,y,z}} end - End point
   * @returns {Promise<{id: string}>}
   */
  async createArcWire(start, mid, end) {
    await this.init();
    return this._call('createArcWire', { start, mid, end });
  }

  /**
   * Create a helix wire (spiral path)
   * @param {number} radius - Helix radius
   * @param {number} pitch - Distance between turns
   * @param {number} height - Total height
   * @param {{x,y,z}} center - Center point at base
   * @returns {Promise<{id: string}>}
   */
  async createHelixWire(radius, pitch, height, center = { x: 0, y: 0, z: 0 }) {
    await this.init();
    return this._call('createHelixWire', { radius, pitch, height, center });
  }

  /**
   * Create a B-spline wire from control points
   * @param {Array<{x,y,z}>} controlPoints - Array of 3D control points
   * @param {boolean} closed - Whether the spline is closed
   * @returns {Promise<{id: string}>}
   */
  async createBSplineWire(controlPoints, closed = false) {
    await this.init();
    return this._call('createBSplineWire', { controlPoints, closed });
  }

  /**
   * Create a face from a wire
   * @param {string} wireId - Wire ID
   * @param {boolean} planar - Whether to make planar face (default: true)
   * @returns {Promise<{id: string}>}
   */
  async createFaceFromWire(wireId, planar = true) {
    await this.init();
    return this._call('createFaceFromWire', { wireId, planar });
  }

  /**
   * Revolve a profile around an axis
   * @param {string} profileId - Profile (face/wire) ID
   * @param {{origin: {x,y,z}, direction: {x,y,z}}} axis - Revolution axis
   * @param {number} angle - Revolution angle in degrees
   * @returns {Promise<{id: string, mesh: Object}>}
   */
  async revolve(profileId, axis, angle) {
    await this.init();
    return this._call('revolve', { profileId, axis, angle });
  }

  /**
   * Revolve a sketch profile directly (from sketch geometry data)
   * @param {Object} profile - Profile data with type, dimensions, center
   * @param {{origin: {x,y,z}, direction: {x,y,z}}} axis - Revolution axis
   * @param {number} angle - Revolution angle in degrees (default 360)
   * @param {string} plane - Sketch plane ('xy', 'xz', 'yz')
   * @returns {Promise<{id: string, mesh: Object}>}
   */
  async revolveSketchProfile(profile, axis, angle = 360, plane = 'xy') {
    await this.init();
    return this._call('revolveSketchProfile', { profile, axis, angle, plane });
  }

  /**
   * Shell a solid (hollow it out)
   * @param {string} shapeId - Solid shape ID
   * @param {string[]|null} faceIds - Explicit face IDs to remove (optional, overrides faceSelection)
   * @param {number} thickness - Wall thickness
   * @param {string} faceSelection - Face selection mode: 'none', 'largest', 'top', 'bottom', 'front', 'back', 'left', 'right'
   * @returns {Promise<{id: string, mesh: Object}>}
   */
  async shell(shapeId, faceIds, thickness, faceSelection = 'largest') {
    await this.init();
    return this._call('shell', { shapeId, faceIds, thickness, faceSelection });
  }

  /**
   * Get all face IDs and properties for a shape
   * @param {string} shapeId - Shape ID
   * @returns {Promise<{faceIds: string[], faces: Array<{id: string, area: number, centroid: Object, normal: Object}>}>}
   */
  async getFaces(shapeId) {
    await this.init();
    return this._call('getFaces', { shapeId });
  }

  /**
   * Loft between multiple profiles
   * @param {string[]} profileIds - Array of profile IDs
   * @param {boolean} solid - Create solid (vs surface)
   * @returns {Promise<{id: string, mesh: Object}>}
   */
  async loft(profileIds, solid = true) {
    await this.init();
    return this._call('loft', { profileIds, solid });
  }

  /**
   * Sweep a profile along a path
   * @param {string} profileId - Profile shape ID
   * @param {string} pathId - Path curve ID
   * @returns {Promise<{id: string, mesh: Object}>}
   */
  async sweep(profileId, pathId) {
    await this.init();
    return this._call('sweep', { profileId, pathId });
  }

  /**
   * Create a circular pattern of a shape around an axis
   * @param {string} shapeId - Shape ID to pattern
   * @param {number} count - Number of copies (including original)
   * @param {number} angleDegrees - Total angle to span in degrees (default: 360)
   * @param {[number, number, number]} axisOrigin - Center of rotation [x, y, z] (default: [0, 0, 0])
   * @param {[number, number, number]} axisDirection - Axis direction [dx, dy, dz] (default: [0, 0, 1] = Z-axis)
   * @returns {Promise<{id: string, mesh: Object, copies: number}>}
   */
  async circularPattern(
    shapeId,
    count,
    angleDegrees = 360,
    axisOrigin = [0, 0, 0],
    axisDirection = [0, 0, 1]
  ) {
    await this.init();
    const angleRadians = (angleDegrees * Math.PI) / 180;
    return this._call('circularPattern', {
      shapeId,
      count,
      angle: angleRadians,
      axisOrigin,
      axisDirection,
    });
  }

  /**
   * Mirror a shape across a plane
   * @param {string} shapeId - Shape ID to mirror
   * @param {string} plane - Mirror plane: 'xy', 'xz', or 'yz'
   * @returns {Promise<{id: string, mesh: Object}>}
   */
  async mirror(shapeId, plane) {
    await this.init();

    // Convert plane name to origin and normal
    // All planes pass through origin (0,0,0)
    const planeOrigin = [0, 0, 0];
    let planeNormal;

    switch (plane.toLowerCase()) {
      case 'xy':
        // XY plane has normal pointing in Z direction
        planeNormal = [0, 0, 1];
        break;
      case 'xz':
        // XZ plane has normal pointing in Y direction
        planeNormal = [0, 1, 0];
        break;
      case 'yz':
        // YZ plane has normal pointing in X direction
        planeNormal = [1, 0, 0];
        break;
      default:
        throw new Error(`Unknown mirror plane: ${plane}. Use 'xy', 'xz', or 'yz'`);
    }

    return this._call('mirrorShape', { shapeId, planeOrigin, planeNormal });
  }

  // ==================== Additional Primitives ====================

  /**
   * Create a torus primitive
   * @returns {Promise<{id: string, mesh: Object, params: Object}>}
   */
  async createTorus(majorRadius, minorRadius, center = { x: 0, y: 0, z: 0 }) {
    await this.init();
    return this._call('createTorus', { majorRadius, minorRadius, center });
  }

  /**
   * Create a wedge primitive
   * @returns {Promise<{id: string, mesh: Object, params: Object}>}
   */
  async createWedge(dx, dy, dz, ltx = 0, center = { x: 0, y: 0, z: 0 }) {
    await this.init();
    return this._call('createWedge', { dx, dy, dz, ltx, center });
  }

  // ==================== Patterns ====================

  /**
   * Create a linear pattern of copies along a direction
   * @param {string} shapeId - Shape ID to pattern
   * @param {number[]} direction - Direction vector [dx, dy, dz] (will be normalized)
   * @param {number} count - Number of copies (including original)
   * @param {number} spacing - Distance between copies
   * @returns {Promise<{id: string, mesh: Object, count: number, spacing: number, direction: number[]}>}
   */
  async linearPattern(shapeId, direction, count, spacing) {
    await this.init();
    return this._call('linearPattern', { shapeId, direction, count, spacing });
  }

  // ==================== Hole Wizard ====================

  /**
   * Create a simple hole (cylinder cut from solid)
   * @param {string} shapeId - Target shape ID
   * @param {{x,y,z}} position - Center of hole on surface
   * @param {{x,y,z}} direction - Direction into the material (normalized)
   * @param {number} diameter - Hole diameter
   * @param {number} depth - Hole depth (0 or negative for through-all)
   * @returns {Promise<{id: string, mesh: Object, type: string}>}
   */
  async createSimpleHole(shapeId, position, direction, diameter, depth = 0) {
    await this.init();
    return this._call('createSimpleHole', { shapeId, position, direction, diameter, depth });
  }

  /**
   * Create a counterbore hole
   * @param {string} shapeId - Target shape ID
   * @param {{x,y,z}} position - Center of hole on surface
   * @param {{x,y,z}} direction - Direction into the material (normalized)
   * @param {number} holeDiameter - Main hole diameter
   * @param {number} cbDiameter - Counterbore diameter
   * @param {number} cbDepth - Counterbore depth
   * @param {number} holeDepth - Total hole depth (0 for through-all)
   * @returns {Promise<{id: string, mesh: Object, type: string}>}
   */
  async createCounterboreHole(
    shapeId,
    position,
    direction,
    holeDiameter,
    cbDiameter,
    cbDepth,
    holeDepth = 0
  ) {
    await this.init();
    return this._call('createCounterboreHole', {
      shapeId,
      position,
      direction,
      holeDiameter,
      cbDiameter,
      cbDepth,
      holeDepth,
    });
  }

  /**
   * Create a countersink hole
   * @param {string} shapeId - Target shape ID
   * @param {{x,y,z}} position - Center of hole on surface
   * @param {{x,y,z}} direction - Direction into the material (normalized)
   * @param {number} holeDiameter - Main hole diameter
   * @param {number} csDiameter - Countersink top diameter
   * @param {number} csAngle - Countersink angle in degrees (82, 90, 100)
   * @param {number} holeDepth - Total hole depth (0 for through-all)
   * @returns {Promise<{id: string, mesh: Object, type: string}>}
   */
  async createCountersinkHole(
    shapeId,
    position,
    direction,
    holeDiameter,
    csDiameter,
    csAngle = 90,
    holeDepth = 0
  ) {
    await this.init();
    return this._call('createCountersinkHole', {
      shapeId,
      position,
      direction,
      holeDiameter,
      csDiameter,
      csAngle,
      holeDepth,
    });
  }

  /**
   * Create a tapped hole (visual representation)
   * Note: Creates a tap-drill sized hole; actual threads are visual only
   * @param {string} shapeId - Target shape ID
   * @param {{x,y,z}} position - Center of hole on surface
   * @param {{x,y,z}} direction - Direction into the material (normalized)
   * @param {number} nominalDiameter - Thread nominal diameter (e.g., 5 for M5)
   * @param {number} pitch - Thread pitch in mm
   * @param {number} depth - Hole depth
   * @returns {Promise<{id: string, mesh: Object, type: string, threadInfo: Object}>}
   */
  async createTappedHole(shapeId, position, direction, nominalDiameter, pitch, depth) {
    await this.init();
    return this._call('createTappedHole', {
      shapeId,
      position,
      direction,
      nominalDiameter,
      pitch,
      depth,
    });
  }

  /**
   * Create a hole tool shape (for preview or batch operations)
   * @param {string} holeType - 'simple', 'counterbore', 'countersink', 'tapped'
   * @param {Object} params - Hole parameters
   * @returns {Promise<{id: string, mesh: Object, type: string}>}
   */
  async createHoleTool(holeType, params) {
    await this.init();
    return this._call('createHoleTool', { holeType, ...params });
  }

  // ==================== Export ====================

  /**
   * Export shape to STEP format (ISO 10303-21, AP214)
   * @param {string} id - Shape ID to export
   * @returns {Promise<{content: string, format: string}>}
   */
  async exportSTEP(id) {
    await this.init();
    return this._call('exportSTEP', { id });
  }

  /**
   * Export multiple shapes to STEP format as a compound
   * @param {string[]} ids - Array of shape IDs to export
   * @returns {Promise<{content: string, format: string, count: number}>}
   */
  async exportSTEPMultiple(ids) {
    await this.init();
    return this._call('exportSTEPMultiple', { ids });
  }

  /**
   * Export all shapes in kernel memory to STEP format
   * @returns {Promise<{content: string, format: string, count: number}>}
   */
  async exportSTEPAll() {
    await this.init();
    return this._call('exportSTEPAll', {});
  }

  /**
   * Export shape to STL format
   * @param {string} id - Shape ID to export
   * @param {boolean} ascii - Whether to export ASCII format (default: true)
   * @returns {Promise<{content: string|Uint8Array, format: string, binary: boolean}>}
   */
  async exportSTL(id, ascii = true) {
    await this.init();
    return this._call('exportSTL', { id, ascii });
  }

  // ==================== Analysis ====================

  /**
   * Get volume of shape
   * @returns {Promise<{volume: number}>}
   */
  async getVolume(id) {
    await this.init();
    return this._call('getVolume', { id });
  }

  /**
   * Get bounding box of shape
   * @returns {Promise<{min: {x,y,z}, max: {x,y,z}}>}
   */
  async getBoundingBox(id) {
    await this.init();
    return this._call('getBoundingBox', { id });
  }

  /**
   * Get comprehensive mass properties of a shape
   * Calculates volume, surface area, center of gravity, moments of inertia, etc.
   * @param {string} shapeId - Shape ID to analyze
   * @param {number} density - Material density in g/cm³ (default: 1.0)
   * @returns {Promise<Object>} Mass properties object containing:
   *   - volume: Volume in mm³
   *   - volumeCm3: Volume in cm³
   *   - surfaceArea: Surface area in mm²
   *   - surfaceAreaCm2: Surface area in cm²
   *   - mass: Mass in grams (based on density)
   *   - density: Input density in g/cm³
   *   - centerOfGravity: {x, y, z} center of mass
   *   - momentsOfInertia: {Ixx, Iyy, Izz, Ixy, Ixz, Iyz} inertia tensor components
   *   - boundingBox: {min, max, dimensions}
   */
  async getMassProperties(shapeId, density = 1.0) {
    await this.init();
    return this._call('massProperties', { shapeId, density });
  }

  /**
   * Detect interference (overlap) between bodies
   * Checks all pairs of given shapes for volumetric intersection
   * @param {string[]} shapeIds - Array of shape IDs to check for interference
   * @returns {Promise<{interferences: Array<{body1: string, body2: string, volume: number, intersectionShapeId: string, mesh: Object}>}>}
   */
  async detectInterference(shapeIds) {
    await this.init();
    return this._call('detectInterference', { shapeIds });
  }

  // ==================== Management ====================

  /**
   * Delete a shape from kernel memory
   */
  async deleteShape(id) {
    await this.init();
    return this._call('deleteShape', { id });
  }

  /**
   * Terminate the worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.initialized = false;
      this.initPromise = null;
    }
  }
}

/**
 * Convert kernel mesh data to Three.js BufferGeometry
 */
export function meshToThreeGeometry(mesh, THREE) {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.vertices, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));

  // Compute normals if not provided properly
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  // Store face IDs for selection
  geometry.userData.faceIds = mesh.faceIds;

  return geometry;
}

/**
 * Download a string as a file
 */
export function downloadFile(content, filename, mimeType = 'application/octet-stream') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Global singleton instance
export const kernel = new KernelBridge();
