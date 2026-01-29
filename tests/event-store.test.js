/**
 * Ameri-CAD Event Store Tests
 * Tests for event sourcing from src/state/event-store.js
 * and DocumentModel event sourcing integration
 */

import {
    EventStore,
    EventTypes,
    createEvent,
    eventStore
} from '../src/state/event-store.js';

import {
    DocumentModel,
    Feature,
    BoxFeature,
    CylinderFeature,
    resetFeatureIdCounter
} from '../src/state/document.js';

// Export for runner compatibility
window.EventStore = EventStore;
window.EventTypes = EventTypes;

describe('EventStore', function() {
    let store;
    
    beforeEach(function() {
        store = new EventStore();
    });
    
    describe('Basic Event Operations', function() {
        
        it('should start empty', function() {
            expect(store.getVersion()).to.equal(0);
            expect(store.getEventCount()).to.equal(0);
            expect(store.canUndo()).to.be.false;
            expect(store.canRedo()).to.be.false;
        });
        
        it('should append events with version and timestamp', function() {
            const event = createEvent(EventTypes.FEATURE_ADDED, {
                featureId: 'feature_1',
                feature: { id: 'feature_1', type: 'box' }
            });
            
            const appended = store.append(event);
            
            expect(appended.version).to.equal(1);
            expect(appended.timestamp).to.be.a('number');
            expect(store.getVersion()).to.equal(1);
            expect(store.getEventCount()).to.equal(1);
        });
        
        it('should increment version on each append', function() {
            store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: '1' }));
            store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: '2' }));
            store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: '3' }));
            
            expect(store.getVersion()).to.equal(3);
            expect(store.getEventCount()).to.equal(3);
        });
        
        it('should get events from a specific version', function() {
            store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: '1' }));
            store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: '2' }));
            store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: '3' }));
            
            const allEvents = store.getEvents(0);
            expect(allEvents.length).to.equal(3);
            
            const eventsFromV1 = store.getEvents(1);
            expect(eventsFromV1.length).to.equal(2);
            expect(eventsFromV1[0].payload.featureId).to.equal('2');
            
            const eventsFromV2 = store.getEvents(2);
            expect(eventsFromV2.length).to.equal(1);
            expect(eventsFromV2[0].payload.featureId).to.equal('3');
        });
        
        it('should get events in a version range', function() {
            for (let i = 1; i <= 5; i++) {
                store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: String(i) }));
            }
            
            const range = store.getEventsInRange(1, 3);
            expect(range.length).to.equal(2);
            expect(range[0].version).to.equal(2);
            expect(range[1].version).to.equal(3);
        });
        
        it('should get events for a specific feature', function() {
            store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: 'f1' }));
            store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: 'f2' }));
            store.append(createEvent(EventTypes.PARAM_CHANGED, { featureId: 'f1', paramName: 'width' }));
            store.append(createEvent(EventTypes.FEATURE_DELETED, { featureId: 'f2' }));
            
            const f1Events = store.getEventsForFeature('f1');
            expect(f1Events.length).to.equal(2);
            
            const f2Events = store.getEventsForFeature('f2');
            expect(f2Events.length).to.equal(2);
        });
        
        it('should emit eventAppended on append', function() {
            let emittedEvent = null;
            store.on('eventAppended', (event) => {
                emittedEvent = event;
            });
            
            const event = createEvent(EventTypes.FEATURE_ADDED, { featureId: 'test' });
            store.append(event);
            
            expect(emittedEvent).to.not.be.null;
            expect(emittedEvent.version).to.equal(1);
        });
    });
    
    describe('Batch Operations', function() {
        
        it('should append multiple events atomically', function() {
            const events = [
                createEvent(EventTypes.FEATURE_ADDED, { featureId: '1' }),
                createEvent(EventTypes.FEATURE_ADDED, { featureId: '2' }),
                createEvent(EventTypes.FEATURE_ADDED, { featureId: '3' })
            ];
            
            const appended = store.appendBatch(events);
            
            expect(appended.length).to.equal(3);
            expect(store.getVersion()).to.equal(3);
            expect(appended[0].version).to.equal(1);
            expect(appended[1].version).to.equal(2);
            expect(appended[2].version).to.equal(3);
        });
        
        it('should emit batchAppended for batch operations', function() {
            let emittedBatch = null;
            let startVersion = null;
            
            store.on('batchAppended', (events, sVersion) => {
                emittedBatch = events;
                startVersion = sVersion;
            });
            
            store.appendBatch([
                createEvent(EventTypes.FEATURE_ADDED, { featureId: '1' }),
                createEvent(EventTypes.FEATURE_ADDED, { featureId: '2' })
            ]);
            
            expect(emittedBatch).to.not.be.null;
            expect(emittedBatch.length).to.equal(2);
            expect(startVersion).to.equal(0);
        });
    });
    
    describe('Undo/Redo via Truncation', function() {
        
        beforeEach(function() {
            // Setup: add 3 features
            store.append(createEvent(EventTypes.FEATURE_ADDED, { 
                featureId: 'f1', 
                feature: { id: 'f1', type: 'box' } 
            }));
            store.append(createEvent(EventTypes.FEATURE_ADDED, { 
                featureId: 'f2', 
                feature: { id: 'f2', type: 'cylinder' } 
            }));
            store.append(createEvent(EventTypes.FEATURE_ADDED, { 
                featureId: 'f3', 
                feature: { id: 'f3', type: 'sphere' } 
            }));
        });
        
        it('should truncate to a specific version', function() {
            expect(store.getVersion()).to.equal(3);
            
            const removed = store.truncateTo(1);
            
            expect(removed.length).to.equal(2);
            expect(store.getVersion()).to.equal(1);
            expect(store.getEventCount()).to.equal(1);
        });
        
        it('should save removed events to redo buffer', function() {
            store.truncateTo(1);
            
            expect(store.canRedo()).to.be.true;
            expect(store.getRedoCount()).to.equal(2);
        });
        
        it('should undo single event', function() {
            const undone = store.undo();
            
            expect(undone.length).to.equal(1);
            expect(undone[0].payload.featureId).to.equal('f3');
            expect(store.getVersion()).to.equal(2);
        });
        
        it('should undo multiple events', function() {
            const undone = store.undo(2);
            
            expect(undone.length).to.equal(2);
            expect(store.getVersion()).to.equal(1);
        });
        
        it('should redo single event', function() {
            store.undo(2); // Undo f3 and f2
            expect(store.getVersion()).to.equal(1);
            
            const redone = store.redo();
            
            expect(redone.length).to.equal(1);
            expect(store.getVersion()).to.equal(2);
        });
        
        it('should redo multiple events', function() {
            store.undo(2);
            const redone = store.redo(2);
            
            expect(redone.length).to.equal(2);
            expect(store.getVersion()).to.equal(3);
        });
        
        it('should clear redo buffer on new append', function() {
            store.undo();
            expect(store.canRedo()).to.be.true;
            
            store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: 'f4' }));
            
            expect(store.canRedo()).to.be.false;
            expect(store.getRedoCount()).to.equal(0);
        });
        
        it('should peek at undo/redo events', function() {
            const peekUndo = store.peekUndo();
            expect(peekUndo.payload.featureId).to.equal('f3');
            
            store.undo();
            
            const peekRedo = store.peekRedo();
            expect(peekRedo.payload.featureId).to.equal('f3');
        });
        
        it('should emit truncated event on undo', function() {
            let truncatedVersion = null;
            let removedEvents = null;
            
            store.on('truncated', (version, removed) => {
                truncatedVersion = version;
                removedEvents = removed;
            });
            
            store.undo();
            
            expect(truncatedVersion).to.equal(2);
            expect(removedEvents.length).to.equal(1);
        });
        
        it('should emit redone event on redo', function() {
            let redoneEvents = null;
            
            store.on('redone', (events) => {
                redoneEvents = events;
            });
            
            store.undo();
            store.redo();
            
            expect(redoneEvents).to.not.be.null;
            expect(redoneEvents.length).to.equal(1);
        });
    });
    
    describe('Persistence', function() {
        
        it('should create and restore snapshot', function() {
            store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: '1' }));
            store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: '2' }));
            store.undo();
            
            const snapshot = store.toSnapshot();
            
            expect(snapshot.version).to.equal(1);
            expect(snapshot.events.length).to.equal(1);
            expect(snapshot.redoBuffer.length).to.equal(1);
            
            // Create new store and restore
            const newStore = new EventStore();
            newStore.fromSnapshot(snapshot);
            
            expect(newStore.getVersion()).to.equal(1);
            expect(newStore.getEventCount()).to.equal(1);
            expect(newStore.canRedo()).to.be.true;
        });
        
        it('should serialize and deserialize via JSON', function() {
            store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: '1' }));
            store.append(createEvent(EventTypes.PARAM_CHANGED, { 
                featureId: '1', 
                paramName: 'width',
                newValue: 20 
            }));
            
            const json = store.toJSON();
            
            const newStore = new EventStore();
            newStore.fromJSON(json);
            
            expect(newStore.getVersion()).to.equal(2);
            
            const events = newStore.getEvents(0);
            expect(events.length).to.equal(2);
            expect(events[1].payload.newValue).to.equal(20);
        });
    });
    
    describe('Utility Methods', function() {
        
        it('should clear all events', function() {
            store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: '1' }));
            store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: '2' }));
            store.undo();
            
            store.clear();
            
            expect(store.getVersion()).to.equal(0);
            expect(store.getEventCount()).to.equal(0);
            expect(store.canUndo()).to.be.false;
            expect(store.canRedo()).to.be.false;
        });
        
        it('should provide summary', function() {
            store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: '1' }));
            store.append(createEvent(EventTypes.FEATURE_ADDED, { featureId: '2' }));
            store.append(createEvent(EventTypes.PARAM_CHANGED, { featureId: '1' }));
            store.undo();
            
            const summary = store.getSummary();
            
            expect(summary.version).to.equal(2);
            expect(summary.eventCount).to.equal(2);
            expect(summary.redoCount).to.equal(1);
            expect(summary.typeCounts[EventTypes.FEATURE_ADDED]).to.equal(2);
        });
    });
});

describe('createEvent helper', function() {
    
    it('should create event with type and payload', function() {
        const event = createEvent(EventTypes.FEATURE_ADDED, {
            featureId: 'f1',
            feature: { type: 'box' }
        });
        
        expect(event.type).to.equal(EventTypes.FEATURE_ADDED);
        expect(event.payload.featureId).to.equal('f1');
        expect(event.version).to.be.null;
        expect(event.timestamp).to.be.null;
    });
});

describe('DocumentModel Event Sourcing', function() {
    let doc;
    let store;
    
    beforeEach(function() {
        doc = new DocumentModel();
        store = new EventStore();
        resetFeatureIdCounter(1);
    });
    
    describe('applyEvent', function() {
        
        it('should apply FEATURE_ADDED event', function() {
            const box = new BoxFeature({ width: 10, height: 20, depth: 30 });
            const event = createEvent(EventTypes.FEATURE_ADDED, {
                featureId: box.id,
                feature: box.toJSON()
            });
            event.version = 1;
            event.timestamp = Date.now();
            
            doc.applyEvent(event);
            
            const feature = doc.getFeature(box.id);
            expect(feature).to.exist;
            expect(feature.type).to.equal('box');
            expect(feature.params.width).to.equal(10);
        });
        
        it('should apply FEATURE_DELETED event', function() {
            // First add a feature
            const box = new BoxFeature({});
            doc.addFeature(box);
            
            const event = createEvent(EventTypes.FEATURE_DELETED, {
                featureId: box.id
            });
            event.version = 1;
            event.timestamp = Date.now();
            
            doc.applyEvent(event);
            
            expect(doc.getFeature(box.id)).to.be.undefined;
        });
        
        it('should apply FEATURE_RENAMED event', function() {
            const box = new BoxFeature({});
            doc.addFeature(box);
            const oldName = box.name;
            
            const event = createEvent(EventTypes.FEATURE_RENAMED, {
                featureId: box.id,
                oldName: oldName,
                newName: 'MyBox'
            });
            event.version = 1;
            event.timestamp = Date.now();
            
            doc.applyEvent(event);
            
            expect(doc.getFeature(box.id).name).to.equal('MyBox');
        });
        
        it('should apply PARAM_CHANGED event', function() {
            const box = new BoxFeature({ width: 10 });
            doc.addFeature(box);
            
            const event = createEvent(EventTypes.PARAM_CHANGED, {
                featureId: box.id,
                paramName: 'width',
                oldValue: 10,
                newValue: 50
            });
            event.version = 1;
            event.timestamp = Date.now();
            
            doc.applyEvent(event);
            
            expect(doc.getFeature(box.id).params.width).to.equal(50);
        });
        
        it('should apply PARAMS_BATCH_CHANGED event', function() {
            const box = new BoxFeature({ width: 10, height: 20 });
            doc.addFeature(box);
            
            const event = createEvent(EventTypes.PARAMS_BATCH_CHANGED, {
                featureId: box.id,
                oldParams: { width: 10, height: 20 },
                newParams: { width: 100, height: 200 }
            });
            event.version = 1;
            event.timestamp = Date.now();
            
            doc.applyEvent(event);
            
            const feature = doc.getFeature(box.id);
            expect(feature.params.width).to.equal(100);
            expect(feature.params.height).to.equal(200);
        });
        
        it('should apply FEATURE_VISIBILITY_CHANGED event', function() {
            const box = new BoxFeature({});
            doc.addFeature(box);
            
            const event = createEvent(EventTypes.FEATURE_VISIBILITY_CHANGED, {
                featureId: box.id,
                oldVisible: true,
                visible: false
            });
            event.version = 1;
            event.timestamp = Date.now();
            
            doc.applyEvent(event);
            
            expect(doc.getFeature(box.id).visible).to.be.false;
        });
        
        it('should apply DOCUMENT_CLEARED event', function() {
            doc.addFeature(new BoxFeature({}));
            doc.addFeature(new CylinderFeature({}));
            
            const event = createEvent(EventTypes.DOCUMENT_CLEARED, {});
            event.version = 1;
            event.timestamp = Date.now();
            
            doc.applyEvent(event);
            
            expect(doc.features.size).to.equal(0);
        });
    });
    
    describe('rebuildFromEvents', function() {
        
        it('should rebuild document from event sequence', function() {
            // Create events manually
            const events = [
                createEvent(EventTypes.FEATURE_ADDED, {
                    featureId: 'feature_1',
                    feature: {
                        id: 'feature_1',
                        type: 'box',
                        params: { width: 10, height: 20, depth: 30 },
                        dependencies: [],
                        name: 'Box1',
                        visible: true
                    }
                }),
                createEvent(EventTypes.FEATURE_ADDED, {
                    featureId: 'feature_2',
                    feature: {
                        id: 'feature_2',
                        type: 'cylinder',
                        params: { radius: 5, height: 15 },
                        dependencies: [],
                        name: 'Cylinder1',
                        visible: true
                    }
                }),
                createEvent(EventTypes.PARAM_CHANGED, {
                    featureId: 'feature_1',
                    paramName: 'width',
                    newValue: 100
                })
            ];
            
            // Stamp versions/timestamps
            events.forEach((e, i) => {
                e.version = i + 1;
                e.timestamp = Date.now();
            });
            
            doc.rebuildFromEvents(events);
            
            expect(doc.features.size).to.equal(2);
            expect(doc.getFeature('feature_1').params.width).to.equal(100);
            expect(doc.getFeature('feature_2').type).to.equal('cylinder');
        });
        
        it('should match direct mutation result', function() {
            // Direct mutation
            const doc1 = new DocumentModel();
            resetFeatureIdCounter(1);
            const box1 = new BoxFeature({ width: 10 });
            doc1.addFeature(box1);
            doc1.updateFeature(box1.id, { width: 50 });
            
            // Event sourced
            const doc2 = new DocumentModel();
            const events = [
                createEvent(EventTypes.FEATURE_ADDED, {
                    featureId: box1.id,
                    feature: {
                        id: box1.id,
                        type: 'box',
                        params: { width: 10 },
                        dependencies: [],
                        name: box1.name,
                        visible: true
                    }
                }),
                createEvent(EventTypes.PARAM_CHANGED, {
                    featureId: box1.id,
                    paramName: 'width',
                    newValue: 50
                })
            ];
            events.forEach((e, i) => {
                e.version = i + 1;
                e.timestamp = Date.now();
            });
            
            doc2.rebuildFromEvents(events);
            
            // Compare
            expect(doc2.features.size).to.equal(doc1.features.size);
            expect(doc2.getFeature(box1.id).params.width).to.equal(
                doc1.getFeature(box1.id).params.width
            );
        });
    });
    
    describe('syncWithEventStore', function() {
        
        it('should sync document with event store', function() {
            doc.syncWithEventStore(store);
            
            // Append events to store
            store.append(createEvent(EventTypes.FEATURE_ADDED, {
                featureId: 'f1',
                feature: {
                    id: 'f1',
                    type: 'box',
                    params: { width: 10 },
                    dependencies: [],
                    name: 'Box',
                    visible: true
                }
            }));
            
            // Document should be updated
            expect(doc.features.size).to.equal(1);
            expect(doc.getFeature('f1').type).to.equal('box');
        });
        
        it('should handle undo via truncation', function() {
            doc.syncWithEventStore(store);
            
            store.append(createEvent(EventTypes.FEATURE_ADDED, {
                featureId: 'f1',
                feature: { id: 'f1', type: 'box', params: {}, dependencies: [], name: 'B1', visible: true }
            }));
            store.append(createEvent(EventTypes.FEATURE_ADDED, {
                featureId: 'f2',
                feature: { id: 'f2', type: 'cylinder', params: {}, dependencies: [], name: 'C1', visible: true }
            }));
            
            expect(doc.features.size).to.equal(2);
            
            // Undo last feature
            store.undo();
            
            expect(doc.features.size).to.equal(1);
            expect(doc.getFeature('f2')).to.be.undefined;
        });
        
        it('should handle redo', function() {
            doc.syncWithEventStore(store);
            
            store.append(createEvent(EventTypes.FEATURE_ADDED, {
                featureId: 'f1',
                feature: { id: 'f1', type: 'box', params: {}, dependencies: [], name: 'B1', visible: true }
            }));
            store.append(createEvent(EventTypes.FEATURE_ADDED, {
                featureId: 'f2',
                feature: { id: 'f2', type: 'cylinder', params: {}, dependencies: [], name: 'C1', visible: true }
            }));
            
            store.undo();
            expect(doc.features.size).to.equal(1);
            
            store.redo();
            expect(doc.features.size).to.equal(2);
            expect(doc.getFeature('f2').type).to.equal('cylinder');
        });
    });
    
    describe('Event-Sourced Operations', function() {
        
        beforeEach(function() {
            doc.syncWithEventStore(store);
        });
        
        it('addFeatureWithEvent should emit event and update doc', function() {
            resetFeatureIdCounter(1);
            const box = new BoxFeature({ width: 25 });
            
            doc.addFeatureWithEvent(box, store);
            
            expect(store.getVersion()).to.equal(1);
            expect(doc.features.size).to.equal(1);
            expect(doc.getFeature(box.id).params.width).to.equal(25);
        });
        
        it('removeFeatureWithEvent should emit event and update doc', function() {
            resetFeatureIdCounter(1);
            const box = new BoxFeature({});
            doc.addFeatureWithEvent(box, store);
            
            doc.removeFeatureWithEvent(box.id, store);
            
            expect(store.getVersion()).to.equal(2);
            expect(doc.features.size).to.equal(0);
        });
        
        it('updateFeatureWithEvent should emit event and update doc', function() {
            resetFeatureIdCounter(1);
            const box = new BoxFeature({ width: 10 });
            doc.addFeatureWithEvent(box, store);
            
            doc.updateFeatureWithEvent(box.id, { width: 99 }, store);
            
            expect(store.getVersion()).to.equal(2);
            expect(doc.getFeature(box.id).params.width).to.equal(99);
        });
        
        it('renameFeatureWithEvent should emit event and update doc', function() {
            resetFeatureIdCounter(1);
            const box = new BoxFeature({});
            doc.addFeatureWithEvent(box, store);
            
            doc.renameFeatureWithEvent(box.id, 'SuperBox', store);
            
            expect(store.getVersion()).to.equal(2);
            expect(doc.getFeature(box.id).name).to.equal('SuperBox');
        });
        
        it('setVisibilityWithEvent should emit event and update doc', function() {
            resetFeatureIdCounter(1);
            const box = new BoxFeature({});
            doc.addFeatureWithEvent(box, store);
            
            doc.setVisibilityWithEvent(box.id, false, store);
            
            expect(store.getVersion()).to.equal(2);
            expect(doc.getFeature(box.id).visible).to.be.false;
        });
        
        it('should support full undo/redo cycle with event-sourced ops', function() {
            resetFeatureIdCounter(1);
            
            // Add feature
            const box = new BoxFeature({ width: 10 });
            doc.addFeatureWithEvent(box, store);
            expect(doc.features.size).to.equal(1);
            
            // Modify feature
            doc.updateFeatureWithEvent(box.id, { width: 50 }, store);
            expect(doc.getFeature(box.id).params.width).to.equal(50);
            
            // Undo modification
            store.undo();
            expect(doc.getFeature(box.id).params.width).to.equal(10);
            
            // Undo creation
            store.undo();
            expect(doc.features.size).to.equal(0);
            
            // Redo creation
            store.redo();
            expect(doc.features.size).to.equal(1);
            
            // Redo modification
            store.redo();
            expect(doc.getFeature(box.id).params.width).to.equal(50);
        });
    });
});
