/**
 * Ameri-CAD Document Model API Tests
 * Tests for both addFeature() and addBody() APIs
 * Verifies backward compatibility layer for command system
 */

import {
    DocumentModel,
    Feature,
    BoxFeature,
    CylinderFeature,
    SphereFeature,
    ConeFeature,
    BooleanFeature
} from '../src/state/document.js';

// Export for runner compatibility
window.DocumentModel = DocumentModel;
window.BoxFeature = BoxFeature;
window.BooleanFeature = BooleanFeature;

describe('DocumentModel - addFeature API', function() {
    
    it('should add a feature and return it', function() {
        const doc = new DocumentModel();
        const box = new BoxFeature({ width: 10, height: 20, depth: 30 });
        
        const result = doc.addFeature(box);
        
        expect(result).to.equal(box);
        expect(doc.features.size).to.equal(1);
        expect(doc.getFeature(box.id)).to.equal(box);
    });
    
    it('should add feature to rootFeatures when no dependencies', function() {
        const doc = new DocumentModel();
        const box = new BoxFeature({});
        
        doc.addFeature(box);
        
        expect(doc.rootFeatures).to.include(box.id);
    });
    
    it('should update children list for dependent features', function() {
        const doc = new DocumentModel();
        const box = new BoxFeature({});
        const sphere = new SphereFeature({});
        
        doc.addFeature(box);
        doc.addFeature(sphere);
        
        const booleanOp = new BooleanFeature('union', box.id, sphere.id);
        doc.addFeature(booleanOp);
        
        expect(box.children).to.include(booleanOp.id);
        expect(sphere.children).to.include(booleanOp.id);
    });
    
    it('should trigger onFeatureAdded callback', function() {
        const doc = new DocumentModel();
        let callbackFired = false;
        let addedFeature = null;
        
        doc.onFeatureAdded = (feature) => {
            callbackFired = true;
            addedFeature = feature;
        };
        
        const box = new BoxFeature({});
        doc.addFeature(box);
        
        expect(callbackFired).to.be.true;
        expect(addedFeature).to.equal(box);
    });
});

describe('DocumentModel - addBody API (Command System Compatibility)', function() {
    
    it('should add a body and return body-compatible object', function() {
        const doc = new DocumentModel();
        
        const result = doc.addBody('kernel_123', {
            type: 'box',
            params: { width: 10, height: 20, depth: 30 },
            mesh: { fake: 'mesh' }
        });
        
        expect(result).to.be.an('object');
        expect(result.id).to.be.a('string');
        expect(result.type).to.equal('box');
        expect(result.name).to.match(/BOX_/);
        expect(doc.features.size).to.equal(1);
    });
    
    it('should use provided name if given', function() {
        const doc = new DocumentModel();
        
        const result = doc.addBody('kernel_456', {
            type: 'cylinder',
            name: 'MyCustomCylinder',
            params: { radius: 5, height: 10 }
        });
        
        expect(result.name).to.equal('MyCustomCylinder');
    });
    
    it('should generate sequential names', function() {
        const doc = new DocumentModel();
        
        const body1 = doc.addBody('k1', { type: 'box' });
        const body2 = doc.addBody('k2', { type: 'sphere' });
        const body3 = doc.addBody('k3', { type: 'cylinder' });
        
        expect(body1.name).to.match(/BOX_001/);
        expect(body2.name).to.match(/SPHERE_002/);
        expect(body3.name).to.match(/CYLINDER_003/);
    });
    
    it('should be retrievable via getBody', function() {
        const doc = new DocumentModel();
        
        const added = doc.addBody('k789', {
            type: 'cone',
            params: { radius1: 5, radius2: 2, height: 10 }
        });
        
        const retrieved = doc.getBody(added.id);
        
        expect(retrieved).to.be.an('object');
        expect(retrieved.id).to.equal(added.id);
        expect(retrieved.name).to.equal(added.name);
        expect(retrieved.type).to.equal('cone');
    });
    
    it('should return undefined for non-existent body', function() {
        const doc = new DocumentModel();
        
        const result = doc.getBody('nonexistent_id');
        
        expect(result).to.be.undefined;
    });
    
    it('should be removable via removeBody', function() {
        const doc = new DocumentModel();
        
        const body = doc.addBody('k999', { type: 'box' });
        expect(doc.features.size).to.equal(1);
        
        doc.removeBody(body.id);
        
        expect(doc.features.size).to.equal(0);
        expect(doc.getBody(body.id)).to.be.undefined;
    });
    
    it('should return all bodies via getAllBodies', function() {
        const doc = new DocumentModel();
        
        doc.addBody('k1', { type: 'box' });
        doc.addBody('k2', { type: 'sphere' });
        doc.addBody('k3', { type: 'cylinder' });
        
        const allBodies = doc.getAllBodies();
        
        expect(allBodies).to.be.an('array');
        expect(allBodies.length).to.equal(3);
    });
    
    it('should filter bodies by type via getBodiesByType', function() {
        const doc = new DocumentModel();
        
        doc.addBody('k1', { type: 'box' });
        doc.addBody('k2', { type: 'sphere' });
        doc.addBody('k3', { type: 'box' });
        doc.addBody('k4', { type: 'cylinder' });
        
        const boxes = doc.getBodiesByType('box');
        const spheres = doc.getBodiesByType('sphere');
        
        expect(boxes.length).to.equal(2);
        expect(spheres.length).to.equal(1);
        expect(boxes.every(b => b.type === 'box')).to.be.true;
    });
    
    it('should trigger onFeatureAdded callback', function() {
        const doc = new DocumentModel();
        let callbackFired = false;
        
        doc.onFeatureAdded = (feature) => {
            callbackFired = true;
        };
        
        doc.addBody('k100', { type: 'box' });
        
        expect(callbackFired).to.be.true;
    });
    
    it('should trigger onDocumentChanged callback', function() {
        const doc = new DocumentModel();
        let changedCount = 0;
        
        doc.onDocumentChanged = () => {
            changedCount++;
        };
        
        doc.addBody('k1', { type: 'box' });
        doc.addBody('k2', { type: 'sphere' });
        
        expect(changedCount).to.equal(2);
    });
});

describe('DocumentModel - API Interoperability', function() {
    
    it('should allow mixing addFeature and addBody', function() {
        const doc = new DocumentModel();
        
        // Add via addFeature
        const box = new BoxFeature({ width: 10 });
        doc.addFeature(box);
        
        // Add via addBody
        const body = doc.addBody('k1', { type: 'sphere', params: { radius: 5 } });
        
        expect(doc.features.size).to.equal(2);
        
        // Both should be retrievable
        expect(doc.getFeature(box.id)).to.equal(box);
        expect(doc.getBody(body.id)).to.be.an('object');
        
        // getAllBodies should return both
        const allBodies = doc.getAllBodies();
        expect(allBodies.length).to.equal(2);
    });
    
    it('should allow clear() to reset both APIs', function() {
        const doc = new DocumentModel();
        
        doc.addFeature(new BoxFeature({}));
        doc.addBody('k1', { type: 'sphere' });
        
        expect(doc.features.size).to.equal(2);
        
        doc.clear();
        
        expect(doc.features.size).to.equal(0);
        expect(doc.getAllBodies().length).to.equal(0);
    });
    
    it('body added via addBody should have feature reference', function() {
        const doc = new DocumentModel();
        
        const body = doc.addBody('k1', { type: 'box', params: { width: 10 } });
        
        expect(body.feature).to.be.an('object');
        expect(body.feature.id).to.equal(body.id);
        expect(body.feature.type).to.equal('box');
    });
});

describe('DocumentModel - Boolean Operations with Bodies', function() {
    
    it('should support boolean operations on bodies added via addBody', function() {
        const doc = new DocumentModel();
        
        // Add base bodies via command-style API
        const body1 = doc.addBody('k1', { type: 'box', params: { width: 10 } });
        const body2 = doc.addBody('k2', { type: 'cylinder', params: { radius: 5, height: 15 } });
        
        // Create boolean using Feature API
        const booleanOp = new BooleanFeature('subtract', body1.id, body2.id, { name: 'Cut' });
        doc.addFeature(booleanOp);
        
        expect(doc.features.size).to.equal(3);
        expect(booleanOp.dependencies).to.include(body1.id);
        expect(booleanOp.dependencies).to.include(body2.id);
    });
});

describe('DocumentModel - Feature Tree Population', function() {
    
    it('should populate rootFeatures correctly with addBody', function() {
        const doc = new DocumentModel();
        
        const body1 = doc.addBody('k1', { type: 'box' });
        const body2 = doc.addBody('k2', { type: 'sphere' });
        
        expect(doc.rootFeatures.length).to.equal(2);
        expect(doc.rootFeatures).to.include(body1.id);
        expect(doc.rootFeatures).to.include(body2.id);
    });
    
    it('should maintain topological order with mixed APIs', function() {
        const doc = new DocumentModel();
        
        // Add bodies
        const body1 = doc.addBody('k1', { type: 'box' });
        const body2 = doc.addBody('k2', { type: 'sphere' });
        
        // Add boolean that depends on bodies
        const booleanOp = new BooleanFeature('union', body1.id, body2.id);
        doc.addFeature(booleanOp);
        
        const order = doc.getTopologicalOrder();
        
        // Bodies should come before the boolean operation
        const idx1 = order.indexOf(body1.id);
        const idx2 = order.indexOf(body2.id);
        const idxBool = order.indexOf(booleanOp.id);
        
        expect(idx1).to.be.lessThan(idxBool);
        expect(idx2).to.be.lessThan(idxBool);
    });
});
