/**
 * Ameri-CAD Profile Detector
 *
 * Fusion 360-style profile detection for sketch-to-extrude workflow.
 * Detects closed regions in sketches, including nested profiles (holes).
 */

/**
 * Generate a unique profile ID
 */
let profileCounter = 0;
function generateProfileId() {
  return `profile_${++profileCounter}`;
}

/**
 * Tolerance for geometric comparisons
 */
const TOLERANCE = 0.001;

/**
 * Check if two points are coincident within tolerance
 */
function pointsEqual(p1, p2, tolerance = TOLERANCE) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy) < tolerance;
}

/**
 * Build a graph of edges from sketch entities
 * @param {Array} edges - Array of line/arc entities
 * @returns {Map} - Adjacency graph: pointKey -> [{edge, startPoint, endPoint}]
 */
function buildEdgeGraph(edges) {
  const graph = new Map();

  const pointKey = p => `${p.x.toFixed(6)},${p.y.toFixed(6)}`;

  for (const edge of edges) {
    const start = getEdgeStart(edge);
    const end = getEdgeEnd(edge);
    const startKey = pointKey(start);
    const endKey = pointKey(end);

    // Add edge to start point adjacency
    if (!graph.has(startKey)) graph.set(startKey, []);
    graph.get(startKey).push({
      edge,
      thisPoint: start,
      otherPoint: end,
      otherKey: endKey,
    });

    // Add edge to end point adjacency
    if (!graph.has(endKey)) graph.set(endKey, []);
    graph.get(endKey).push({
      edge,
      thisPoint: end,
      otherPoint: start,
      otherKey: startKey,
    });
  }

  return graph;
}

/**
 * Get the start point of an edge (line or arc)
 */
function getEdgeStart(edge) {
  if (edge.start) return { x: edge.start.x, y: edge.start.y };
  if (edge.startPoint) return { x: edge.startPoint.x, y: edge.startPoint.y };
  return null;
}

/**
 * Get the end point of an edge (line or arc)
 */
function getEdgeEnd(edge) {
  if (edge.end) return { x: edge.end.x, y: edge.end.y };
  if (edge.endPoint) return { x: edge.endPoint.x, y: edge.endPoint.y };
  return null;
}

/**
 * Find all closed cycles in the edge graph using DFS
 * @param {Map} graph - Edge adjacency graph
 * @returns {Array} - Array of cycles, each cycle is array of edges
 */
function findAllCycles(graph) {
  const cycles = [];
  const globalVisitedEdges = new Set();

  // Try starting from each point
  for (const [startKey] of graph) {
    const neighbors = graph.get(startKey);
    if (!neighbors || neighbors.length === 0) continue;

    // Try each edge from this starting point
    for (const startNeighbor of neighbors) {
      if (globalVisitedEdges.has(startNeighbor.edge.id)) continue;

      const cycle = traceClosedLoop(graph, startKey, startNeighbor, globalVisitedEdges);
      if (cycle && cycle.length >= 3) {
        cycles.push(cycle);
        // Mark edges as used
        cycle.forEach(e => globalVisitedEdges.add(e.id));
      }
    }
  }

  return cycles;
}

/**
 * Trace a closed loop starting from a given edge
 * @param {Map} graph - Edge adjacency graph
 * @param {string} startKey - Starting point key
 * @param {Object} firstEdgeInfo - First edge info
 * @param {Set} globalVisited - Set of already used edge IDs
 * @returns {Array|null} - Array of edges forming a closed loop, or null
 */
function traceClosedLoop(graph, startKey, firstEdgeInfo, globalVisited, maxDepth = 100) {
  const path = [firstEdgeInfo.edge];
  const visitedInPath = new Set([firstEdgeInfo.edge.id]);
  let currentKey = firstEdgeInfo.otherKey;

  for (let depth = 0; depth < maxDepth; depth++) {
    // Check if we've returned to start
    if (currentKey === startKey && path.length >= 3) {
      return path;
    }

    // Find next unvisited edge
    const neighbors = graph.get(currentKey);
    if (!neighbors) return null;

    let nextEdgeInfo = null;
    for (const neighbor of neighbors) {
      if (visitedInPath.has(neighbor.edge.id)) continue;
      if (globalVisited.has(neighbor.edge.id)) continue;

      nextEdgeInfo = neighbor;
      break;
    }

    if (!nextEdgeInfo) return null;

    path.push(nextEdgeInfo.edge);
    visitedInPath.add(nextEdgeInfo.edge.id);
    currentKey = nextEdgeInfo.otherKey;
  }

  return null;
}

/**
 * Calculate the signed area of a polygon using the shoelace formula
 * Positive = counter-clockwise, Negative = clockwise
 * @param {Array} points - Array of {x, y} points
 * @returns {number} - Signed area
 */
function calculateSignedArea(points) {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2;
}

/**
 * Calculate area (absolute value)
 */
function calculateArea(points) {
  return Math.abs(calculateSignedArea(points));
}

/**
 * Calculate centroid of a polygon
 * @param {Array} points - Array of {x, y} points
 * @returns {{x, y}} - Centroid point
 */
function calculateCentroid(points) {
  const n = points.length;
  let cx = 0;
  let cy = 0;
  let signedArea = 0;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = points[i].x * points[j].y - points[j].x * points[i].y;
    signedArea += a;
    cx += (points[i].x + points[j].x) * a;
    cy += (points[i].y + points[j].y) * a;
  }

  signedArea *= 0.5;
  const factor = 1 / (6 * signedArea);

  return {
    x: cx * factor,
    y: cy * factor,
  };
}

/**
 * Get ordered points from a cycle of edges
 * @param {Array} edges - Array of edge entities
 * @returns {Array} - Ordered array of {x, y} points
 */
function getPointsFromCycle(edges) {
  if (edges.length === 0) return [];

  const points = [];
  let currentEnd = getEdgeStart(edges[0]);
  points.push({ x: currentEnd.x, y: currentEnd.y });

  for (const edge of edges) {
    const start = getEdgeStart(edge);
    const end = getEdgeEnd(edge);

    // Figure out which end connects to current point
    if (pointsEqual(start, currentEnd)) {
      // Edge goes start -> end
      currentEnd = end;
    } else {
      // Edge goes end -> start
      currentEnd = start;
    }

    points.push({ x: currentEnd.x, y: currentEnd.y });
  }

  // Remove duplicate last point (same as first)
  if (points.length > 1 && pointsEqual(points[0], points[points.length - 1])) {
    points.pop();
  }

  return points;
}

/**
 * Check if a point is inside a polygon using ray casting
 * @param {Object} point - {x, y} point to test
 * @param {Array} polygon - Array of {x, y} points defining the polygon
 * @returns {boolean} - True if point is inside
 */
function pointInPolygon(point, polygon) {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;

    if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Check if profile A is inside profile B
 * Uses centroid test - if A's centroid is inside B's polygon
 * @param {Object} profileA - Profile to test (potential hole)
 * @param {Object} profileB - Profile to test against (potential outer)
 * @returns {boolean}
 */
function isProfileInside(profileA, profileB) {
  // A circle inside check
  if (profileA.type === 'circle' && profileB.type === 'circle') {
    const dist = Math.sqrt(
      Math.pow(profileA.center.x - profileB.center.x, 2) +
        Math.pow(profileA.center.y - profileB.center.y, 2)
    );
    return dist + profileA.radius < profileB.radius;
  }

  // Get centroid of A
  const centroidA = profileA.centroid || profileA.center;

  // Get polygon points for B
  let polygonB;
  if (profileB.type === 'circle') {
    // Approximate circle as polygon
    polygonB = [];
    const segments = 32;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      polygonB.push({
        x: profileB.center.x + profileB.radius * Math.cos(angle),
        y: profileB.center.y + profileB.radius * Math.sin(angle),
      });
    }
  } else {
    polygonB = profileB.points || [];
  }

  if (polygonB.length < 3) return false;

  return pointInPolygon(centroidA, polygonB);
}

/**
 * Detect all closed profiles in a sketch
 * @param {Object} sketch - Sketch object with entities
 * @returns {Array} - Array of profile objects
 */
export function detectProfiles(sketch) {
  const profiles = [];

  // 1. Collect all trimmable edges (lines, arcs) that aren't construction
  const edges = [];

  if (sketch.lines) {
    for (const line of sketch.lines.values()) {
      if (!line.construction) {
        edges.push(line);
      }
    }
  }

  if (sketch.arcs) {
    for (const arc of sketch.arcs.values()) {
      if (!arc.construction) {
        edges.push(arc);
      }
    }
  }

  // 2. Handle simple closed entities first

  // Rectangles are always closed profiles
  if (sketch.rectangles) {
    for (const rect of sketch.rectangles.values()) {
      if (rect.construction) continue;

      const points = [
        { x: rect.p1.x, y: rect.p1.y },
        { x: rect.p2.x, y: rect.p2.y },
        { x: rect.p3.x, y: rect.p3.y },
        { x: rect.p4.x, y: rect.p4.y },
      ];

      profiles.push({
        id: generateProfileId(),
        type: 'rectangle',
        entity: rect,
        edges: rect.lines || [],
        points: points,
        area: calculateArea(points),
        centroid: calculateCentroid(points),
        width: Math.abs(rect.p2.x - rect.p1.x),
        height: Math.abs(rect.p4.y - rect.p1.y),
        center: {
          x: (rect.p1.x + rect.p3.x) / 2,
          y: (rect.p1.y + rect.p3.y) / 2,
        },
        isOuter: true,
        holes: [],
      });
    }
  }

  // Circles are closed profiles
  if (sketch.circles) {
    for (const circle of sketch.circles.values()) {
      if (circle.construction) continue;

      const area = Math.PI * circle.radius * circle.radius;

      profiles.push({
        id: generateProfileId(),
        type: 'circle',
        entity: circle,
        edges: [circle],
        center: { x: circle.center.x, y: circle.center.y },
        radius: circle.radius,
        area: area,
        centroid: { x: circle.center.x, y: circle.center.y },
        isOuter: true,
        holes: [],
      });
    }
  }

  // Closed splines are profiles
  if (sketch.splines) {
    for (const spline of sketch.splines.values()) {
      if (spline.construction) continue;
      if (!spline.closed || spline.controlPoints.length < 3) continue;

      const points = spline.controlPoints.map(p => ({ x: p.x, y: p.y }));

      profiles.push({
        id: generateProfileId(),
        type: 'spline',
        entity: spline,
        edges: [spline],
        controlPoints: points,
        points: points,
        area: calculateArea(points),
        centroid: calculateCentroid(points),
        closed: true,
        isOuter: true,
        holes: [],
      });
    }
  }

  // 3. Find closed chains of lines/arcs using graph-based cycle detection
  if (edges.length >= 3) {
    const graph = buildEdgeGraph(edges);
    const cycles = findAllCycles(graph);

    for (const cycle of cycles) {
      const points = getPointsFromCycle(cycle);
      if (points.length < 3) continue;

      profiles.push({
        id: generateProfileId(),
        type: 'polygon',
        edges: cycle,
        points: points,
        area: calculateArea(points),
        centroid: calculateCentroid(points),
        isOuter: true,
        holes: [],
      });
    }
  }

  // 4. Detect nested profiles (holes)
  // Sort profiles by area (largest first)
  profiles.sort((a, b) => b.area - a.area);

  // Check each profile against larger profiles
  for (let i = profiles.length - 1; i >= 0; i--) {
    const innerProfile = profiles[i];

    for (let j = 0; j < i; j++) {
      const outerProfile = profiles[j];

      if (isProfileInside(innerProfile, outerProfile)) {
        innerProfile.isOuter = false;
        innerProfile.parentId = outerProfile.id;
        outerProfile.holes = outerProfile.holes || [];
        outerProfile.holes.push(innerProfile);
        break; // Only assign to immediate parent
      }
    }
  }

  return profiles;
}

/**
 * Get extrude direction based on sketch plane and context
 * @param {Object} profile - Profile to extrude
 * @param {Object} sketch - Sketch containing the profile
 * @returns {{x, y, z}} - Direction vector
 */
export function getExtrudeDirection(profile, sketch) {
  // Get sketch plane normal
  const plane = sketch.plane || 'xy';
  let normal;

  switch (plane) {
    case 'xy':
      normal = { x: 0, y: 0, z: 1 };
      break;
    case 'xz':
      normal = { x: 0, y: 1, z: 0 };
      break;
    case 'yz':
      normal = { x: 1, y: 0, z: 0 };
      break;
    default:
      // Custom plane - use stored normal if available
      if (sketch.normal) {
        normal = { x: sketch.normal.x, y: sketch.normal.y, z: sketch.normal.z };
      } else {
        normal = { x: 0, y: 0, z: 1 };
      }
  }

  // If sketching on a face, default away from solid
  if (sketch.baseFace && sketch.baseFace.normal) {
    const faceNormal = sketch.baseFace.normal;
    return { x: faceNormal.x, y: faceNormal.y, z: faceNormal.z };
  }

  return normal;
}

/**
 * Get only outer profiles (profiles without parent)
 * @param {Array} profiles - All detected profiles
 * @returns {Array} - Only outer profiles
 */
export function getOuterProfiles(profiles) {
  return profiles.filter(p => p.isOuter);
}

/**
 * Create profile data for extrusion
 * @param {Object} profile - Profile from detection
 * @returns {Object} - Profile data ready for kernel extrusion
 */
export function createExtrusionProfile(profile) {
  const result = {
    type: profile.type,
    center: profile.center || profile.centroid,
  };

  switch (profile.type) {
    case 'rectangle':
      result.width = profile.width;
      result.height = profile.height;
      break;

    case 'circle':
      result.radius = profile.radius;
      break;

    case 'polygon':
      result.points = profile.points;
      break;

    case 'spline':
      result.controlPoints = profile.controlPoints;
      result.closed = true;
      break;
  }

  // Include holes if any
  if (profile.holes && profile.holes.length > 0) {
    result.holes = profile.holes.map(createExtrusionProfile);
  }

  return result;
}

export default {
  detectProfiles,
  getExtrudeDirection,
  getOuterProfiles,
  createExtrusionProfile,
  calculateArea,
  calculateCentroid,
  pointInPolygon,
  isProfileInside,
};
