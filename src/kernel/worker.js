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
 */
function booleanUnion(shape1, shape2) {
    const fuse = new oc.BRepAlgoAPI_Fuse_3(shape1, shape2, new oc.Message_ProgressRange_1());
    fuse.Build(new oc.Message_ProgressRange_1());
    
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
 */
function booleanSubtract(shape1, shape2) {
    const cut = new oc.BRepAlgoAPI_Cut_3(shape1, shape2, new oc.Message_ProgressRange_1());
    cut.Build(new oc.Message_ProgressRange_1());
    
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
 */
function booleanIntersect(shape1, shape2) {
    const common = new oc.BRepAlgoAPI_Common_3(shape1, shape2, new oc.Message_ProgressRange_1());
    common.Build(new oc.Message_ProgressRange_1());
    
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
    
    fillet.Build(new oc.Message_ProgressRange_1());
    
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
    
    chamfer.Build(new oc.Message_ProgressRange_1());
    
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
 * Create a torus primitive
 */
function createTorus(majorRadius, minorRadius, center = { x: 0, y: 0, z: 0 }) {
    const axis = new oc.gp_Ax2_3(
        new oc.gp_Pnt_3(center.x, center.y, center.z),
        new oc.gp_Dir_4(0, 0, 1)
    );
    
    const torus = new oc.BRepPrimAPI_MakeTorus_3(axis, majorRadius, minorRadius).Shape();
    
    return {
        shape: torus,
        id: getTopoId(torus),
        type: 'torus',
        params: { majorRadius, minorRadius, center }
    };
}

/**
 * Create a wedge primitive
 */
function createWedge(dx, dy, dz, ltx = 0, center = { x: 0, y: 0, z: 0 }) {
    // BRepPrimAPI_MakeWedge creates a wedge from axes and dimensions
    const ax = new oc.gp_Ax2_3(
        new oc.gp_Pnt_3(center.x - dx/2, center.y - dy/2, center.z - dz/2),
        new oc.gp_Dir_4(0, 0, 1)
    );
    
    const wedge = new oc.BRepPrimAPI_MakeWedge_3(ax, dx, dy, dz, ltx).Shape();
    
    return {
        shape: wedge,
        id: getTopoId(wedge),
        type: 'wedge',
        params: { dx, dy, dz, ltx, center }
    };
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
    prism.Build(new oc.Message_ProgressRange_1());
    
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
    revol.Build(new oc.Message_ProgressRange_1());
    
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
    
    // MakeThickSolidByJoin(shape, facesToRemove, offset, tolerance, mode, intersection, selfInter, join, removeIntEdges)
    shell.MakeThickSolidByJoin(
        shape,
        facesToRemove,
        thickness,
        1e-6,
        oc.BRepOffset_Mode.BRepOffset_Skin,
        false,
        false,
        oc.GeomAbs_JoinType.GeomAbs_Arc,
        false,
        new oc.Message_ProgressRange_1()
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
    
    loft.Build(new oc.Message_ProgressRange_1());
    
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
    pipe.Build(new oc.Message_ProgressRange_1());
    
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
    // Set schema to AP214 for best compatibility with other CAD software
    oc.Interface_Static.SetCVal("write.step.schema", "AP214");
    
    // Set other STEP export options for quality
    oc.Interface_Static.SetIVal("write.step.assembly", 0);  // Single part
    oc.Interface_Static.SetCVal("write.step.product.name", "AmeriCAD Export");
    
    const writer = new oc.STEPControl_Writer_1();
    
    // Transfer shape - use ManifoldSolidBrep for solid geometry
    const status = writer.Transfer(
        shape, 
        oc.STEPControl_StepModelType.STEPControl_AsIs, 
        true, 
        new oc.Message_ProgressRange_1()
    );
    
    if (status !== oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
        throw new Error('STEP transfer failed');
    }
    
    // Write to virtual file system
    const filename = '/output.step';
    const writeStatus = writer.Write(filename);
    
    if (writeStatus !== oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
        throw new Error('STEP write failed');
    }
    
    // Read file content
    const content = oc.FS.readFile(filename, { encoding: 'utf8' });
    oc.FS.unlink(filename);
    
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
 */
function exportSTL(shape) {
    // Tessellate first
    new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.5, true);
    
    const writer = new oc.StlAPI_Writer();
    writer.SetASCIIMode(true);
    
    const filename = '/output.stl';
    writer.Write(shape, filename, new oc.Message_ProgressRange_1());
    
    const content = oc.FS.readFile(filename, { encoding: 'utf8' });
    oc.FS.unlink(filename);
    
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
                result = { content: exportSTL(stlShape), format: 'stl' };
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
