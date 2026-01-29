/**
 * AMERICA-D Geometry Kernel Worker
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
            
            // Extract normals (computed from triangulation)
            for (let i = 1; i <= nbNodes; i++) {
                // Simplified - compute from face normal
                // In production, use proper per-vertex normals
                normals.push(0, 1, 0); // Placeholder
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
    // Create box at origin then translate
    // BRepPrimAPI_MakeBox_2 takes (dx, dy, dz)
    const boxMaker = new oc.BRepPrimAPI_MakeBox_2(width, height, depth);
    let box = boxMaker.Shape();
    
    // Translate to center if not at origin
    if (center.x !== 0 || center.y !== 0 || center.z !== 0) {
        const trsf = new oc.gp_Trsf_1();
        trsf.SetTranslation_1(new oc.gp_Vec_4(
            center.x - width/2,
            center.y - height/2,
            center.z - depth/2
        ));
        const transform = new oc.BRepBuilderAPI_Transform_2(box, trsf, true);
        box = transform.Shape();
    }
    
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
 */
function createCone(radius1, radius2, height, center = { x: 0, y: 0, z: 0 }) {
    const axis = new oc.gp_Ax2_3(
        new oc.gp_Pnt_3(center.x, center.y, center.z),
        new oc.gp_Dir_4(0, 0, 1)
    );
    
    const cone = new oc.BRepPrimAPI_MakeCone_4(axis, radius1, radius2, height).Shape();
    
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
 * Export to STEP format
 */
function exportSTEP(shape) {
    const writer = new oc.STEPControl_Writer_1();
    writer.Transfer(shape, oc.STEPControl_StepModelType.STEPControl_AsIs, true, new oc.Message_ProgressRange_1());
    
    // Write to virtual file system
    const filename = '/output.step';
    const status = writer.Write(filename);
    
    if (status !== oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
        throw new Error('STEP export failed');
    }
    
    // Read file content
    const content = oc.FS.readFile(filename, { encoding: 'utf8' });
    oc.FS.unlink(filename);
    
    return content;
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
                
            case 'exportSTEP':
                const stepShape = shapes.get(params.id);
                result = { content: exportSTEP(stepShape), format: 'step' };
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
