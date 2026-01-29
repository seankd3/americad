import * as THREE from 'three';

function checkManifold(mesh) {
    const geometry = mesh.geometry;
    const position = geometry.attributes.position;
    const index = geometry.index;
    
    const edgeSet = new Set();
    const vertexSet = new Set();
    let faceCount = 0;
    
    const roundVertex = (v) => {
        return `${v.x.toFixed(6)},${v.y.toFixed(6)},${v.z.toFixed(6)}`;
    };
    
    const makeEdgeKey = (vKey1, vKey2) => {
        return vKey1 < vKey2 ? `${vKey1}|${vKey2}` : `${vKey2}|${vKey1}`;
    };
    
    if (index) {
        for (let i = 0; i < index.count; i += 3) {
            const i0 = index.getX(i);
            const i1 = index.getX(i + 1);
            const i2 = index.getX(i + 2);
            
            const v0 = new THREE.Vector3().fromBufferAttribute(position, i0);
            const v1 = new THREE.Vector3().fromBufferAttribute(position, i1);
            const v2 = new THREE.Vector3().fromBufferAttribute(position, i2);
            
            const vKey0 = roundVertex(v0);
            const vKey1 = roundVertex(v1);
            const vKey2 = roundVertex(v2);
            
            vertexSet.add(vKey0);
            vertexSet.add(vKey1);
            vertexSet.add(vKey2);
            
            edgeSet.add(makeEdgeKey(vKey0, vKey1));
            edgeSet.add(makeEdgeKey(vKey1, vKey2));
            edgeSet.add(makeEdgeKey(vKey2, vKey0));
            
            faceCount++;
        }
    }
    
    const V = vertexSet.size;
    const E = edgeSet.size;
    const F = faceCount;
    const euler = V - E + F;
    
    return { V, E, F, euler, isManifold: euler === 2 };
}

// Test sphere
const sphereGeom = new THREE.SphereGeometry(1, 16, 8);
const sphereMesh = new THREE.Mesh(sphereGeom);
console.log('Sphere (16, 8):', checkManifold(sphereMesh));

// Test cylinder
const cylGeom = new THREE.CylinderGeometry(1, 1, 2, 16);
const cylMesh = new THREE.Mesh(cylGeom);
console.log('Cylinder (16 segments):', checkManifold(cylMesh));

// Test box
const boxGeom = new THREE.BoxGeometry(1, 1, 1);
const boxMesh = new THREE.Mesh(boxGeom);
console.log('Box:', checkManifold(boxMesh));

// Check actual vertex positions for seam issues
console.log('\nSphere vertex analysis:');
const sp = sphereGeom.attributes.position;
const seenPos = {};
for (let i = 0; i < sp.count; i++) {
    const key = `${sp.getX(i).toFixed(6)},${sp.getY(i).toFixed(6)},${sp.getZ(i).toFixed(6)}`;
    seenPos[key] = (seenPos[key] || 0) + 1;
}
const dups = Object.entries(seenPos).filter(([k, v]) => v > 1);
console.log('Duplicate positions:', dups.length);
if (dups.length > 0 && dups.length < 20) {
    dups.forEach(([k, v]) => console.log(`  ${k}: ${v}x`));
}
