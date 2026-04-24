/**
 * Ameri-CAD File I/O Tests
 * Tests for save/load serialization round-trips from src/io/file-format.js
 */

import {
  serialize,
  deserialize,
  validate,
  FILE_FORMAT_VERSION,
  FILE_EXTENSION,
  MIME_TYPE,
} from '../src/io/file-format.js';

import {
  DocumentModel,
  BoxFeature,
  CylinderFeature,
  SphereFeature,
  ConeFeature,
  BooleanFeature,
  FilletFeature,
  ChamferFeature,
  TransformFeature,
} from '../src/state/document.js';

// Export for runner compatibility
window.serialize = serialize;
window.deserialize = deserialize;
window.validate = validate;
window.DocumentModel = DocumentModel;

describe('File Format Constants', function () {
  it('should export correct version', function () {
    expect(FILE_FORMAT_VERSION).to.equal('1.0');
  });

  it('should export correct file extension', function () {
    expect(FILE_EXTENSION).to.equal('.americad');
  });

  it('should export correct MIME type', function () {
    expect(MIME_TYPE).to.equal('application/x-americad+json');
  });
});

describe('Serialize Empty Document', function () {
  it('serializes empty document', function () {
    const doc = new DocumentModel();
    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    expect(json.version).to.equal('1.0');
    expect(json.features).to.deep.equal([]);
  });

  it('includes document metadata', function () {
    const doc = new DocumentModel();
    doc.name = 'Test Document';

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    expect(json.name).to.equal('Test Document');
    expect(json.created).to.be.a('string');
    expect(json.modified).to.be.a('string');
  });

  it('defaults name to Untitled', function () {
    const doc = new DocumentModel();
    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    expect(json.name).to.equal('Untitled');
  });

  it('supports name override in options', function () {
    const doc = new DocumentModel();
    doc.name = 'Original';

    const jsonString = serialize(doc, { name: 'Override' });
    const json = JSON.parse(jsonString);

    expect(json.name).to.equal('Override');
  });

  it('supports compact output', function () {
    const doc = new DocumentModel();

    const prettyJson = serialize(doc, { pretty: true });
    const compactJson = serialize(doc, { pretty: false });

    expect(prettyJson.length).to.be.greaterThan(compactJson.length);
    expect(compactJson).to.not.include('\n');
  });
});

describe('Serialize Document with Primitives', function () {
  it('serializes box with params', function () {
    const doc = new DocumentModel();
    const box = new BoxFeature({
      width: 20,
      height: 15,
      depth: 10,
      center: { x: 5, y: 5, z: 5 },
    });
    doc.addFeature(box);

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    expect(json.features).to.have.length(1);
    expect(json.features[0].type).to.equal('box');
    expect(json.features[0].params.width).to.equal(20);
    expect(json.features[0].params.height).to.equal(15);
    expect(json.features[0].params.depth).to.equal(10);
    expect(json.features[0].params.center).to.deep.equal({ x: 5, y: 5, z: 5 });
  });

  it('serializes externally tracked primitive params', function () {
    const doc = new DocumentModel();
    doc.trackExternalFeature({
      id: 'body_external_1',
      type: 'box',
      name: 'External Box',
      params: {
        width: 12,
        height: 14,
        depth: 16,
        center: { x: 1, y: 2, z: 3 },
      },
      mesh: { uuid: 'mesh_external_1' },
    });

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    expect(json.features).to.have.length(1);
    expect(json.features[0].type).to.equal('box');
    expect(json.features[0].params.width).to.equal(12);
    expect(json.features[0].params.height).to.equal(14);
    expect(json.features[0].params.depth).to.equal(16);
    expect(json.features[0].params.center).to.deep.equal({ x: 1, y: 2, z: 3 });
    expect(json.features[0].params.external).to.be.undefined;
    expect(json.features[0].params.meshRef).to.be.undefined;
  });

  it('serializes sphere with params', function () {
    const doc = new DocumentModel();
    const sphere = new SphereFeature({
      radius: 25,
      center: { x: 10, y: 20, z: 30 },
    });
    doc.addFeature(sphere);

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    expect(json.features).to.have.length(1);
    expect(json.features[0].type).to.equal('sphere');
    expect(json.features[0].params.radius).to.equal(25);
    expect(json.features[0].params.center).to.deep.equal({ x: 10, y: 20, z: 30 });
  });

  it('serializes cylinder with params', function () {
    const doc = new DocumentModel();
    const cylinder = new CylinderFeature({
      radius: 8,
      height: 30,
      center: { x: 0, y: 0, z: 15 },
    });
    doc.addFeature(cylinder);

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    expect(json.features).to.have.length(1);
    expect(json.features[0].type).to.equal('cylinder');
    expect(json.features[0].params.radius).to.equal(8);
    expect(json.features[0].params.height).to.equal(30);
  });

  it('serializes cone with params', function () {
    const doc = new DocumentModel();
    const cone = new ConeFeature({
      radius1: 10,
      radius2: 0,
      height: 20,
    });
    doc.addFeature(cone);

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    expect(json.features).to.have.length(1);
    expect(json.features[0].type).to.equal('cone');
    expect(json.features[0].params.radius1).to.equal(10);
    expect(json.features[0].params.radius2).to.equal(0);
  });

  it('serializes multiple primitives', function () {
    const doc = new DocumentModel();
    doc.addFeature(new BoxFeature({ width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature({ radius: 5 }));
    doc.addFeature(new CylinderFeature({ radius: 3, height: 15 }));

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    expect(json.features).to.have.length(3);

    const types = json.features.map(f => f.type);
    expect(types).to.include('box');
    expect(types).to.include('sphere');
    expect(types).to.include('cylinder');
  });

  it('preserves feature IDs', function () {
    const doc = new DocumentModel();
    const box = new BoxFeature({ width: 10 });
    const originalId = box.id;
    doc.addFeature(box);

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    expect(json.features[0].id).to.equal(originalId);
  });

  it('preserves feature names', function () {
    const doc = new DocumentModel();
    const box = new BoxFeature({ name: 'My Custom Box' });
    doc.addFeature(box);

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    expect(json.features[0].name).to.equal('My Custom Box');
  });

  it('preserves visibility state', function () {
    const doc = new DocumentModel();
    const box = new BoxFeature({});
    box.visible = false;
    doc.addFeature(box);

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    expect(json.features[0].visible).to.equal(false);
  });

  it('includes identity transform matrix', function () {
    const doc = new DocumentModel();
    doc.addFeature(new BoxFeature({}));

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    const expectedIdentity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    expect(json.features[0].transform).to.deep.equal(expectedIdentity);
  });
});

describe('Round-Trip Serialization', function () {
  it('round-trips empty document correctly', function () {
    const original = new DocumentModel();
    original.name = 'Empty Test';

    const jsonString = serialize(original);
    const restored = deserialize(jsonString);

    expect(restored.name).to.equal('Empty Test');
    expect(restored.features.size).to.equal(0);
  });

  it('round-trips document with box correctly', function () {
    const original = new DocumentModel();
    const box = new BoxFeature({
      width: 50,
      height: 30,
      depth: 20,
      center: { x: 1, y: 2, z: 3 },
    });
    original.addFeature(box);

    const jsonString = serialize(original);
    const restored = deserialize(jsonString);

    expect(restored.features.size).to.equal(1);

    const restoredBox = restored.features.values().next().value;
    expect(restoredBox.type).to.equal('box');
    expect(restoredBox.params.width).to.equal(50);
    expect(restoredBox.params.height).to.equal(30);
    expect(restoredBox.params.depth).to.equal(20);
    expect(restoredBox.params.center).to.deep.equal({ x: 1, y: 2, z: 3 });
  });

  it('round-trips multiple primitives correctly', function () {
    const original = new DocumentModel();
    original.addFeature(new BoxFeature({ width: 10, height: 20, depth: 30 }));
    original.addFeature(new SphereFeature({ radius: 15 }));
    original.addFeature(new CylinderFeature({ radius: 5, height: 25 }));

    const jsonString = serialize(original);
    const restored = deserialize(jsonString);

    expect(restored.features.size).to.equal(3);

    const types = Array.from(restored.features.values()).map(f => f.type);
    expect(types).to.include('box');
    expect(types).to.include('sphere');
    expect(types).to.include('cylinder');
  });

  it('round-trips feature IDs correctly', function () {
    const original = new DocumentModel();
    const box = new BoxFeature({});
    const originalId = box.id;
    original.addFeature(box);

    const jsonString = serialize(original);
    const restored = deserialize(jsonString);

    expect(restored.features.has(originalId)).to.be.true;
  });

  it('round-trips custom names correctly', function () {
    const original = new DocumentModel();
    const box = new BoxFeature({ name: 'Base Plate' });
    original.addFeature(box);

    const jsonString = serialize(original);
    const restored = deserialize(jsonString);

    const restoredBox = restored.features.values().next().value;
    expect(restoredBox.name).to.equal('Base Plate');
  });

  it('round-trips visibility correctly', function () {
    const original = new DocumentModel();
    const box = new BoxFeature({});
    box.visible = false;
    original.addFeature(box);

    const jsonString = serialize(original);
    const restored = deserialize(jsonString);

    const restoredBox = restored.features.values().next().value;
    expect(restoredBox.visible).to.equal(false);
  });

  it('round-trips document timestamps', function () {
    const original = new DocumentModel();

    const jsonString = serialize(original);
    const restored = deserialize(jsonString);

    expect(restored.createdAt).to.be.a('number');
    expect(restored.modifiedAt).to.be.a('number');
  });
});

describe('Deserialize Dependencies', function () {
  it('deserializes in dependency order', function () {
    const original = new DocumentModel();

    // Create two primitives and a boolean that depends on them
    const box = new BoxFeature({ width: 20 });
    const sphere = new SphereFeature({ radius: 10 });
    original.addFeature(box);
    original.addFeature(sphere);

    const booleanOp = new BooleanFeature('subtract', box.id, sphere.id);
    original.addFeature(booleanOp);

    const jsonString = serialize(original);
    const restored = deserialize(jsonString);

    expect(restored.features.size).to.equal(3);

    // Get the restored boolean
    const restoredBoolean = restored.features.get(booleanOp.id);
    expect(restoredBoolean).to.exist;
    expect(restoredBoolean.type).to.equal('boolean_subtract');
    expect(restoredBoolean.dependencies).to.have.length(2);
  });

  it('rebuilds parent-child relationships', function () {
    const original = new DocumentModel();

    const box = new BoxFeature({});
    const sphere = new SphereFeature({});
    original.addFeature(box);
    original.addFeature(sphere);

    const booleanOp = new BooleanFeature('union', box.id, sphere.id);
    original.addFeature(booleanOp);

    const jsonString = serialize(original);
    const restored = deserialize(jsonString);

    const restoredBox = restored.features.get(box.id);
    const restoredSphere = restored.features.get(sphere.id);

    // Children should reference the boolean
    expect(restoredBox.children).to.include(booleanOp.id);
    expect(restoredSphere.children).to.include(booleanOp.id);
  });

  it('handles chained dependencies', function () {
    const original = new DocumentModel();

    // Create a chain: box -> fillet -> boolean
    const box = new BoxFeature({ width: 20 });
    original.addFeature(box);

    const fillet = new FilletFeature(box.id, [0, 1], 2);
    original.addFeature(fillet);

    const sphere = new SphereFeature({ radius: 5 });
    original.addFeature(sphere);

    const booleanOp = new BooleanFeature('subtract', fillet.id, sphere.id);
    original.addFeature(booleanOp);

    const jsonString = serialize(original);
    const restored = deserialize(jsonString);

    expect(restored.features.size).to.equal(4);

    // Verify dependency chain is intact
    const restoredFillet = restored.features.get(fillet.id);
    expect(restoredFillet.dependencies).to.include(box.id);

    const restoredBoolean = restored.features.get(booleanOp.id);
    expect(restoredBoolean.dependencies).to.include(fillet.id);
    expect(restoredBoolean.dependencies).to.include(sphere.id);
  });

  it('correctly identifies root features', function () {
    const original = new DocumentModel();

    const box = new BoxFeature({});
    const sphere = new SphereFeature({});
    original.addFeature(box);
    original.addFeature(sphere);

    // Boolean depends on both, so box and sphere are roots
    const booleanOp = new BooleanFeature('union', box.id, sphere.id);
    original.addFeature(booleanOp);

    const jsonString = serialize(original);
    const restored = deserialize(jsonString);

    expect(restored.rootFeatures).to.include(box.id);
    expect(restored.rootFeatures).to.include(sphere.id);
    expect(restored.rootFeatures).to.not.include(booleanOp.id);
  });

  it('throws on circular dependencies', function () {
    // Manually construct invalid JSON with circular deps
    const invalidJson = {
      version: '1.0',
      name: 'Invalid',
      features: [
        { id: 'a', type: 'box', params: {}, dependencies: ['b'], name: 'A', visible: true },
        { id: 'b', type: 'box', params: {}, dependencies: ['a'], name: 'B', visible: true },
      ],
    };

    expect(() => deserialize(invalidJson)).to.throw('Circular dependency');
  });
});

describe('Validate File Format', function () {
  it('rejects missing version', function () {
    expect(() => deserialize('{}')).to.throw('missing version');
  });

  it('rejects unsupported future version', function () {
    expect(() => deserialize('{"version": "99.0", "features": []}')).to.throw(
      'newer than supported'
    );
  });

  it('accepts same major version', function () {
    const json = {
      version: '1.0',
      name: 'Test',
      features: [],
    };

    expect(() => deserialize(json)).to.not.throw();
  });

  it('accepts older version (forward compatible)', function () {
    const json = {
      version: '0.9',
      name: 'Old Format',
      features: [],
    };

    // Should not throw - older versions should work
    expect(() => deserialize(json)).to.not.throw();
  });

  it('validate() returns valid for correct format', function () {
    const json = {
      version: '1.0',
      features: [{ id: 'f1', type: 'box', params: {}, dependencies: [] }],
    };

    const result = validate(json);
    expect(result.valid).to.be.true;
  });

  it('validate() returns error for missing version', function () {
    const result = validate({ features: [] });
    expect(result.valid).to.be.false;
    expect(result.error).to.include('version');
  });

  it('validate() returns error for missing features array', function () {
    const result = validate({ version: '1.0' });
    expect(result.valid).to.be.false;
    expect(result.error).to.include('features');
  });

  it('validate() returns error for feature without id', function () {
    const result = validate({
      version: '1.0',
      features: [{ type: 'box' }],
    });
    expect(result.valid).to.be.false;
    expect(result.error).to.include('missing id');
  });

  it('validate() returns error for feature without type', function () {
    const result = validate({
      version: '1.0',
      features: [{ id: 'f1' }],
    });
    expect(result.valid).to.be.false;
    expect(result.error).to.include('missing type');
  });

  it('validate() returns error for missing dependency', function () {
    const result = validate({
      version: '1.0',
      features: [{ id: 'f1', type: 'boolean_union', dependencies: ['nonexistent'] }],
    });
    expect(result.valid).to.be.false;
    expect(result.error).to.include('non-existent feature');
  });

  it('validate() accepts valid dependencies', function () {
    const result = validate({
      version: '1.0',
      features: [
        { id: 'f1', type: 'box', dependencies: [] },
        { id: 'f2', type: 'sphere', dependencies: [] },
        { id: 'f3', type: 'boolean_union', dependencies: ['f1', 'f2'] },
      ],
    });
    expect(result.valid).to.be.true;
  });

  it('validate() handles null input', function () {
    const result = validate(null);
    expect(result.valid).to.be.false;
    expect(result.error).to.include('Invalid JSON');
  });

  it('validate() handles non-object input', function () {
    const result = validate('not an object');
    expect(result.valid).to.be.false;
  });
});

describe('Handle Missing Optional Fields', function () {
  it('defaults name when missing', function () {
    const json = {
      version: '1.0',
      features: [],
    };

    const doc = deserialize(json);
    expect(doc.name).to.equal('Untitled');
  });

  it('defaults created date when missing', function () {
    const json = {
      version: '1.0',
      features: [],
    };

    const before = Date.now();
    const doc = deserialize(json);
    const after = Date.now();

    expect(doc.createdAt).to.be.at.least(before);
    expect(doc.createdAt).to.be.at.most(after);
  });

  it('defaults visibility to true when missing', function () {
    const json = {
      version: '1.0',
      features: [
        { id: 'f1', type: 'box', params: {}, dependencies: [], name: 'Box' },
        // Note: visible field is missing
      ],
    };

    const doc = deserialize(json);
    const feature = doc.features.get('f1');
    expect(feature.visible).to.be.true;
  });

  it('defaults dependencies to empty array when missing', function () {
    const json = {
      version: '1.0',
      features: [
        { id: 'f1', type: 'box', params: {}, name: 'Box', visible: true },
        // Note: dependencies field is missing
      ],
    };

    const doc = deserialize(json);
    const feature = doc.features.get('f1');
    expect(feature.dependencies).to.deep.equal([]);
  });

  it('uses default params for primitives when params minimal', function () {
    const json = {
      version: '1.0',
      features: [
        { id: 'f1', type: 'box', params: {}, dependencies: [], name: 'Box', visible: true },
      ],
    };

    const doc = deserialize(json);
    const box = doc.features.get('f1');

    // Should have default values from BoxFeature constructor
    expect(box.params.width).to.equal(10);
    expect(box.params.height).to.equal(10);
    expect(box.params.depth).to.equal(10);
  });

  it('preserves explicit params over defaults', function () {
    const json = {
      version: '1.0',
      features: [
        {
          id: 'f1',
          type: 'box',
          params: { width: 100 },
          dependencies: [],
          name: 'Box',
          visible: true,
        },
      ],
    };

    const doc = deserialize(json);
    const box = doc.features.get('f1');

    expect(box.params.width).to.equal(100);
    // Other params get defaults
    expect(box.params.height).to.equal(10);
  });
});

describe('Boolean Operations Serialization', function () {
  it('serializes union operation', function () {
    const doc = new DocumentModel();
    const box = new BoxFeature({});
    const sphere = new SphereFeature({});
    doc.addFeature(box);
    doc.addFeature(sphere);

    const union = new BooleanFeature('union', box.id, sphere.id);
    doc.addFeature(union);

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    const boolFeature = json.features.find(f => f.type === 'boolean_union');
    expect(boolFeature).to.exist;
    expect(boolFeature.dependencies).to.include(box.id);
    expect(boolFeature.dependencies).to.include(sphere.id);
  });

  it('serializes subtract operation', function () {
    const doc = new DocumentModel();
    const box = new BoxFeature({});
    const sphere = new SphereFeature({});
    doc.addFeature(box);
    doc.addFeature(sphere);

    const subtract = new BooleanFeature('subtract', box.id, sphere.id);
    doc.addFeature(subtract);

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    const boolFeature = json.features.find(f => f.type === 'boolean_subtract');
    expect(boolFeature).to.exist;
  });

  it('serializes intersect operation', function () {
    const doc = new DocumentModel();
    const box = new BoxFeature({});
    const sphere = new SphereFeature({});
    doc.addFeature(box);
    doc.addFeature(sphere);

    const intersect = new BooleanFeature('intersect', box.id, sphere.id);
    doc.addFeature(intersect);

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    const boolFeature = json.features.find(f => f.type === 'boolean_intersect');
    expect(boolFeature).to.exist;
  });

  it('round-trips boolean operations', function () {
    const doc = new DocumentModel();
    const box = new BoxFeature({ width: 30 });
    const sphere = new SphereFeature({ radius: 10 });
    doc.addFeature(box);
    doc.addFeature(sphere);

    const subtract = new BooleanFeature('subtract', box.id, sphere.id, { name: 'Cutout' });
    doc.addFeature(subtract);

    const jsonString = serialize(doc);
    const restored = deserialize(jsonString);

    const restoredBool = restored.features.get(subtract.id);
    expect(restoredBool.type).to.equal('boolean_subtract');
    expect(restoredBool.operation).to.equal('subtract');
    expect(restoredBool.dependencies).to.deep.equal([box.id, sphere.id]);
  });
});

describe('Modifier Features Serialization', function () {
  it('serializes fillet with edge IDs and radius', function () {
    const doc = new DocumentModel();
    const box = new BoxFeature({});
    doc.addFeature(box);

    const fillet = new FilletFeature(box.id, [0, 1, 2], 3.5);
    doc.addFeature(fillet);

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    const filletFeature = json.features.find(f => f.type === 'fillet');
    expect(filletFeature).to.exist;
    expect(filletFeature.params.edgeIds).to.deep.equal([0, 1, 2]);
    expect(filletFeature.params.radius).to.equal(3.5);
    expect(filletFeature.dependencies).to.include(box.id);
  });

  it('serializes chamfer with edge IDs and distance', function () {
    const doc = new DocumentModel();
    const box = new BoxFeature({});
    doc.addFeature(box);

    const chamfer = new ChamferFeature(box.id, [3, 4], 2.0);
    doc.addFeature(chamfer);

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    const chamferFeature = json.features.find(f => f.type === 'chamfer');
    expect(chamferFeature).to.exist;
    expect(chamferFeature.params.edgeIds).to.deep.equal([3, 4]);
    expect(chamferFeature.params.distance).to.equal(2.0);
  });

  it('serializes transform feature', function () {
    const doc = new DocumentModel();
    const box = new BoxFeature({});
    doc.addFeature(box);

    const transform = new TransformFeature(box.id, {
      position: { x: 10, y: 20, z: 30 },
      rotation: { x: 0, y: 45, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
    doc.addFeature(transform);

    const jsonString = serialize(doc);
    const json = JSON.parse(jsonString);

    const transformFeature = json.features.find(f => f.type === 'transform');
    expect(transformFeature).to.exist;
    expect(transformFeature.params.transform.position).to.deep.equal({ x: 10, y: 20, z: 30 });
    expect(transformFeature.dependencies).to.include(box.id);
  });

  it('round-trips fillet operation', function () {
    const doc = new DocumentModel();
    const box = new BoxFeature({});
    doc.addFeature(box);

    const fillet = new FilletFeature(box.id, [0, 1], 5);
    doc.addFeature(fillet);

    const jsonString = serialize(doc);
    const restored = deserialize(jsonString);

    const restoredFillet = restored.features.get(fillet.id);
    expect(restoredFillet.type).to.equal('fillet');
    expect(restoredFillet.params.radius).to.equal(5);
    expect(restoredFillet.params.edgeIds).to.deep.equal([0, 1]);
  });
});

describe('JSON Parsing Edge Cases', function () {
  it('handles string input to deserialize', function () {
    const jsonString = '{"version":"1.0","name":"Test","features":[]}';
    const doc = deserialize(jsonString);
    expect(doc.name).to.equal('Test');
  });

  it('handles object input to deserialize', function () {
    const jsonObj = { version: '1.0', name: 'Object Test', features: [] };
    const doc = deserialize(jsonObj);
    expect(doc.name).to.equal('Object Test');
  });

  it('throws on invalid JSON string', function () {
    expect(() => deserialize('not valid json')).to.throw();
  });

  it('throws on null input', function () {
    expect(() => deserialize(null)).to.throw();
  });

  it('handles feature with unknown type gracefully', function () {
    const json = {
      version: '1.0',
      features: [
        {
          id: 'f1',
          type: 'unknown_future_type',
          params: { foo: 'bar' },
          dependencies: [],
          name: 'Unknown',
          visible: true,
        },
      ],
    };

    // Should create a generic Feature instead of throwing
    const doc = deserialize(json);
    const feature = doc.features.get('f1');
    expect(feature.type).to.equal('unknown_future_type');
    expect(feature.params.foo).to.equal('bar');
  });
});
