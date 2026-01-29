/**
 * Ameri-CAD Geometry Kernel Worker
 * Runs OpenCASCADE.js in a Web Worker for non-blocking B-Rep operations
 */

// OpenCASCADE.js will be loaded dynamically
let oc = null;
let initialized = false;

// Topology ID counter for stable references
let nextTopoId = 1;
const topoIdMap = new Map(); // OCCT shape hash -> stable ID

/**
 * Initialize OpenCASCADE.js
 */
async function initKernel() {
    if (initialized) return { success: true, version: 'cached' };
    
    try {
        console.log('[Kernel] Loading OpenCASCADE.js...');
        
        // Dynamic import for ES module
        const opencascadeModule = await import('/lib/opencascade/opencascade.wasm.js');
        const opencascade = opencascadeModule.default;
        
        console.log('[Kernel] Initializing WASM module...');
        
        // Initialize the WASM module
        oc = await opencascade({
            locateFile: (file) => `/lib/opencascade/${file}`
        });
        
        initialized = true;
        
        // Get version if available
        const versionMajor = oc.OSD_VERSION_MAJOR ?? 7;
        const versionMinor = oc.OSD_VERSION_MINOR ?? 0;
        const version = `${versionMajor}.${versionMinor}`;
        
        console.log('[Kernel] OpenCASCADE initialized successfully');
        console.log('[Kernel] OCCT Version:', version);
        return { success: true, version };
    } catch (error) {
        console.error('[Kernel] Failed to initialize:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generate a stable topology ID for a shape
 */
function getTopoId(shape) {
    const hash = shape.HashCode(1e9);
    if (!topoIdMap.has(hash)) {
        topoIdMap.set(hash, `topo_${nextTopoId++}`);
    }
    return topoIdMap.get(hash);
}

/**
 * Tessellate a B-Rep shape to triangles for Three.js
 */
function tessellate(shape, linearDeflection = 0.1, angularDeflection = 0.5) {
    // Mesh the shape
    new oc.BRepMesh_IncrementalMesh_2(shape, linearDeflection, false, angularDeflection, true);
    
    const vertices = [];
    const normals = [];
    const indices = [];
    const faceIds = []; // For topology tracking
    
    // Extract faces
    const explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    
    while (explorer.More()) {
        const face = oc.TopoDS.Face_1(explorer.Current());
        const faceId = getTopoId(face);
        const location = new oc.TopLoc_Location_1();
        const triangulation = oc.BRep_Tool.Triangulation(face, location);
        
        if (!triangulation.IsNull()) {
            const transform = location.Transformation();
            const nbNodes = triangulation.get().NbNodes();
            const nbTriangles = triangulation.get().NbTriangles();
            
            const baseIndex = vertices.length / 3;
            
            // Extract vertices
            for (let i = 1; i <= nbNodes; i++) {
                const node = triangulation.get().Node(i);
                const transformed = node.Transformed(transform);
                vertices.push(transformed.X(), transformed.Y(), transformed.Z());
            }
            
            // Extract normals from triangulation
            // Check face orientation for normal flipping
            const orientation = face.Orientation_1();
            const flip = (orientation === oc.TopAbs_Orientation.TopAbs_REVERSED) ? -1 : 1;
            
            // Check if triangulation has precomputed normals
            const hasNormals = triangulation.get().HasNormals();
            
            for (let i = 1; i <= nbNodes; i++) {
                let nx, ny, nz;
                
                if (hasNormals) {
                    // Use precomputed normals from tessellation
                    const normal = triangulation.get().Normal(i);
                    nx = normal.X();
                    ny = normal.Y();
                    nz = normal.Z();
                } else {
                    // Fallback: compute normal from face surface at UV point
                    // For now use a simple geometric normal (will work for flat faces)
                    // TODO: Use BRepGProp_Face for proper surface normals
                    nx = 0;
                    ny = 0;
                    nz = 1;
                }
                
                // Transform normal by location (rotation only, not translation)
                const trsf = transform;
                // Apply rotation part of transform to normal
                const tnx = trsf.Value(1, 1) * nx + trsf.Value(1, 2) * ny + trsf.Value(1, 3) * nz;
                const tny = trsf.Value(2, 1) * nx + trsf.Value(2, 2) * ny + trsf.Value(2, 3) * nz;
                const tnz = trsf.Value(3, 1) * nx + trsf.Value(3, 2) * ny + trsf.Value(3, 3) * nz;
                
                // Normalize and apply face orientation flip
                const len = Math.sqrt(tnx * tnx + tny * tny + tnz * tnz);
                if (len > 1e-10) {
                    normals.push(tnx / len * flip, tny / len * flip, tnz / len * flip);
                } else {
                    normals.push(0, 0, flip); // Fallback for degenerate normals
                }
            }
            
            // Extract triangles
            for (let i = 1; i <= nbTriangles; i++) {
                const triangle = triangulation.get().Triangle(i);
                const n1 = triangle.Value(1) - 1 + baseIndex;
                const n2 = triangle.Value(2) - 1 + baseIndex;
                const n3 = triangle.Value(3) - 1 + baseIndex;
                
                // Check face orientation
                const orientation = face.IsEqual(explorer.Current()) 
                    ? face.Orientation_1() 
                    : oc.TopAbs_Orientation.TopAbs_FORWARD;
                    
                if (orientation === oc.TopAbs_Orientation.TopAbs_REVERSED) {
                    indices.push(n1, n3, n2);
                } else {
                    indices.push(n1, n2, n3);
                }
                
                // Track which face each triangle belongs to
                faceIds.push(faceId, faceId, faceId);
            }
        }
        
        explorer.Next();
    }
    
    return {
        vertices: new Float32Array(vertices),
        normals: new Float32Array(normals),
        indices: new Uint32Array(indices),
        faceIds
    };
}

/**
 * Create a box primitive
 */
function createBox(width, height, depth, center = { x: 0, y: 0, z: 0 }) {
    // BRepPrimAPI_MakeBox_3 takes two gp_Pnt (opposite corners)
    const p1 = new oc.gp_Pnt_3(
        center.x - width/2,
        center.y - height/2,
        center.z - depth/2
    );
    const p2 = new oc.gp_Pnt_3(
        center.x + width/2,
        center.y + height/2,
        center.z + depth/2
    );
    
    const boxMaker = new oc.BRepPrimAPI_MakeBox_3(p1, p2);
    const box = boxMaker.Shape();
    
    return {
        shape: box,
        id: getTopoId(box),
        type: 'box',
        params: { width, height, depth, center }
    };
}

/**
 * Create a cylinder primitive
 */
function createCylinder(radius, height, center = { x: 0, y: 0, z: 0 }) {
    const axis = new oc.gp_Ax2_3(
        new oc.gp_Pnt_3(center.x, center.y, center.z),
        new oc.gp_Dir_4(0, 0, 1)
    );
    
    const cylinder = new oc.BRepPrimAPI_MakeCylinder_3(axis, radius, height).Shape();
    
    return {
        shape: cylinder,
        id: getTopoId(cylinder),
        type: 'cylinder',
        params: { radius, height, center }
    };
}

/**
 * Create a sphere primitive
 */
function createSphere(radius, center = { x: 0, y: 0, z: 0 }) {
    const sphere = new oc.BRepPrimAPI_MakeSphere_5(
        new oc.gp_Pnt_3(center.x, center.y, center.z),
        radius
    ).Shape();
    
    return {
        shape: sphere,
        id: getTopoId(sphere),
        type: 'sphere',
        params: { radius, center }
    };
}

/**
 * Create a cone primitive
 * BRepPrimAPI_MakeCone_4 signature: (gp_Ax2, R1, R2, H, angle)
 * angle is the sweep angle in radians (2*PI for full cone)
 */
function createCone(radius1, radius2, height, center = { x: 0, y: 0, z: 0 }) {
    const axis = new oc.gp_Ax2_3(
        new oc.gp_Pnt_3(center.x, center.y, center.z),
        new oc.gp_Dir_4(0, 0, 1)
    );
    
    // Full cone requires 2*PI angle (360 degrees)
    const cone = new oc.BRepPrimAPI_MakeCone_4(axis, radius1, radius2, height, 2 * Math.PI).Shape();
    
    return {
        shape: cone,
        id: getTopoId(cone),
        type: 'cone',
        params: { radius1, radius2, height, center }
    };
}

/**
 * Boolean union operation
 * OCCT 7.x constructor order:
 *   _1: () - builder pattern
 *   _2: (PaveFiller) - 1 param
 *   _3: (Shape1, Shape2, ProgressRange) - 3 params
 */
function booleanUnion(shape1, shape2) {
    // Use _3 constructor which takes two shapes + progress range
    const progress = new oc.Message_ProgressRange_1();
    const fuse = new oc.BRepAlgoAPI_Fuse_3(shape1, shape2, progress);
    
    if (!fuse.IsDone()) {
        throw new Error('Boolean union failed');
    }
    
    return {
        shape: fuse.Shape(),
        id: getTopoId(fuse.Shape()),
        type: 'union'
    };
}

/**
 * Boolean subtraction operation
 * OCCT 7.x constructor order:
 *   _1: () - builder pattern
 *   _2: (PaveFiller) - 1 param
 *   _3: (Shape1, Shape2, ProgressRange) - 3 params
 */
function booleanSubtract(shape1, shape2) {
    // Use _3 constructor which takes two shapes + progress range
    const progress = new oc.Message_ProgressRange_1();
    const cut = new oc.BRepAlgoAPI_Cut_3(shape1, shape2, progress);
    
    if (!cut.IsDone()) {
        throw new Error('Boolean subtraction failed');
    }
    
    return {
        shape: cut.Shape(),
        id: getTopoId(cut.Shape()),
        type: 'subtract'
    };
}

/**
 * Boolean intersection operation
 * OCCT 7.x constructor order:
 *   _1: () - builder pattern
 *   _2: (PaveFiller) - 1 param
 *   _3: (Shape1, Shape2, ProgressRange) - 3 params
 */
function booleanIntersect(shape1, shape2) {
    // Use _3 constructor which takes two shapes + progress range
    const progress = new oc.Message_ProgressRange_1();
    const common = new oc.BRepAlgoAPI_Common_3(shape1, shape2, progress);
    
    if (!common.IsDone()) {
        throw new Error('Boolean intersection failed');
    }
    
    return {
        shape: common.Shape(),
        id: getTopoId(common.Shape()),
        type: 'intersect'
    };
}

/**
 * Apply fillet to edges
 */
function applyFillet(shape, edgeIds, radius) {
    const fillet = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
    
    // Find edges by ID and add to fillet
    const explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    
    while (explorer.More()) {
        const edge = oc.TopoDS.Edge_1(explorer.Current());
        const edgeId = getTopoId(edge);
        
        if (edgeIds.includes(edgeId)) {
            fillet.Add_2(radius, edge);
        }
        
        explorer.Next();
    }
    
    fillet.Build();
    
    if (!fillet.IsDone()) {
        throw new Error('Fillet operation failed');
    }
    
    return {
        shape: fillet.Shape(),
        id: getTopoId(fillet.Shape()),
        type: 'fillet'
    };
}

/**
 * Apply chamfer to edges
 */
function applyChamfer(shape, edgeIds, distance) {
    const chamfer = new oc.BRepFilletAPI_MakeChamfer(shape);
    
    // Find edges by ID and add to chamfer
    const explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    
    while (explorer.More()) {
        const edge = oc.TopoDS.Edge_1(explorer.Current());
        const edgeId = getTopoId(edge);
        
        if (edgeIds.includes(edgeId)) {
            chamfer.Add_2(distance, edge);
        }
        
        explorer.Next();
    }
    
    chamfer.Build();
    
    if (!chamfer.IsDone()) {
        throw new Error('Chamfer operation failed');
    }
    
    return {
        shape: chamfer.Shape(),
        id: getTopoId(chamfer.Shape()),
        type: 'chamfer'
    };
}

/**
 * Apply fillet to ALL edges of a shape
 */
function applyFilletAll(shape, radius) {
    const fillet = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
    
    // Add all edges to fillet
    const explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    let edgeCount = 0;
    
    while (explorer.More()) {
        const edge = oc.TopoDS.Edge_1(explorer.Current());
        fillet.Add_2(radius, edge);
        edgeCount++;
        explorer.Next();
    }
    
    if (edgeCount === 0) {
        throw new Error('Shape has no edges to fillet');
    }
    
    fillet.Build();
    
    if (!fillet.IsDone()) {
        throw new Error('Fillet operation failed - radius may be too large for geometry');
    }
    
    return {
        shape: fillet.Shape(),
        id: getTopoId(fillet.Shape()),
        type: 'filletAll',
        edgeCount
    };
}

/**
 * Apply chamfer to ALL edges of a shape
 */
function applyChamferAll(shape, distance) {
    const chamfer = new oc.BRepFilletAPI_MakeChamfer(shape);
    
    // Add all edges to chamfer
    const explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    let edgeCount = 0;
    
    while (explorer.More()) {
        const edge = oc.TopoDS.Edge_1(explorer.Current());
        chamfer.Add_2(distance, edge);
        edgeCount++;
        explorer.Next();
    }
    
    if (edgeCount === 0) {
        throw new Error('Shape has no edges to chamfer');
    }
    
    chamfer.Build();
    
    if (!chamfer.IsDone()) {
        throw new Error('Chamfer operation failed - distance may be too large for geometry');
    }
    
    return {
        shape: chamfer.Shape(),
        id: getTopoId(chamfer.Shape()),
        type: 'chamferAll',
        edgeCount
    };
}

/**
 * Get all edge IDs for a shape
 */
function getEdges(shape) {
    const edges = [];
    const explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    
    while (explorer.More()) {
        const edge = oc.TopoDS.Edge_1(explorer.Current());
        edges.push(getTopoId(edge));
        explorer.Next();
    }
    
    return edges;
}

/**
 * Create a torus primitive
 * OCCT constructor order (from OCCT docs):
 *   _1: (R1, R2) - major and minor radii, coaxial to Z
 *   _2: (R1, R2, angle) - partial torus with sweep angle
 *   _3: (R1, R2, angle1, angle2) - ring segment
 *   _4: (R1, R2, angle1, angle2, angle) - ring segment with partial revolution
 *   _5: (Ax2, R1, R2) - positioned full torus
 *   _6: (Ax2, R1, R2, angle) - positioned partial torus
 *   _7: (Ax2, R1, R2, angle1, angle2) - positioned ring segment
 *   _8: (Ax2, R1, R2, angle1, angle2, angle) - positioned ring segment, partial
 * We use _5 for a positioned full torus
 */
function createTorus(majorRadius, minorRadius, center = { x: 0, y: 0, z: 0 }) {
    const axis = new oc.gp_Ax2_3(
        new oc.gp_Pnt_3(center.x, center.y, center.z),
        new oc.gp_Dir_4(0, 0, 1)
    );
    
    // Use _5 with (Ax2, majorRadius, minorRadius) for full positioned torus
    const torus = new oc.BRepPrimAPI_MakeTorus_5(axis, majorRadius, minorRadius).Shape();
    
    return {
        shape: torus,
        id: getTopoId(torus),
        type: 'torus',
        params: { majorRadius, minorRadius, center }
    };
}

/**
 * Create a wedge primitive
 * OCCT BRepPrimAPI_MakeWedge creates a right angular wedge.
 * The base is a rectangle (dx × dz), height is dy, top edge length is ltx.
 * 
 * opencascade.js constructor variants:
 *   _1: (dx, dy, dz, ltx) - simple wedge at origin
 *   _2: (Axes, dx, dy, dz, ltx) - wedge with coordinate system
 *   _3: (dx, dy, dz, xmin, zmin, xmax, zmax) - general wedge
 *   _4: (Axes, dx, dy, dz, xmin, zmin, xmax, zmax) - general with axes
 * 
 * We use _1 for simplicity, then transform to center position.
 */
function createWedge(dx, dy, dz, ltx = 0, center = { x: 0, y: 0, z: 0 }) {
    // BRepPrimAPI_MakeWedge_1 takes (dx, dy, dz, ltx)
    // Creates wedge at origin with base on XZ plane, height along Y
    const wedgeMaker = new oc.BRepPrimAPI_MakeWedge_1(dx, dy, dz, ltx);
    let wedgeShape = wedgeMaker.Shape();
    
    // Transform to center the wedge (default position has corner at origin)
    const trsf = new oc.gp_Trsf_1();
    trsf.SetTranslation_1(new oc.gp_Vec_4(
        center.x - dx/2,
        center.y - dy/2,
        center.z - dz/2
    ));
    const transformer = new oc.BRepBuilderAPI_Transform_2(wedgeShape, trsf, true);
    wedgeShape = transformer.Shape();
    
    return {
        shape: wedgeShape,
        id: getTopoId(wedgeShape),
        type: 'wedge',
        params: { dx, dy, dz, ltx, center }
    };
}

/**
 * Create a wire (closed path) from a polygon of points
 * @param {Array<{x,y,z}>} points - Array of 3D points forming the polygon
 * @returns {{shape: TopoDS_Wire, id: string}}
 */
function createWireFromPolygon(points) {
    const wireBuilder = new oc.BRepBuilderAPI_MakeWire_1();
    
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        
        const gp1 = new oc.gp_Pnt_3(p1.x, p1.y, p1.z);
        const gp2 = new oc.gp_Pnt_3(p2.x, p2.y, p2.z);
        
        const edge = new oc.BRepBuilderAPI_MakeEdge_3(gp1, gp2);
        if (edge.IsDone()) {
            wireBuilder.Add_1(edge.Edge());
        }
    }
    
    if (!wireBuilder.IsDone()) {
        throw new Error('Failed to create wire from polygon');
    }
    
    const wire = wireBuilder.Wire();
    
    return {
        shape: wire,
        id: getTopoId(wire),
        type: 'wire'
    };
}

/**
 * Create a face from a wire
 * @param {TopoDS_Wire} wire - The boundary wire
 * @param {boolean} planar - Whether to create a planar face (default: true)
 * @returns {{shape: TopoDS_Face, id: string}}
 */
function createFaceFromWire(wire, planar = true) {
    const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wire, planar);
    
    if (!faceMaker.IsDone()) {
        throw new Error('Failed to create face from wire');
    }
    
    const face = faceMaker.Face();
    
    return {
        shape: face,
        id: getTopoId(face),
        type: 'face'
    };
}

/**
 * Create a circular wire
 * @param {{x,y,z}} center - Center point
 * @param {number} radius - Circle radius
 * @param {{x,y,z}} normal - Plane normal (default: Z axis)
 * @returns {{shape: TopoDS_Wire, id: string}}
 */
function createCircleWire(center, radius, normal = { x: 0, y: 0, z: 1 }) {
    // Create axis for the circle plane
    const ax2 = new oc.gp_Ax2_3(
        new oc.gp_Pnt_3(center.x, center.y, center.z),
        new oc.gp_Dir_4(normal.x, normal.y, normal.z)
    );
    
    // Create the circle geometry
    const circle = new oc.gp_Circ_2(ax2, radius);
    
    // Create edge from circle
    const edgeMaker = new oc.BRepBuilderAPI_MakeEdge_8(circle);
    if (!edgeMaker.IsDone()) {
        throw new Error('Failed to create circle edge');
    }
    
    // Create wire from edge
    const wireMaker = new oc.BRepBuilderAPI_MakeWire_2(edgeMaker.Edge());
    if (!wireMaker.IsDone()) {
        throw new Error('Failed to create circle wire');
    }
    
    const wire = wireMaker.Wire();
    
    return {
        shape: wire,
        id: getTopoId(wire),
        type: 'wire'
    };
}

/**
 * Create a rectangular face on a plane
 * @param {number} width - Width (X dimension in sketch space)
 * @param {number} height - Height (Y dimension in sketch space)
 * @param {{x,y,z}} center - Center point in 3D
 * @param {string} plane - Plane name ('xy', 'xz', 'yz')
 * @returns {{shape: TopoDS_Face, id: string}}
 */
function createRectangleFace(width, height, center, plane = 'xy') {
    let p1, p2, p3, p4;
    const hw = width / 2;
    const hh = height / 2;
    
    switch (plane) {
        case 'xy':
            p1 = { x: center.x - hw, y: center.y - hh, z: center.z };
            p2 = { x: center.x + hw, y: center.y - hh, z: center.z };
            p3 = { x: center.x + hw, y: center.y + hh, z: center.z };
            p4 = { x: center.x - hw, y: center.y + hh, z: center.z };
            break;
        case 'xz':
            p1 = { x: center.x - hw, y: center.y, z: center.z - hh };
            p2 = { x: center.x + hw, y: center.y, z: center.z - hh };
            p3 = { x: center.x + hw, y: center.y, z: center.z + hh };
            p4 = { x: center.x - hw, y: center.y, z: center.z + hh };
            break;
        case 'yz':
            p1 = { x: center.x, y: center.y - hw, z: center.z - hh };
            p2 = { x: center.x, y: center.y + hw, z: center.z - hh };
            p3 = { x: center.x, y: center.y + hw, z: center.z + hh };
            p4 = { x: center.x, y: center.y - hw, z: center.z + hh };
            break;
        default:
            throw new Error(`Unknown plane: ${plane}`);
    }
    
    const wire = createWireFromPolygon([p1, p2, p3, p4]);
    return createFaceFromWire(wire.shape);
}

/**
 * Create a circular face on a plane
 * @param {number} radius - Circle radius
 * @param {{x,y,z}} center - Center point in 3D
 * @param {string} plane - Plane name ('xy', 'xz', 'yz')
 * @returns {{shape: TopoDS_Face, id: string}}
 */
function createCircleFace(radius, center, plane = 'xy') {
    let normal;
    
    switch (plane) {
        case 'xy': normal = { x: 0, y: 0, z: 1 }; break;
        case 'xz': normal = { x: 0, y: 1, z: 0 }; break;
        case 'yz': normal = { x: 1, y: 0, z: 0 }; break;
        default: throw new Error(`Unknown plane: ${plane}`);
    }
    
    const wire = createCircleWire(center, radius, normal);
    return createFaceFromWire(wire.shape);
}

/**
 * Extrude a sketch profile (from sketch geometry data)
 * @param {Object} profile - Profile data from sketch
 * @param {number} height - Extrusion height
 * @param {string} plane - Sketch plane
 * @returns {{shape: TopoDS_Shape, id: string, mesh: Object}}
 */
function extrudeSketchProfile(profile, height, plane = 'xy') {
    let face;
    let direction;
    
    // Determine extrusion direction based on plane
    switch (plane) {
        case 'xy': direction = { x: 0, y: 0, z: 1 }; break;
        case 'xz': direction = { x: 0, y: 1, z: 0 }; break;
        case 'yz': direction = { x: 1, y: 0, z: 0 }; break;
        default: direction = { x: 0, y: 0, z: 1 };
    }
    
    if (profile.type === 'rectangle') {
        face = createRectangleFace(profile.width, profile.height, {
            x: profile.center.x,
            y: profile.center.y,
            z: 0 // Sketch is at origin
        }, plane);
    } else if (profile.type === 'circle') {
        face = createCircleFace(profile.radius, {
            x: profile.center.x,
            y: profile.center.y,
            z: 0
        }, plane);
    } else if (profile.type === 'polygon' && profile.points) {
        // Convert 2D points to 3D based on plane
        const points3d = profile.points.map(p => {
            switch (plane) {
                case 'xy': return { x: p.x, y: p.y, z: 0 };
                case 'xz': return { x: p.x, y: 0, z: p.y };
                case 'yz': return { x: 0, y: p.y, z: p.x };
                default: return { x: p.x, y: p.y, z: 0 };
            }
        });
        const wire = createWireFromPolygon(points3d);
        face = createFaceFromWire(wire.shape);
    } else {
        throw new Error(`Unsupported profile type: ${profile.type}`);
    }
    
    // Extrude the face
    const extruded = extrudeProfile(face.shape, direction, height);
    
    return extruded;
}

/**
 * Extrude a face/profile along a direction
 */
function extrudeProfile(profile, direction, distance) {
    // Create direction vector
    const vec = new oc.gp_Vec_4(
        direction.x * distance,
        direction.y * distance,
        direction.z * distance
    );
    
    // BRepPrimAPI_MakePrism extrudes a shape along a vector
    const prism = new oc.BRepPrimAPI_MakePrism_1(profile, vec, false, true);
    prism.Build();
    
    if (!prism.IsDone()) {
        throw new Error('Extrude operation failed');
    }
    
    return {
        shape: prism.Shape(),
        id: getTopoId(prism.Shape()),
        type: 'extrude'
    };
}

/**
 * Revolve a face/profile around an axis
 */
function revolveProfile(profile, axis, angleDegrees) {
    // Create axis for revolution
    const ax1 = new oc.gp_Ax1_2(
        new oc.gp_Pnt_3(axis.origin.x, axis.origin.y, axis.origin.z),
        new oc.gp_Dir_4(axis.direction.x, axis.direction.y, axis.direction.z)
    );
    
    const angleRadians = angleDegrees * Math.PI / 180;
    
    // BRepPrimAPI_MakeRevol revolves a shape around an axis
    const revol = new oc.BRepPrimAPI_MakeRevol_1(profile, ax1, angleRadians, true);
    revol.Build();
    
    if (!revol.IsDone()) {
        throw new Error('Revolve operation failed');
    }
    
    return {
        shape: revol.Shape(),
        id: getTopoId(revol.Shape()),
        type: 'revolve'
    };
}

/**
 * Shell a solid (hollow it out)
 */
function shellSolid(shape, faceIds, thickness) {
    const shell = new oc.BRepOffsetAPI_MakeThickSolid();
    
    // Collect faces to remove
    const facesToRemove = new oc.TopTools_ListOfShape_1();
    
    if (faceIds && faceIds.length > 0) {
        const explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
        
        while (explorer.More()) {
            const face = oc.TopoDS.Face_1(explorer.Current());
            const faceId = getTopoId(face);
            
            if (faceIds.includes(faceId)) {
                facesToRemove.Append_1(face);
            }
            
            explorer.Next();
        }
    }
    
    // MakeThickSolidByJoin without progress range (use 9-arg version)
    shell.MakeThickSolidByJoin(
        shape,
        facesToRemove,
        thickness,
        1e-6,
        oc.BRepOffset_Mode.BRepOffset_Skin,
        false,
        false,
        oc.GeomAbs_JoinType.GeomAbs_Arc,
        false
    );
    
    if (!shell.IsDone()) {
        throw new Error('Shell operation failed');
    }
    
    return {
        shape: shell.Shape(),
        id: getTopoId(shell.Shape()),
        type: 'shell'
    };
}

/**
 * Loft between multiple profiles
 */
function loftProfiles(profiles, solid = true) {
    const loft = new oc.BRepOffsetAPI_ThruSections(solid, false, 1e-6);
    
    // Add each profile as a wire/vertex
    for (const profile of profiles) {
        // Check if it's a wire or vertex
        const shapeType = profile.ShapeType();
        if (shapeType === oc.TopAbs_ShapeEnum.TopAbs_WIRE) {
            loft.AddWire(oc.TopoDS.Wire_1(profile));
        } else if (shapeType === oc.TopAbs_ShapeEnum.TopAbs_VERTEX) {
            loft.AddVertex(oc.TopoDS.Vertex_1(profile));
        } else if (shapeType === oc.TopAbs_ShapeEnum.TopAbs_FACE) {
            // Extract outer wire from face
            const wire = oc.BRepTools.OuterWire(oc.TopoDS.Face_1(profile));
            loft.AddWire(wire);
        }
    }
    
    loft.Build();
    
    if (!loft.IsDone()) {
        throw new Error('Loft operation failed');
    }
    
    return {
        shape: loft.Shape(),
        id: getTopoId(loft.Shape()),
        type: 'loft'
    };
}

/**
 * Sweep a profile along a path
 */
function sweepProfile(profile, path) {
    // BRepOffsetAPI_MakePipe sweeps a profile along a spine wire
    const spine = oc.TopoDS.Wire_1(path);
    
    const pipe = new oc.BRepOffsetAPI_MakePipe_1(spine, profile);
    pipe.Build();
    
    if (!pipe.IsDone()) {
        throw new Error('Sweep operation failed');
    }
    
    return {
        shape: pipe.Shape(),
        id: getTopoId(pipe.Shape()),
        type: 'sweep'
    };
}

/**
 * Export to STEP format (ISO 10303-21)
 * Uses AP214 (Automotive Design) schema for maximum compatibility
 */
function exportSTEP(shape) {
    if (!shape || shape.IsNull()) {
        throw new Error('Cannot export null or invalid shape');
    }
    
    const writer = new oc.STEPControl_Writer_1();
    
    // Set schema to AP214 for best compatibility with other CAD software
    oc.Interface_Static.SetCVal("write.step.schema", "AP214");
    
    // Transfer shape to writer
    // Note: Status check removed - opencascade.js enum comparison unreliable
    writer.Transfer(shape, oc.STEPControl_StepModelType.STEPControl_AsIs, true);
    
    // Write to virtual file system
    const filename = '/output.step';
    writer.Write(filename);
    
    // Read file content back
    const content = oc.FS.readFile(filename, { encoding: 'utf8' });
    
    // Cleanup virtual file
    try {
        oc.FS.unlink(filename);
    } catch (e) {
        // Ignore cleanup errors
    }
    
    // Validate we got actual STEP content
    if (!content || content.length < 100 || !content.includes('ISO-10303-21')) {
        throw new Error('STEP export produced invalid or empty content');
    }
    
    return content;
}

/**
 * Export multiple shapes to STEP format
 * Creates a compound of all shapes before export
 */
function exportSTEPMultiple(shapeList) {
    if (shapeList.length === 0) {
        throw new Error('No shapes to export');
    }
    
    if (shapeList.length === 1) {
        return exportSTEP(shapeList[0]);
    }
    
    // Build a compound from all shapes
    const builder = new oc.BRep_Builder();
    const compound = new oc.TopoDS_Compound();
    builder.MakeCompound(compound);
    
    for (const shape of shapeList) {
        builder.Add(compound, shape);
    }
    
    return exportSTEP(compound);
}

/**
 * Export to STL format
 * Uses BRepMesh for tessellation and StlAPI_Writer for output.
 * 
 * Note: StlAPI_Writer API varies between OCCT versions:
 * - StlAPI_Writer.Write(shape, filename) - older API
 * - StlAPI_Writer.Write(shape, filename, progress) - newer API with progress
 * 
 * @param {TopoDS_Shape} shape - Shape to export
 * @param {boolean} ascii - Whether to export ASCII format (default: true)
 * @returns {string|Uint8Array} STL content
 */
function exportSTL(shape, ascii = true) {
    // Tessellate the shape first - required for STL export
    // Parameters: (shape, linearDeflection, isRelative, angularDeflection, inParallel)
    const mesh = new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.5, true);
    
    // Check if tessellation succeeded
    if (!mesh.IsDone()) {
        throw new Error('STL export failed: tessellation error');
    }
    
    const writer = new oc.StlAPI_Writer();
    const filename = '/output.stl';
    
    // Set ASCII mode - try different API variations
    if (typeof writer.SetASCIIMode === 'function') {
        writer.SetASCIIMode(ascii);
    }
    // Note: opencascade.js 2.0+ uses SetASCIIMode, older versions may differ
    
    // Write to virtual filesystem
    // The Write method signature: Write(shape, filename) returns bool
    let writeSuccess;
    try {
        // Try with progress range first (newer OCCT API)
        if (typeof oc.Message_ProgressRange_1 === 'function') {
            const progress = new oc.Message_ProgressRange_1();
            writeSuccess = writer.Write(shape, filename, progress);
        } else {
            // Fallback to simple 2-argument version
            writeSuccess = writer.Write(shape, filename);
        }
    } catch (e) {
        // If Write throws, try alternative approach
        writeSuccess = writer.Write(shape, filename);
    }
    
    // Check if file was written
    let fileExists = false;
    try {
        oc.FS.stat(filename);
        fileExists = true;
    } catch (e) {
        fileExists = false;
    }
    
    if (!fileExists) {
        throw new Error('STL export failed: file not written to virtual filesystem');
    }
    
    // Read the content
    let content;
    if (ascii) {
        try {
            content = oc.FS.readFile(filename, { encoding: 'utf8' });
        } catch (e) {
            // Binary fallback - convert to string
            const binary = oc.FS.readFile(filename);
            content = new TextDecoder().decode(binary);
        }
    } else {
        // Binary mode - return as Uint8Array
        content = oc.FS.readFile(filename);
    }
    
    // Clean up virtual filesystem
    try {
        oc.FS.unlink(filename);
    } catch (e) {
        // Ignore cleanup errors
    }
    
    return content;
}

/**
 * Calculate volume of shape
 */
function calculateVolume(shape) {
    const props = new oc.GProp_GProps_1();
    oc.BRepGProp.VolumeProperties_1(shape, props, true, true, true);
    return props.Mass();
}

/**
 * Get bounding box of shape
 */
function getBoundingBox(shape) {
    const bbox = new oc.Bnd_Box_1();
    oc.BRepBndLib.Add(shape, bbox, true);
    
    const xmin = { current: 0 }, ymin = { current: 0 }, zmin = { current: 0 };
    const xmax = { current: 0 }, ymax = { current: 0 }, zmax = { current: 0 };
    
    bbox.Get(xmin, ymin, zmin, xmax, ymax, zmax);
    
    return {
        min: { x: xmin.current, y: ymin.current, z: zmin.current },
        max: { x: xmax.current, y: ymax.current, z: zmax.current }
    };
}

// Shape storage for persistent references
const shapes = new Map();

/**
 * Handle messages from main thread
 */
self.onmessage = async function(e) {
    const { id, action, params } = e.data;
    
    try {
        let result;
        
        switch (action) {
            case 'init':
                result = await initKernel();
                break;
            
            case 'debug':
                // List available constructor variants for a class
                if (!oc) {
                    result = { error: 'Kernel not initialized' };
                    break;
                }
                const query = params?.query || 'MakeBox';
                const found = Object.keys(oc).filter(k => k.includes(query)).sort();
                result = { query, found };
                break;
                
            case 'createBox':
                const box = createBox(params.width, params.height, params.depth, params.center);
                shapes.set(box.id, box.shape);
                const boxMesh = tessellate(box.shape);
                result = { id: box.id, mesh: boxMesh, params: box.params };
                break;
                
            case 'createCylinder':
                const cyl = createCylinder(params.radius, params.height, params.center);
                shapes.set(cyl.id, cyl.shape);
                const cylMesh = tessellate(cyl.shape);
                result = { id: cyl.id, mesh: cylMesh, params: cyl.params };
                break;
                
            case 'createSphere':
                const sph = createSphere(params.radius, params.center);
                shapes.set(sph.id, sph.shape);
                const sphMesh = tessellate(sph.shape);
                result = { id: sph.id, mesh: sphMesh, params: sph.params };
                break;
                
            case 'createCone':
                const cone = createCone(params.radius1, params.radius2, params.height, params.center);
                shapes.set(cone.id, cone.shape);
                const coneMesh = tessellate(cone.shape);
                result = { id: cone.id, mesh: coneMesh, params: cone.params };
                break;
                
            case 'booleanUnion':
                const shape1u = shapes.get(params.id1);
                const shape2u = shapes.get(params.id2);
                const union = booleanUnion(shape1u, shape2u);
                shapes.set(union.id, union.shape);
                const unionMesh = tessellate(union.shape);
                result = { id: union.id, mesh: unionMesh };
                break;
                
            case 'booleanSubtract':
                const shape1s = shapes.get(params.id1);
                const shape2s = shapes.get(params.id2);
                const sub = booleanSubtract(shape1s, shape2s);
                shapes.set(sub.id, sub.shape);
                const subMesh = tessellate(sub.shape);
                result = { id: sub.id, mesh: subMesh };
                break;
                
            case 'booleanIntersect':
                const shape1i = shapes.get(params.id1);
                const shape2i = shapes.get(params.id2);
                const inter = booleanIntersect(shape1i, shape2i);
                shapes.set(inter.id, inter.shape);
                const interMesh = tessellate(inter.shape);
                result = { id: inter.id, mesh: interMesh };
                break;
                
            case 'fillet':
                const shapeF = shapes.get(params.shapeId);
                const filleted = applyFillet(shapeF, params.edgeIds, params.radius);
                shapes.set(filleted.id, filleted.shape);
                const filletMesh = tessellate(filleted.shape);
                result = { id: filleted.id, mesh: filletMesh };
                break;
                
            case 'chamfer':
                const shapeCh = shapes.get(params.shapeId);
                const chamfered = applyChamfer(shapeCh, params.edgeIds, params.distance);
                shapes.set(chamfered.id, chamfered.shape);
                const chamferMesh = tessellate(chamfered.shape);
                result = { id: chamfered.id, mesh: chamferMesh };
                break;
                
            case 'filletAll':
                const shapeFA = shapes.get(params.shapeId);
                if (!shapeFA) throw new Error(`Shape not found: ${params.shapeId}`);
                const filletedAll = applyFilletAll(shapeFA, params.radius);
                shapes.set(filletedAll.id, filletedAll.shape);
                const filletAllMesh = tessellate(filletedAll.shape);
                result = { id: filletedAll.id, mesh: filletAllMesh, edgeCount: filletedAll.edgeCount };
                break;
                
            case 'chamferAll':
                const shapeCA = shapes.get(params.shapeId);
                if (!shapeCA) throw new Error(`Shape not found: ${params.shapeId}`);
                const chamferedAll = applyChamferAll(shapeCA, params.distance);
                shapes.set(chamferedAll.id, chamferedAll.shape);
                const chamferAllMesh = tessellate(chamferedAll.shape);
                result = { id: chamferedAll.id, mesh: chamferAllMesh, edgeCount: chamferedAll.edgeCount };
                break;
                
            case 'getEdges':
                const shapeGE = shapes.get(params.shapeId);
                if (!shapeGE) throw new Error(`Shape not found: ${params.shapeId}`);
                result = { edgeIds: getEdges(shapeGE) };
                break;
                
            case 'createTorus':
                const torus = createTorus(params.majorRadius, params.minorRadius, params.center);
                shapes.set(torus.id, torus.shape);
                const torusMesh = tessellate(torus.shape);
                result = { id: torus.id, mesh: torusMesh, params: torus.params };
                break;
                
            case 'createWedge':
                const wedge = createWedge(params.dx, params.dy, params.dz, params.ltx, params.center);
                shapes.set(wedge.id, wedge.shape);
                const wedgeMesh = tessellate(wedge.shape);
                result = { id: wedge.id, mesh: wedgeMesh, params: wedge.params };
                break;
                
            case 'extrude':
                const profileE = shapes.get(params.profileId);
                const extruded = extrudeProfile(profileE, params.direction, params.distance);
                shapes.set(extruded.id, extruded.shape);
                const extrudeMesh = tessellate(extruded.shape);
                result = { id: extruded.id, mesh: extrudeMesh };
                break;
                
            case 'extrudeSketchProfile':
                // Extrude directly from sketch profile data (no pre-existing shape required)
                const sketchExtruded = extrudeSketchProfile(params.profile, params.height, params.plane);
                shapes.set(sketchExtruded.id, sketchExtruded.shape);
                const sketchExtrudeMesh = tessellate(sketchExtruded.shape);
                result = { id: sketchExtruded.id, mesh: sketchExtrudeMesh };
                break;
                
            case 'createWireFromPolygon':
                const polyWire = createWireFromPolygon(params.points);
                shapes.set(polyWire.id, polyWire.shape);
                result = { id: polyWire.id };
                break;
                
            case 'createCircleWire':
                const circWire = createCircleWire(params.center, params.radius, params.normal);
                shapes.set(circWire.id, circWire.shape);
                result = { id: circWire.id };
                break;
                
            case 'createFaceFromWire':
                const wireForFace = shapes.get(params.wireId);
                const faceFromWire = createFaceFromWire(wireForFace, params.planar);
                shapes.set(faceFromWire.id, faceFromWire.shape);
                result = { id: faceFromWire.id };
                break;
                
            case 'revolve':
                const profileR = shapes.get(params.profileId);
                const revolved = revolveProfile(profileR, params.axis, params.angle);
                shapes.set(revolved.id, revolved.shape);
                const revolveMesh = tessellate(revolved.shape);
                result = { id: revolved.id, mesh: revolveMesh };
                break;
                
            case 'shell':
                const shapeS = shapes.get(params.shapeId);
                const shelled = shellSolid(shapeS, params.faceIds, params.thickness);
                shapes.set(shelled.id, shelled.shape);
                const shellMesh = tessellate(shelled.shape);
                result = { id: shelled.id, mesh: shellMesh };
                break;
                
            case 'loft':
                const profilesL = params.profileIds.map(id => shapes.get(id));
                const lofted = loftProfiles(profilesL, params.solid);
                shapes.set(lofted.id, lofted.shape);
                const loftMesh = tessellate(lofted.shape);
                result = { id: lofted.id, mesh: loftMesh };
                break;
                
            case 'sweep':
                const profileSw = shapes.get(params.profileId);
                const pathSw = shapes.get(params.pathId);
                const swept = sweepProfile(profileSw, pathSw);
                shapes.set(swept.id, swept.shape);
                const sweepMesh = tessellate(swept.shape);
                result = { id: swept.id, mesh: sweepMesh };
                break;
                
            case 'exportSTEP':
                const stepShape = shapes.get(params.id);
                if (!stepShape) throw new Error(`Shape not found: ${params.id}`);
                result = { content: exportSTEP(stepShape), format: 'step' };
                break;
                
            case 'exportSTEPMultiple':
                // Export multiple shapes as a compound
                const shapeList = [];
                for (const id of params.ids) {
                    const shape = shapes.get(id);
                    if (shape) {
                        shapeList.push(shape);
                    }
                }
                if (shapeList.length === 0) {
                    throw new Error('No valid shapes to export');
                }
                result = { content: exportSTEPMultiple(shapeList), format: 'step', count: shapeList.length };
                break;
                
            case 'exportSTEPAll':
                // Export all shapes in the store
                const allShapes = Array.from(shapes.values());
                if (allShapes.length === 0) {
                    throw new Error('No shapes to export');
                }
                result = { content: exportSTEPMultiple(allShapes), format: 'step', count: allShapes.length };
                break;
                
            case 'exportSTL':
                const stlShape = shapes.get(params.id);
                if (!stlShape) throw new Error(`Shape not found: ${params.id}`);
                const ascii = params.ascii !== false; // default to ASCII
                const stlContent = exportSTL(stlShape, ascii);
                result = { 
                    content: stlContent, 
                    format: 'stl',
                    binary: !ascii
                };
                break;
                
            case 'getVolume':
                const volShape = shapes.get(params.id);
                result = { volume: calculateVolume(volShape) };
                break;
                
            case 'getBoundingBox':
                const bboxShape = shapes.get(params.id);
                result = getBoundingBox(bboxShape);
                break;
                
            case 'deleteShape':
                shapes.delete(params.id);
                result = { success: true };
                break;
                
            default:
                throw new Error(`Unknown action: ${action}`);
        }
        
        // Transfer arrays for performance
        const transfer = [];
        if (result?.mesh) {
            transfer.push(result.mesh.vertices.buffer);
            transfer.push(result.mesh.normals.buffer);
            transfer.push(result.mesh.indices.buffer);
        }
        
        self.postMessage({ id, success: true, result }, transfer);
        
    } catch (error) {
        self.postMessage({ id, success: false, error: error.message });
    }
};

console.log('[Kernel Worker] Loaded, awaiting init command');
