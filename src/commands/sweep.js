/**
 * Ameri-CAD Sweep Commands
 *
 * Commands for sweep operations and path creation.
 * Sweep extrudes a 2D profile along a path/spine curve.
 */

import { registerCommand } from '../core/commands.js';

/**
 * Register all sweep-related commands
 */
export function registerSweepCommands(kernel) {
  // PATH-LINE - Create a straight line path
  registerCommand('path-line', {
    aliases: ['pathline', 'linepath'],
    description: 'Create a straight line path for sweeping',
    category: 'sweep',
    params: [
      { name: 'x1', type: 'number', required: true, description: 'Start X' },
      { name: 'y1', type: 'number', required: true, description: 'Start Y' },
      { name: 'z1', type: 'number', required: true, description: 'Start Z' },
      { name: 'x2', type: 'number', required: true, description: 'End X' },
      { name: 'y2', type: 'number', required: true, description: 'End Y' },
      { name: 'z2', type: 'number', required: true, description: 'End Z' },
    ],
    async execute(params, context) {
      const start = { x: params.x1, y: params.y1, z: params.z1 };
      const end = { x: params.x2, y: params.y2, z: params.z2 };

      const result = await kernel.createLineWire(start, end);

      // Store as a path in document
      if (context.document) {
        context.document.trackExternalFeature({
          id: result.id,
          type: 'path-line',
          kernelId: result.id,
          name: `LinePath`,
          params: { start, end },
          isPath: true, // Mark as path for sweep selection
        });
      }

      // Store in context for subsequent sweep command
      if (context.setLastPath) {
        context.setLastPath(result.id);
      }

      return { id: result.id, type: 'path-line', start, end };
    },
  });

  // PATH-ARC - Create an arc path (three-point)
  registerCommand('path-arc', {
    aliases: ['patharc', 'arcpath'],
    description: 'Create a three-point arc path for sweeping',
    category: 'sweep',
    params: [
      { name: 'x1', type: 'number', required: true, description: 'Start X' },
      { name: 'y1', type: 'number', required: true, description: 'Start Y' },
      { name: 'z1', type: 'number', required: true, description: 'Start Z' },
      { name: 'x2', type: 'number', required: true, description: 'Middle X' },
      { name: 'y2', type: 'number', required: true, description: 'Middle Y' },
      { name: 'z2', type: 'number', required: true, description: 'Middle Z' },
      { name: 'x3', type: 'number', required: true, description: 'End X' },
      { name: 'y3', type: 'number', required: true, description: 'End Y' },
      { name: 'z3', type: 'number', required: true, description: 'End Z' },
    ],
    async execute(params, context) {
      const start = { x: params.x1, y: params.y1, z: params.z1 };
      const mid = { x: params.x2, y: params.y2, z: params.z2 };
      const end = { x: params.x3, y: params.y3, z: params.z3 };

      const result = await kernel.createArcWire(start, mid, end);

      if (context.document) {
        context.document.trackExternalFeature({
          id: result.id,
          type: 'path-arc',
          kernelId: result.id,
          name: `ArcPath`,
          params: { start, mid, end },
          isPath: true,
        });
      }

      if (context.setLastPath) {
        context.setLastPath(result.id);
      }

      return { id: result.id, type: 'path-arc', start, mid, end };
    },
  });

  // PATH-HELIX - Create a helical path
  registerCommand('path-helix', {
    aliases: ['pathhelix', 'helix'],
    description: 'Create a helical (spiral) path for sweeping',
    category: 'sweep',
    params: [
      { name: 'radius', type: 'number', required: true, description: 'Helix radius' },
      { name: 'pitch', type: 'number', required: true, description: 'Distance between turns' },
      { name: 'height', type: 'number', required: true, description: 'Total height' },
      { name: 'cx', type: 'number', required: false, default: 0, description: 'Center X' },
      { name: 'cy', type: 'number', required: false, default: 0, description: 'Center Y' },
      { name: 'cz', type: 'number', required: false, default: 0, description: 'Center Z' },
    ],
    validate(params) {
      if (params.radius <= 0) return 'Radius must be positive';
      if (params.pitch <= 0) return 'Pitch must be positive';
      if (params.height <= 0) return 'Height must be positive';
      return true;
    },
    async execute(params, context) {
      const center = { x: params.cx, y: params.cy, z: params.cz };

      const result = await kernel.createHelixWire(
        params.radius,
        params.pitch,
        params.height,
        center
      );

      if (context.document) {
        context.document.trackExternalFeature({
          id: result.id,
          type: 'path-helix',
          kernelId: result.id,
          name: `HelixPath`,
          params: { radius: params.radius, pitch: params.pitch, height: params.height, center },
          isPath: true,
        });
      }

      if (context.setLastPath) {
        context.setLastPath(result.id);
      }

      return { id: result.id, type: 'path-helix', params };
    },
  });

  // PROFILE-CIRCLE - Create a circular profile (face) for sweeping
  registerCommand('profile-circle', {
    aliases: ['profilecircle', 'circleprofile'],
    description: 'Create a circular profile for sweeping',
    category: 'sweep',
    params: [
      { name: 'radius', type: 'number', required: true, description: 'Circle radius' },
      { name: 'x', type: 'number', required: false, default: 0, description: 'Center X' },
      { name: 'y', type: 'number', required: false, default: 0, description: 'Center Y' },
      { name: 'z', type: 'number', required: false, default: 0, description: 'Center Z' },
      { name: 'nx', type: 'number', required: false, default: 0, description: 'Normal X' },
      { name: 'ny', type: 'number', required: false, default: 0, description: 'Normal Y' },
      { name: 'nz', type: 'number', required: false, default: 1, description: 'Normal Z' },
    ],
    validate(params) {
      if (params.radius <= 0) return 'Radius must be positive';
      return true;
    },
    async execute(params, context) {
      const center = { x: params.x, y: params.y, z: params.z };
      const normal = { x: params.nx, y: params.ny, z: params.nz };

      // Create circle wire
      const wireResult = await kernel.createCircleWire(center, params.radius, normal);

      // Create face from wire
      const faceResult = await kernel.createFaceFromWire(wireResult.id, true);

      if (context.document) {
        context.document.trackExternalFeature({
          id: faceResult.id,
          type: 'profile-circle',
          kernelId: faceResult.id,
          name: `CircleProfile`,
          params: { radius: params.radius, center, normal },
          isProfile: true,
        });
      }

      if (context.setLastProfile) {
        context.setLastProfile(faceResult.id);
      }

      return { id: faceResult.id, type: 'profile-circle', radius: params.radius, center };
    },
  });

  // PROFILE-RECT - Create a rectangular profile for sweeping
  registerCommand('profile-rect', {
    aliases: ['profilerect', 'rectprofile'],
    description: 'Create a rectangular profile for sweeping',
    category: 'sweep',
    params: [
      { name: 'width', type: 'number', required: true, description: 'Width' },
      { name: 'height', type: 'number', required: true, description: 'Height' },
      { name: 'x', type: 'number', required: false, default: 0, description: 'Center X' },
      { name: 'y', type: 'number', required: false, default: 0, description: 'Center Y' },
      { name: 'z', type: 'number', required: false, default: 0, description: 'Center Z' },
      {
        name: 'plane',
        type: 'string',
        required: false,
        default: 'xy',
        description: 'Plane (xy, xz, yz)',
      },
    ],
    validate(params) {
      if (params.width <= 0) return 'Width must be positive';
      if (params.height <= 0) return 'Height must be positive';
      return true;
    },
    async execute(params, context) {
      const center = { x: params.x, y: params.y, z: params.z };
      const hw = params.width / 2;
      const hh = params.height / 2;

      // Create rectangle points based on plane
      let points;
      switch (params.plane) {
        case 'xz':
          points = [
            { x: center.x - hw, y: center.y, z: center.z - hh },
            { x: center.x + hw, y: center.y, z: center.z - hh },
            { x: center.x + hw, y: center.y, z: center.z + hh },
            { x: center.x - hw, y: center.y, z: center.z + hh },
          ];
          break;
        case 'yz':
          points = [
            { x: center.x, y: center.y - hw, z: center.z - hh },
            { x: center.x, y: center.y + hw, z: center.z - hh },
            { x: center.x, y: center.y + hw, z: center.z + hh },
            { x: center.x, y: center.y - hw, z: center.z + hh },
          ];
          break;
        case 'xy':
        default:
          points = [
            { x: center.x - hw, y: center.y - hh, z: center.z },
            { x: center.x + hw, y: center.y - hh, z: center.z },
            { x: center.x + hw, y: center.y + hh, z: center.z },
            { x: center.x - hw, y: center.y + hh, z: center.z },
          ];
          break;
      }

      // Create wire from polygon
      const wireResult = await kernel.createWireFromPolygon(points);

      // Create face from wire
      const faceResult = await kernel.createFaceFromWire(wireResult.id, true);

      if (context.document) {
        context.document.trackExternalFeature({
          id: faceResult.id,
          type: 'profile-rect',
          kernelId: faceResult.id,
          name: `RectProfile`,
          params: { width: params.width, height: params.height, center, plane: params.plane },
          isProfile: true,
        });
      }

      if (context.setLastProfile) {
        context.setLastProfile(faceResult.id);
      }

      return {
        id: faceResult.id,
        type: 'profile-rect',
        width: params.width,
        height: params.height,
        center,
      };
    },
  });

  // SWEEP - Sweep a profile along a path
  registerCommand('sweep', {
    aliases: ['sw', 'pipe'],
    description: 'Sweep a profile along a path to create a 3D solid',
    category: 'sweep',
    params: [
      {
        name: 'profileId',
        type: 'string',
        required: false,
        description: 'Profile shape ID (uses last profile if omitted)',
      },
      {
        name: 'pathId',
        type: 'string',
        required: false,
        description: 'Path wire ID (uses last path if omitted)',
      },
    ],
    async execute(params, context) {
      // Get profile ID - from params, last profile, or selection
      let profileId = params.profileId;
      if (!profileId && context.getLastProfile) {
        profileId = context.getLastProfile();
      }
      if (!profileId && context.selection?.profile) {
        profileId = context.selection.profile;
      }

      // Get path ID - from params, last path, or selection
      let pathId = params.pathId;
      if (!pathId && context.getLastPath) {
        pathId = context.getLastPath();
      }
      if (!pathId && context.selection?.path) {
        pathId = context.selection.path;
      }

      if (!profileId) {
        throw new Error(
          'No profile specified. Create a profile first with profile-circle or profile-rect'
        );
      }
      if (!pathId) {
        throw new Error(
          'No path specified. Create a path first with path-line, path-arc, or path-helix'
        );
      }

      // Execute sweep
      const result = await kernel.sweep(profileId, pathId);

      if (context.document) {
        context.document.addBody(result.id, {
          type: 'sweep',
          params: { profileId, pathId },
          mesh: result.mesh,
        });
      }

      return result;
    },
  });

  // PIPE - Convenience command: create circular profile and sweep along path
  registerCommand('pipe', {
    aliases: ['tube'],
    description: 'Create a pipe/tube by sweeping a circle along a path',
    category: 'sweep',
    params: [
      { name: 'radius', type: 'number', required: true, description: 'Pipe radius' },
      {
        name: 'pathId',
        type: 'string',
        required: false,
        description: 'Path ID (uses last path if omitted)',
      },
    ],
    validate(params) {
      if (params.radius <= 0) return 'Radius must be positive';
      return true;
    },
    async execute(params, context) {
      // Get path ID
      let pathId = params.pathId;
      if (!pathId && context.getLastPath) {
        pathId = context.getLastPath();
      }

      if (!pathId) {
        throw new Error(
          'No path specified. Create a path first with path-line, path-arc, or path-helix'
        );
      }

      // Create circular profile at origin (will be positioned at path start by sweep)
      const wireResult = await kernel.createCircleWire({ x: 0, y: 0, z: 0 }, params.radius, {
        x: 0,
        y: 0,
        z: 1,
      });
      const faceResult = await kernel.createFaceFromWire(wireResult.id, true);

      // Execute sweep
      const result = await kernel.sweep(faceResult.id, pathId);

      if (context.document) {
        context.document.addBody(result.id, {
          type: 'pipe',
          params: { radius: params.radius, pathId },
          mesh: result.mesh,
        });
      }

      return result;
    },
  });
}

export default { registerSweepCommands };
