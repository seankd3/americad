/**
 * Ameri-CAD Feature Suppression Tests
 * Tests for feature suppression functionality
 */

import {
    DocumentModel,
    BoxFeature,
    CylinderFeature,
    BooleanFeature,
    Feature
} from '../src/state/document.js';

import { EventTypes, EventStore, createEvent } from '../src/state/event-store.js';

import { serialize, deserialize } from '../src/io/file-format.js';

// Export for runner compatibility
window.DocumentModel = DocumentModel;
window.BoxFeature = BoxFeature;
window.CylinderFeature = CylinderFeature;
window.BooleanFeature = BooleanFeature;
window.Feature = Feature;
window.EventTypes = EventTypes;
window.EventStore = EventStore;
window.createEvent = createEvent;
window.serialize = serialize;
window.deserialize = deserialize;

describe('Feature Suppression', function() {
    
    describe('Feature.suppressed property', function() {
        
        it('should default to false', function() {
            const feature = new BoxFeature({ width: 10, height: 10, depth: 10 });
            expect(feature.suppressed).to.be.false;
        });
        
        it('should be settable', function() {
            const feature = new BoxFeature({ width: 10, height: 10, depth: 10 });
            feature.suppressed = true;
            expect(feature.suppressed).to.be.true;
        });
        
        it('should serialize suppressed state in toJSON', function() {
            const feature = new BoxFeature({ width: 10, height: 10, depth: 10 });
            feature.suppressed = true;
            
            const json = feature.toJSON();
            expect(json.suppressed).to.be.true;
        });
        
        it('should serialize unsuppressed state in toJSON', function() {
            const feature = new BoxFeature({ width: 10, height: 10, depth: 10 });
            
            const json = feature.toJSON();
            expect(json.suppressed).to.be.false;
        });
    });
    
    describe('DocumentModel.setSuppression', function() {
        let doc;
        
        beforeEach(function() {
            doc = new DocumentModel();
        });
        
        it('should set suppression state on a feature', function() {
            const feature = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(feature);
            
            doc.setSuppression(feature.id, true);
            
            expect(feature.suppressed).to.be.true;
        });
        
        it('should update modifiedAt timestamp', function() {
            const feature = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(feature);
            const beforeTime = feature.modifiedAt;
            
            // Small delay to ensure timestamp difference
            doc.setSuppression(feature.id, true);
            
            expect(feature.modifiedAt).to.be.at.least(beforeTime);
        });
        
        it('should return null for non-existent feature', function() {
            const result = doc.setSuppression('nonexistent', true);
            expect(result).to.be.null;
        });
        
        it('should trigger onFeatureModified callback', function() {
            let callbackCalled = false;
            let modifiedFeature = null;
            
            doc.onFeatureModified = (feature) => {
                callbackCalled = true;
                modifiedFeature = feature;
            };
            
            const feature = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(feature);
            doc.setSuppression(feature.id, true);
            
            expect(callbackCalled).to.be.true;
            expect(modifiedFeature).to.equal(feature);
        });
    });
    
    describe('DocumentModel.isEffectivelySuppressed', function() {
        let doc;
        
        beforeEach(function() {
            doc = new DocumentModel();
        });
        
        it('should return true for directly suppressed feature', function() {
            const feature = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(feature);
            feature.suppressed = true;
            
            expect(doc.isEffectivelySuppressed(feature.id)).to.be.true;
        });
        
        it('should return false for unsuppressed feature', function() {
            const feature = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(feature);
            
            expect(doc.isEffectivelySuppressed(feature.id)).to.be.false;
        });
        
        it('should return true if parent is suppressed', function() {
            // Create parent box
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(box);
            
            // Create dependent cylinder
            const cylinder = new CylinderFeature({ radius: 5, height: 10 });
            doc.addFeature(cylinder);
            
            // Create boolean that depends on both
            const boolFeature = new BooleanFeature('subtract', box.id, cylinder.id);
            doc.addFeature(boolFeature);
            
            // Suppress the box
            box.suppressed = true;
            
            // The boolean should be effectively suppressed
            expect(doc.isEffectivelySuppressed(boolFeature.id)).to.be.true;
        });
        
        it('should return true if any ancestor is suppressed', function() {
            // Create chain: box -> boolean1 -> boolean2
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(box);
            
            const cylinder1 = new CylinderFeature({ radius: 5, height: 10 });
            doc.addFeature(cylinder1);
            
            const boolean1 = new BooleanFeature('union', box.id, cylinder1.id);
            doc.addFeature(boolean1);
            
            const cylinder2 = new CylinderFeature({ radius: 3, height: 5 });
            doc.addFeature(cylinder2);
            
            const boolean2 = new BooleanFeature('subtract', boolean1.id, cylinder2.id);
            doc.addFeature(boolean2);
            
            // Suppress the root box
            box.suppressed = true;
            
            // Both booleans should be effectively suppressed
            expect(doc.isEffectivelySuppressed(boolean1.id)).to.be.true;
            expect(doc.isEffectivelySuppressed(boolean2.id)).to.be.true;
        });
        
        it('should return false for non-existent feature', function() {
            expect(doc.isEffectivelySuppressed('nonexistent')).to.be.false;
        });
    });
    
    describe('DocumentModel.getEffectivelySuppressedFeatures', function() {
        let doc;
        
        beforeEach(function() {
            doc = new DocumentModel();
        });
        
        it('should return empty array when no features suppressed', function() {
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(box);
            
            const result = doc.getEffectivelySuppressedFeatures();
            expect(result).to.have.length(0);
        });
        
        it('should return directly suppressed features', function() {
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(box);
            box.suppressed = true;
            
            const result = doc.getEffectivelySuppressedFeatures();
            expect(result).to.include(box.id);
        });
        
        it('should return features with suppressed dependencies', function() {
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(box);
            
            const cylinder = new CylinderFeature({ radius: 5, height: 10 });
            doc.addFeature(cylinder);
            
            const boolFeature = new BooleanFeature('subtract', box.id, cylinder.id);
            doc.addFeature(boolFeature);
            
            // Suppress the box
            box.suppressed = true;
            
            const result = doc.getEffectivelySuppressedFeatures();
            expect(result).to.include(box.id);
            expect(result).to.include(boolFeature.id);
            // Cylinder is not dependent on box, so should not be suppressed
            expect(result).to.not.include(cylinder.id);
        });
    });
    
    describe('DocumentModel.suppressAll / unsuppressAll', function() {
        let doc;
        
        beforeEach(function() {
            doc = new DocumentModel();
        });
        
        it('should suppress all features', function() {
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            const cylinder = new CylinderFeature({ radius: 5, height: 10 });
            doc.addFeature(box);
            doc.addFeature(cylinder);
            
            doc.suppressAll();
            
            expect(box.suppressed).to.be.true;
            expect(cylinder.suppressed).to.be.true;
        });
        
        it('should unsuppress all features', function() {
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            const cylinder = new CylinderFeature({ radius: 5, height: 10 });
            doc.addFeature(box);
            doc.addFeature(cylinder);
            box.suppressed = true;
            cylinder.suppressed = true;
            
            doc.unsuppressAll();
            
            expect(box.suppressed).to.be.false;
            expect(cylinder.suppressed).to.be.false;
        });
        
        it('should trigger onDocumentChanged callback', function() {
            let callCount = 0;
            doc.onDocumentChanged = () => callCount++;
            
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(box);
            
            const beforeCount = callCount;
            doc.suppressAll();
            
            expect(callCount).to.be.greaterThan(beforeCount);
        });
    });
    
    describe('Event Sourcing - FEATURE_SUPPRESSION_CHANGED', function() {
        let doc;
        let store;
        
        beforeEach(function() {
            doc = new DocumentModel();
            store = new EventStore();
            doc.syncWithEventStore(store);
        });
        
        it('should have FEATURE_SUPPRESSION_CHANGED event type', function() {
            expect(EventTypes.FEATURE_SUPPRESSION_CHANGED).to.equal('feature_suppression_changed');
        });
        
        it('should apply suppression event', function() {
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(box);
            
            const event = createEvent(EventTypes.FEATURE_SUPPRESSION_CHANGED, {
                featureId: box.id,
                suppressed: true
            });
            
            doc.applyEvent(event, false);
            
            expect(box.suppressed).to.be.true;
        });
        
        it('should emit event via setSuppressionWithEvent', function() {
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(box);
            
            let appendedEvent = null;
            store.on('eventAppended', (event) => {
                appendedEvent = event;
            });
            
            doc.setSuppressionWithEvent(box.id, true, store);
            
            expect(appendedEvent).to.not.be.null;
            expect(appendedEvent.type).to.equal(EventTypes.FEATURE_SUPPRESSION_CHANGED);
            expect(appendedEvent.payload.suppressed).to.be.true;
        });
    });
    
    describe('File Format - Suppression Serialization', function() {
        let doc;
        
        beforeEach(function() {
            doc = new DocumentModel();
        });
        
        it('should serialize suppressed state', function() {
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(box);
            box.suppressed = true;
            
            const json = serialize(doc);
            const parsed = JSON.parse(json);
            
            const serializedFeature = parsed.features.find(f => f.id === box.id);
            expect(serializedFeature.suppressed).to.be.true;
        });
        
        it('should deserialize suppressed state', function() {
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(box);
            box.suppressed = true;
            
            const json = serialize(doc);
            const loadedDoc = deserialize(json);
            
            const loadedFeature = loadedDoc.getFeature(box.id);
            expect(loadedFeature.suppressed).to.be.true;
        });
        
        it('should deserialize unsuppressed state (default)', function() {
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(box);
            // Not setting suppressed, should default to false
            
            const json = serialize(doc);
            const loadedDoc = deserialize(json);
            
            const loadedFeature = loadedDoc.getFeature(box.id);
            expect(loadedFeature.suppressed).to.be.false;
        });
        
        it('should handle legacy files without suppressed field', function() {
            // Simulate a legacy file without suppressed field
            const legacyJson = {
                version: '1.0',
                name: 'Legacy Document',
                features: [
                    {
                        id: 'feature_1',
                        type: 'box',
                        params: { width: 10, height: 10, depth: 10 },
                        dependencies: [],
                        name: 'BOX_001',
                        visible: true
                        // No 'suppressed' field
                    }
                ]
            };
            
            const loadedDoc = deserialize(legacyJson);
            const loadedFeature = loadedDoc.getFeature('feature_1');
            
            expect(loadedFeature.suppressed).to.be.false;
        });
    });
    
    describe('DocumentModel.createFeatureFromJSON', function() {
        
        it('should restore suppressed state from JSON', function() {
            const data = {
                id: 'feature_test',
                type: 'box',
                params: { width: 10, height: 10, depth: 10 },
                dependencies: [],
                name: 'TestBox',
                visible: true,
                suppressed: true
            };
            
            const feature = DocumentModel.createFeatureFromJSON(data);
            expect(feature.suppressed).to.be.true;
        });
        
        it('should default suppressed to false if not in JSON', function() {
            const data = {
                id: 'feature_test',
                type: 'box',
                params: { width: 10, height: 10, depth: 10 },
                dependencies: [],
                name: 'TestBox',
                visible: true
                // No suppressed field
            };
            
            const feature = DocumentModel.createFeatureFromJSON(data);
            expect(feature.suppressed).to.be.false;
        });
    });
    
    describe('Dependent Feature Handling', function() {
        let doc;
        
        beforeEach(function() {
            doc = new DocumentModel();
        });
        
        it('should propagate effective suppression through dependency chain', function() {
            // Build: box -> union(box, cyl1) -> subtract(union, cyl2)
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(box);
            
            const cyl1 = new CylinderFeature({ radius: 5, height: 10 });
            doc.addFeature(cyl1);
            
            const union = new BooleanFeature('union', box.id, cyl1.id);
            doc.addFeature(union);
            
            const cyl2 = new CylinderFeature({ radius: 3, height: 5 });
            doc.addFeature(cyl2);
            
            const subtract = new BooleanFeature('subtract', union.id, cyl2.id);
            doc.addFeature(subtract);
            
            // Initially nothing suppressed
            expect(doc.isEffectivelySuppressed(subtract.id)).to.be.false;
            
            // Suppress the root box
            box.suppressed = true;
            
            // union depends on box, so effectively suppressed
            expect(doc.isEffectivelySuppressed(union.id)).to.be.true;
            // subtract depends on union, so effectively suppressed
            expect(doc.isEffectivelySuppressed(subtract.id)).to.be.true;
            // cyl1 and cyl2 are not dependent on box, so not suppressed
            expect(doc.isEffectivelySuppressed(cyl1.id)).to.be.false;
            expect(doc.isEffectivelySuppressed(cyl2.id)).to.be.false;
        });
        
        it('should unsuppress when parent unsuppressed', function() {
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            doc.addFeature(box);
            
            const cyl = new CylinderFeature({ radius: 5, height: 10 });
            doc.addFeature(cyl);
            
            const boolFeature = new BooleanFeature('subtract', box.id, cyl.id);
            doc.addFeature(boolFeature);
            
            // Suppress then unsuppress
            box.suppressed = true;
            expect(doc.isEffectivelySuppressed(boolFeature.id)).to.be.true;
            
            box.suppressed = false;
            expect(doc.isEffectivelySuppressed(boolFeature.id)).to.be.false;
        });
    });
});
