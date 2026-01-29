/**
 * Ameri-CAD Feature Reorder Tests
 * Tests for drag-and-drop feature reordering in the parametric timeline
 */

import {
  DocumentModel,
  BoxFeature,
  SphereFeature,
  CylinderFeature,
  BooleanFeature,
} from '../src/state/document.js';

import { EventStore, EventTypes } from '../src/state/event-store.js';
import { ReorderFeatureCommand, CommandManager } from '../src/state/history.js';

// Export for runner compatibility
window.DocumentModel = DocumentModel;
window.BoxFeature = BoxFeature;
window.EventStore = EventStore;

describe('DocumentModel - Feature Reorder', function () {
  describe('getFeaturePosition', function () {
    it('should return the correct position for root features', function () {
      const doc = new DocumentModel();
      const box = new BoxFeature({ name: 'Box1' });
      const sphere = new SphereFeature({ name: 'Sphere1' });
      const cylinder = new CylinderFeature({ name: 'Cylinder1' });

      doc.addFeature(box);
      doc.addFeature(sphere);
      doc.addFeature(cylinder);

      expect(doc.getFeaturePosition(box.id)).to.equal(0);
      expect(doc.getFeaturePosition(sphere.id)).to.equal(1);
      expect(doc.getFeaturePosition(cylinder.id)).to.equal(2);
    });

    it('should return -1 for non-existent feature', function () {
      const doc = new DocumentModel();
      expect(doc.getFeaturePosition('nonexistent')).to.equal(-1);
    });
  });

  describe('canReorder', function () {
    it('should allow reordering independent features', function () {
      const doc = new DocumentModel();
      const box = new BoxFeature({ name: 'Box1' });
      const sphere = new SphereFeature({ name: 'Sphere1' });
      const cylinder = new CylinderFeature({ name: 'Cylinder1' });

      doc.addFeature(box);
      doc.addFeature(sphere);
      doc.addFeature(cylinder);

      // Move cylinder to position 0
      const result = doc.canReorder(cylinder.id, 0);
      expect(result.valid).to.be.true;
    });

    it('should not allow moving feature before its dependencies', function () {
      const doc = new DocumentModel();
      const box = new BoxFeature({ name: 'Box1' });
      const sphere = new SphereFeature({ name: 'Sphere1' });

      doc.addFeature(box);
      doc.addFeature(sphere);

      // Create boolean that depends on box and sphere
      const booleanOp = new BooleanFeature('union', box.id, sphere.id, { name: 'Union1' });
      doc.addFeature(booleanOp);

      // Boolean should not be able to move before box (position 0)
      const result = doc.canReorder(booleanOp.id, 0);
      expect(result.valid).to.be.false;
      expect(result.reason).to.include('Depends on');
    });

    it('should not allow moving feature after its dependents', function () {
      const doc = new DocumentModel();
      const box = new BoxFeature({ name: 'Box1' });
      const sphere = new SphereFeature({ name: 'Sphere1' });

      doc.addFeature(box);
      doc.addFeature(sphere);

      // Create boolean that depends on box
      const booleanOp = new BooleanFeature('union', box.id, sphere.id, { name: 'Union1' });
      doc.addFeature(booleanOp);

      // Box should not be able to move after boolean (position 2)
      const result = doc.canReorder(box.id, 2);
      expect(result.valid).to.be.false;
      expect(result.reason).to.include('depends on this');
    });

    it('should return valid=true for same position (no-op)', function () {
      const doc = new DocumentModel();
      const box = new BoxFeature({ name: 'Box1' });
      doc.addFeature(box);

      const result = doc.canReorder(box.id, 0);
      expect(result.valid).to.be.true;
    });

    it('should return invalid for non-existent feature', function () {
      const doc = new DocumentModel();
      const result = doc.canReorder('nonexistent', 0);
      expect(result.valid).to.be.false;
      expect(result.reason).to.equal('Feature not found');
    });

    it('should return invalid for out-of-bounds position', function () {
      const doc = new DocumentModel();
      const box = new BoxFeature({ name: 'Box1' });
      doc.addFeature(box);

      const result = doc.canReorder(box.id, 5);
      expect(result.valid).to.be.false;
      expect(result.reason).to.equal('Invalid target position');
    });
  });

  describe('reorderFeature', function () {
    it('should successfully reorder features', function () {
      const doc = new DocumentModel();
      const box = new BoxFeature({ name: 'Box1' });
      const sphere = new SphereFeature({ name: 'Sphere1' });
      const cylinder = new CylinderFeature({ name: 'Cylinder1' });

      doc.addFeature(box);
      doc.addFeature(sphere);
      doc.addFeature(cylinder);

      // Initial order: [box, sphere, cylinder]
      expect(doc.rootFeatures[0]).to.equal(box.id);
      expect(doc.rootFeatures[1]).to.equal(sphere.id);
      expect(doc.rootFeatures[2]).to.equal(cylinder.id);

      // Move cylinder to position 0
      const result = doc.reorderFeature(cylinder.id, 0);

      expect(result.success).to.be.true;
      expect(doc.rootFeatures[0]).to.equal(cylinder.id);
      expect(doc.rootFeatures[1]).to.equal(box.id);
      expect(doc.rootFeatures[2]).to.equal(sphere.id);
    });

    it('should return error for invalid reorder', function () {
      const doc = new DocumentModel();
      const box = new BoxFeature({ name: 'Box1' });
      const sphere = new SphereFeature({ name: 'Sphere1' });

      doc.addFeature(box);
      doc.addFeature(sphere);

      const booleanOp = new BooleanFeature('union', box.id, sphere.id, { name: 'Union1' });
      doc.addFeature(booleanOp);

      // Try to move boolean before its dependencies
      const result = doc.reorderFeature(booleanOp.id, 0);

      expect(result.success).to.be.false;
      expect(result.error).to.include('Depends on');
    });

    it('should trigger callbacks on successful reorder', function () {
      const doc = new DocumentModel();
      let modifiedCalled = false;
      let changedCalled = false;

      doc.onFeatureModified = () => {
        modifiedCalled = true;
      };
      doc.onDocumentChanged = () => {
        changedCalled = true;
      };

      const box = new BoxFeature({ name: 'Box1' });
      const sphere = new SphereFeature({ name: 'Sphere1' });

      doc.addFeature(box);
      doc.addFeature(sphere);

      // Reset flags after setup
      modifiedCalled = false;
      changedCalled = false;

      doc.reorderFeature(sphere.id, 0);

      expect(modifiedCalled).to.be.true;
      expect(changedCalled).to.be.true;
    });

    it('should handle no-op reorder gracefully', function () {
      const doc = new DocumentModel();
      const box = new BoxFeature({ name: 'Box1' });
      doc.addFeature(box);

      const result = doc.reorderFeature(box.id, 0);

      expect(result.success).to.be.true;
      expect(doc.rootFeatures[0]).to.equal(box.id);
    });
  });

  describe('reorderFeatureWithEvent', function () {
    it('should emit FEATURE_REORDERED event', function () {
      const doc = new DocumentModel();
      const store = new EventStore();

      const box = new BoxFeature({ name: 'Box1' });
      const sphere = new SphereFeature({ name: 'Sphere1' });

      doc.addFeature(box);
      doc.addFeature(sphere);

      // Sync document with store
      doc.syncWithEventStore(store);

      // Reorder with event
      const result = doc.reorderFeatureWithEvent(sphere.id, 0, store);

      expect(result.success).to.be.true;

      const events = store.getEvents(0);
      const reorderEvent = events.find(e => e.type === EventTypes.FEATURE_REORDERED);
      expect(reorderEvent).to.exist;
      expect(reorderEvent.payload.featureId).to.equal(sphere.id);
      expect(reorderEvent.payload.oldIndex).to.equal(1);
      expect(reorderEvent.payload.newIndex).to.equal(0);
    });

    it('should not emit event for invalid reorder', function () {
      const doc = new DocumentModel();
      const store = new EventStore();

      const box = new BoxFeature({ name: 'Box1' });
      const sphere = new SphereFeature({ name: 'Sphere1' });

      doc.addFeature(box);
      doc.addFeature(sphere);

      const booleanOp = new BooleanFeature('union', box.id, sphere.id, { name: 'Union1' });
      doc.addFeature(booleanOp);

      const initialCount = store.getEventCount();

      // Try invalid reorder
      const result = doc.reorderFeatureWithEvent(booleanOp.id, 0, store);

      expect(result.success).to.be.false;
      expect(store.getEventCount()).to.equal(initialCount);
    });
  });
});

describe('ReorderFeatureCommand - Undo/Redo', function () {
  it('should undo reorder correctly', function () {
    const doc = new DocumentModel();
    const cmdManager = new CommandManager();

    const box = new BoxFeature({ name: 'Box1' });
    const sphere = new SphereFeature({ name: 'Sphere1' });
    const cylinder = new CylinderFeature({ name: 'Cylinder1' });

    doc.addFeature(box);
    doc.addFeature(sphere);
    doc.addFeature(cylinder);

    // Create and execute reorder command
    const cmd = new ReorderFeatureCommand(doc, cylinder.id, 2, 0);
    cmdManager.execute(cmd);

    // Verify reorder happened
    expect(doc.rootFeatures[0]).to.equal(cylinder.id);

    // Undo
    cmdManager.undo();

    // Verify original order restored
    expect(doc.rootFeatures[0]).to.equal(box.id);
    expect(doc.rootFeatures[1]).to.equal(sphere.id);
    expect(doc.rootFeatures[2]).to.equal(cylinder.id);
  });

  it('should redo reorder correctly', function () {
    const doc = new DocumentModel();
    const cmdManager = new CommandManager();

    const box = new BoxFeature({ name: 'Box1' });
    const sphere = new SphereFeature({ name: 'Sphere1' });

    doc.addFeature(box);
    doc.addFeature(sphere);

    // Execute reorder
    const cmd = new ReorderFeatureCommand(doc, sphere.id, 1, 0);
    cmdManager.execute(cmd);

    // Undo
    cmdManager.undo();
    expect(doc.rootFeatures[0]).to.equal(box.id);

    // Redo
    cmdManager.redo();
    expect(doc.rootFeatures[0]).to.equal(sphere.id);
  });

  it('should have descriptive name for undo/redo UI', function () {
    const doc = new DocumentModel();
    const box = new BoxFeature({ name: 'MyBox' });
    doc.addFeature(box);

    const cmd = new ReorderFeatureCommand(doc, box.id, 0, 1);

    expect(cmd.name).to.equal('Reorder MyBox');
  });

  it('should call regenerate function if provided', function () {
    const doc = new DocumentModel();
    let regenerateCalled = false;
    const regenerateFn = () => {
      regenerateCalled = true;
    };

    const box = new BoxFeature({ name: 'Box1' });
    const sphere = new SphereFeature({ name: 'Sphere1' });

    doc.addFeature(box);
    doc.addFeature(sphere);

    const cmd = new ReorderFeatureCommand(doc, sphere.id, 1, 0, regenerateFn);
    cmd.execute();

    expect(regenerateCalled).to.be.true;
  });
});

describe('Event Sourcing - Feature Reorder', function () {
  it('should rebuild document with correct order after undo', function () {
    const doc = new DocumentModel();
    const store = new EventStore();

    doc.syncWithEventStore(store);

    const box = new BoxFeature({ name: 'Box1' });
    const sphere = new SphereFeature({ name: 'Sphere1' });
    const cylinder = new CylinderFeature({ name: 'Cylinder1' });

    doc.addFeatureWithEvent(box, store);
    doc.addFeatureWithEvent(sphere, store);
    doc.addFeatureWithEvent(cylinder, store);

    // Reorder
    doc.reorderFeatureWithEvent(cylinder.id, 0, store);

    expect(doc.rootFeatures[0]).to.equal(cylinder.id);

    // Undo via event store
    store.undo();

    // Document should be rebuilt with original order
    expect(doc.rootFeatures[0]).to.equal(box.id);
    expect(doc.rootFeatures[1]).to.equal(sphere.id);
    expect(doc.rootFeatures[2]).to.equal(cylinder.id);
  });

  it('should handle redo after undo', function () {
    const doc = new DocumentModel();
    const store = new EventStore();

    doc.syncWithEventStore(store);

    const box = new BoxFeature({ name: 'Box1' });
    const sphere = new SphereFeature({ name: 'Sphere1' });

    doc.addFeatureWithEvent(box, store);
    doc.addFeatureWithEvent(sphere, store);

    // Reorder
    doc.reorderFeatureWithEvent(sphere.id, 0, store);

    // Undo
    store.undo();
    expect(doc.rootFeatures[0]).to.equal(box.id);

    // Redo
    store.redo();
    expect(doc.rootFeatures[0]).to.equal(sphere.id);
  });
});
