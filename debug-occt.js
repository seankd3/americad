#!/usr/bin/env node
/**
 * Debug script to discover OCCT.js API signatures
 * Run with: node debug-occt.js
 */

import opencascadeInit from './lib/opencascade/opencascade.wasm.js';

async function main() {
    console.log('Initializing OpenCASCADE...\n');
    
    const oc = await opencascadeInit({
        locateFile: (file) => `./lib/opencascade/${file}`
    });
    
    console.log('=== BOOLEAN OPERATIONS ===\n');
    
    // Check BRepAlgoAPI_Fuse variants
    const fuseVariants = Object.keys(oc).filter(k => k.includes('BRepAlgoAPI_Fuse')).sort();
    console.log('BRepAlgoAPI_Fuse variants:', fuseVariants);
    
    // Check BRepAlgoAPI_Cut variants
    const cutVariants = Object.keys(oc).filter(k => k.includes('BRepAlgoAPI_Cut')).sort();
    console.log('BRepAlgoAPI_Cut variants:', cutVariants);
    
    // Check BRepAlgoAPI_Common variants
    const commonVariants = Object.keys(oc).filter(k => k.includes('BRepAlgoAPI_Common')).sort();
    console.log('BRepAlgoAPI_Common variants:', commonVariants);
    
    console.log('\n=== PRIMITIVES ===\n');
    
    // Check MakeTorus variants
    const torusVariants = Object.keys(oc).filter(k => k.includes('MakeTorus')).sort();
    console.log('MakeTorus variants:', torusVariants);
    
    // Check MakeWedge variants
    const wedgeVariants = Object.keys(oc).filter(k => k.includes('MakeWedge')).sort();
    console.log('MakeWedge variants:', wedgeVariants);
    
    console.log('\n=== STL EXPORT ===\n');
    
    // Check StlAPI_Writer methods
    const stlWriterKeys = Object.keys(oc).filter(k => k.includes('StlAPI')).sort();
    console.log('StlAPI classes:', stlWriterKeys);
    
    // Check StlAPI_Writer prototype if exists
    if (oc.StlAPI_Writer) {
        const writer = new oc.StlAPI_Writer();
        const writerMethods = [];
        for (const key in writer) {
            if (typeof writer[key] === 'function') {
                writerMethods.push(key);
            }
        }
        console.log('StlAPI_Writer methods:', writerMethods.sort());
    }
    
    console.log('\n=== TESTING BOOLEAN OPERATION ===\n');
    
    // Create two boxes
    const p1 = new oc.gp_Pnt_3(0, 0, 0);
    const p2 = new oc.gp_Pnt_3(20, 20, 20);
    const box1 = new oc.BRepPrimAPI_MakeBox_3(p1, p2).Shape();
    
    const p3 = new oc.gp_Pnt_3(10, 10, 10);
    const p4 = new oc.gp_Pnt_3(30, 30, 30);
    const box2 = new oc.BRepPrimAPI_MakeBox_3(p3, p4).Shape();
    
    console.log('Box1 created:', !box1.IsNull());
    console.log('Box2 created:', !box2.IsNull());
    
    // Try _1 constructor (no args, then set shapes)
    try {
        console.log('\nTrying BRepAlgoAPI_Fuse_1 (builder pattern)...');
        const fuse = new oc.BRepAlgoAPI_Fuse_1();
        // Check what methods are available
        const fuseMethods = [];
        for (const key in fuse) {
            if (typeof fuse[key] === 'function') {
                fuseMethods.push(key);
            }
        }
        console.log('Fuse methods:', fuseMethods.sort().slice(0, 30));
        
        // Try to set shapes and build
        if (fuse.SetArguments) {
            console.log('Has SetArguments method');
        }
        if (fuse.SetTools) {
            console.log('Has SetTools method');
        }
    } catch (e) {
        console.log('_1 failed:', e.message);
    }
    
    // Try _2 with (shape, shape)
    try {
        console.log('\nTrying BRepAlgoAPI_Fuse_2(shape, shape)...');
        const fuse2 = new oc.BRepAlgoAPI_Fuse_2(box1, box2);
        console.log('Created! IsDone:', fuse2.IsDone());
        if (!fuse2.IsDone()) {
            fuse2.Build(new oc.Message_ProgressRange_1());
        }
        console.log('After Build IsDone:', fuse2.IsDone());
    } catch (e) {
        console.log('_2(shape, shape) failed:', e.message);
    }
    
    // Try _3 if exists
    try {
        console.log('\nTrying BRepAlgoAPI_Fuse_3...');
        const fuse3 = new oc.BRepAlgoAPI_Fuse_3(box1, box2, new oc.Message_ProgressRange_1());
        console.log('Created! IsDone:', fuse3.IsDone());
    } catch (e) {
        console.log('_3 failed:', e.message);
    }
    
    console.log('\n=== TESTING TORUS ===\n');
    
    // Try torus variants
    const axis = new oc.gp_Ax2_3(
        new oc.gp_Pnt_3(0, 0, 0),
        new oc.gp_Dir_4(0, 0, 1)
    );
    
    try {
        console.log('Trying BRepPrimAPI_MakeTorus_1...');
        const t1 = new oc.BRepPrimAPI_MakeTorus_1(20, 5);
        console.log('Success! Shape:', !t1.Shape().IsNull());
    } catch (e) {
        console.log('_1 failed:', e.message);
    }
    
    try {
        console.log('Trying BRepPrimAPI_MakeTorus_2(R1, R2, angle)...');
        const t2 = new oc.BRepPrimAPI_MakeTorus_2(20, 5, 2 * Math.PI);
        console.log('Success! Shape:', !t2.Shape().IsNull());
    } catch (e) {
        console.log('_2 failed:', e.message);
    }
    
    try {
        console.log('Trying BRepPrimAPI_MakeTorus_3(Ax2, R1, R2)...');
        const t3 = new oc.BRepPrimAPI_MakeTorus_3(axis, 20, 5);
        console.log('Success! Shape:', !t3.Shape().IsNull());
    } catch (e) {
        console.log('_3 failed:', e.message);
    }
    
    try {
        console.log('Trying BRepPrimAPI_MakeTorus_4(Ax2, R1, R2, angle)...');
        const t4 = new oc.BRepPrimAPI_MakeTorus_4(axis, 20, 5, 2 * Math.PI);
        console.log('Success! Shape:', !t4.Shape().IsNull());
    } catch (e) {
        console.log('_4 failed:', e.message);
    }
    
    console.log('\n=== TESTING WEDGE ===\n');
    
    try {
        console.log('Trying BRepPrimAPI_MakeWedge_1(dx, dy, dz, ltx)...');
        const w1 = new oc.BRepPrimAPI_MakeWedge_1(20, 20, 10, 5);
        console.log('Success! Shape:', !w1.Shape().IsNull());
    } catch (e) {
        console.log('_1 failed:', e.message);
    }
    
    try {
        console.log('Trying BRepPrimAPI_MakeWedge_2(Ax2, dx, dy, dz, ltx)...');
        const w2 = new oc.BRepPrimAPI_MakeWedge_2(axis, 20, 20, 10, 5);
        console.log('Success! Shape:', !w2.Shape().IsNull());
    } catch (e) {
        console.log('_2 failed:', e.message);
    }
    
    try {
        console.log('Trying BRepPrimAPI_MakeWedge_3(Ax2, dx, dy, dz, xmin, zmin, xmax, zmax)...');
        const w3 = new oc.BRepPrimAPI_MakeWedge_3(axis, 20, 20, 10, 0, 0, 5, 10);
        console.log('Success! Shape:', !w3.Shape().IsNull());
    } catch (e) {
        console.log('_3 failed:', e.message);
    }
    
    console.log('\n=== DONE ===');
}

main().catch(console.error);
