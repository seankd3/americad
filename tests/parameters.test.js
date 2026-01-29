/**
 * Ameri-CAD Parameters Tests
 * Tests for parametric expressions from src/state/parameters.js
 */

import {
  ParameterStore,
  parameters,
  evaluateParam,
  getParamDependencies,
} from '../src/state/parameters.js';

// Export for runner compatibility
window.ParameterStore = ParameterStore;

describe('ParameterStore', function () {
  let store;

  beforeEach(function () {
    store = new ParameterStore();
  });

  describe('Basic Operations', function () {
    it('should set and get a simple numeric parameter', function () {
      store.set('width', 100);
      expect(store.get('width')).to.equal(100);
    });

    it('should set parameter from string number', function () {
      store.set('height', '50');
      expect(store.get('height')).to.equal(50);
    });

    it('should set parameter with decimal', function () {
      store.set('radius', 12.5);
      expect(store.get('radius')).to.equal(12.5);
    });

    it('should set parameter with negative value', function () {
      store.set('offset', -10);
      expect(store.get('offset')).to.equal(-10);
    });

    it('should get expression string', function () {
      store.set('x', 'width * 2');
      expect(store.getExpression('x')).to.equal('width * 2');
    });

    it('should check if parameter exists', function () {
      expect(store.has('width')).to.be.false;
      store.set('width', 100);
      expect(store.has('width')).to.be.true;
    });

    it('should delete a parameter', function () {
      store.set('width', 100);
      expect(store.has('width')).to.be.true;
      store.delete('width');
      expect(store.has('width')).to.be.false;
    });

    it('should throw on unknown parameter get', function () {
      expect(() => store.get('unknown')).to.throw('Unknown parameter');
    });

    it('should clear all parameters', function () {
      store.set('a', 1);
      store.set('b', 2);
      store.set('c', 3);
      expect(store.getAll().length).to.equal(3);
      store.clear();
      expect(store.getAll().length).to.equal(0);
    });
  });

  describe('Name Validation', function () {
    it('should reject invalid parameter names', function () {
      expect(() => store.set('123invalid', 10)).to.throw('Invalid parameter name');
      expect(() => store.set('has-dash', 10)).to.throw('Invalid parameter name');
      expect(() => store.set('has space', 10)).to.throw('Invalid parameter name');
    });

    it('should accept valid parameter names', function () {
      store.set('width', 10);
      store.set('_private', 20);
      store.set('camelCase', 30);
      store.set('with123', 40);
      store.set('UPPER', 50);

      expect(store.get('width')).to.equal(10);
      expect(store.get('_private')).to.equal(20);
      expect(store.get('camelCase')).to.equal(30);
      expect(store.get('with123')).to.equal(40);
      expect(store.get('UPPER')).to.equal(50);
    });

    it('should reject reserved constant names', function () {
      expect(() => store.set('PI', 10)).to.throw('reserved constant');
      expect(() => store.set('E', 10)).to.throw('reserved constant');
      expect(() => store.set('TAU', 10)).to.throw('reserved constant');
    });

    it('should reject reserved function names', function () {
      expect(() => store.set('sqrt', 10)).to.throw('reserved function');
      expect(() => store.set('sin', 10)).to.throw('reserved function');
      expect(() => store.set('max', 10)).to.throw('reserved function');
    });
  });

  describe('Expression Evaluation', function () {
    it('should evaluate basic addition', function () {
      store.set('x', '10 + 5');
      expect(store.get('x')).to.equal(15);
    });

    it('should evaluate basic subtraction', function () {
      store.set('x', '20 - 7');
      expect(store.get('x')).to.equal(13);
    });

    it('should evaluate multiplication', function () {
      store.set('x', '6 * 7');
      expect(store.get('x')).to.equal(42);
    });

    it('should evaluate division', function () {
      store.set('x', '100 / 4');
      expect(store.get('x')).to.equal(25);
    });

    it('should evaluate modulo', function () {
      store.set('x', '17 % 5');
      expect(store.get('x')).to.equal(2);
    });

    it('should evaluate exponentiation', function () {
      store.set('x', '2 ^ 10');
      expect(store.get('x')).to.equal(1024);
    });

    it('should respect operator precedence', function () {
      store.set('x', '2 + 3 * 4');
      expect(store.get('x')).to.equal(14);

      store.set('y', '10 - 6 / 2');
      expect(store.get('y')).to.equal(7);
    });

    it('should handle parentheses', function () {
      store.set('x', '(2 + 3) * 4');
      expect(store.get('x')).to.equal(20);

      store.set('y', '(10 - 6) / 2');
      expect(store.get('y')).to.equal(2);
    });

    it('should handle unary minus', function () {
      store.set('x', '-5 + 10');
      expect(store.get('x')).to.equal(5);

      store.set('y', '10 * -2');
      expect(store.get('y')).to.equal(-20);
    });

    it('should handle scientific notation', function () {
      store.set('x', '1e3');
      expect(store.get('x')).to.equal(1000);

      store.set('y', '2.5e-2');
      expect(store.get('y')).to.equal(0.025);
    });

    it('should throw on division by zero', function () {
      store.set('x', '10 / 0');
      expect(() => store.get('x')).to.throw('Division by zero');
    });
  });

  describe('Parameter References', function () {
    it('should reference another parameter', function () {
      store.set('width', 100);
      store.set('height', 'width / 2');
      expect(store.get('height')).to.equal(50);
    });

    it('should chain multiple references', function () {
      store.set('a', 10);
      store.set('b', 'a * 2');
      store.set('c', 'b + 5');
      expect(store.get('c')).to.equal(25);
    });

    it('should use multiple references in one expression', function () {
      store.set('width', 100);
      store.set('height', 50);
      store.set('area', 'width * height');
      expect(store.get('area')).to.equal(5000);
    });

    it('should propagate changes to dependents', function () {
      store.set('base', 10);
      store.set('derived', 'base * 2');
      expect(store.get('derived')).to.equal(20);

      // Change base
      store.set('base', 20);
      expect(store.get('derived')).to.equal(40);
    });

    it('should cascade propagation through chain', function () {
      store.set('a', 5);
      store.set('b', 'a * 2');
      store.set('c', 'b + 10');
      store.set('d', 'c * 3');

      expect(store.get('d')).to.equal(60); // (5*2+10)*3

      store.set('a', 10);
      expect(store.get('d')).to.equal(90); // (10*2+10)*3
    });
  });

  describe('Circular Dependency Detection', function () {
    it('should detect self-reference', function () {
      expect(() => store.set('x', 'x + 1')).to.throw('Circular dependency');
    });

    it('should detect simple cycle', function () {
      store.set('a', '10');
      store.set('b', 'a + 1');

      expect(() => store.set('a', 'b + 1')).to.throw('Circular dependency');
    });

    it('should detect longer cycle', function () {
      store.set('a', 10);
      store.set('b', 'a + 1');
      store.set('c', 'b + 1');

      expect(() => store.set('a', 'c + 1')).to.throw('Circular dependency');
    });

    it('checkCircular should identify cycles', function () {
      store.set('x', 10);
      store.set('y', 'x + 1');

      const result = store.checkCircular('y');
      expect(result.circular).to.be.false;
    });
  });

  describe('Built-in Functions', function () {
    it('should evaluate sqrt', function () {
      store.set('x', 'sqrt(16)');
      expect(store.get('x')).to.equal(4);
    });

    it('should evaluate abs', function () {
      store.set('x', 'abs(-5)');
      expect(store.get('x')).to.equal(5);
    });

    it('should evaluate min', function () {
      store.set('x', 'min(10, 5, 8)');
      expect(store.get('x')).to.equal(5);
    });

    it('should evaluate max', function () {
      store.set('x', 'max(10, 5, 8)');
      expect(store.get('x')).to.equal(10);
    });

    it('should evaluate floor', function () {
      store.set('x', 'floor(3.7)');
      expect(store.get('x')).to.equal(3);
    });

    it('should evaluate ceil', function () {
      store.set('x', 'ceil(3.2)');
      expect(store.get('x')).to.equal(4);
    });

    it('should evaluate round', function () {
      store.set('x', 'round(3.5)');
      expect(store.get('x')).to.equal(4);
    });

    it('should evaluate pow', function () {
      store.set('x', 'pow(2, 8)');
      expect(store.get('x')).to.equal(256);
    });

    it('should evaluate sin', function () {
      store.set('x', 'sin(0)');
      expect(store.get('x')).to.equal(0);
    });

    it('should evaluate cos', function () {
      store.set('x', 'cos(0)');
      expect(store.get('x')).to.equal(1);
    });

    it('should evaluate tan', function () {
      store.set('x', 'tan(0)');
      expect(store.get('x')).to.equal(0);
    });

    it('should evaluate atan2', function () {
      store.set('x', 'atan2(1, 0)');
      expect(store.get('x')).to.be.closeTo(Math.PI / 2, 0.0001);
    });

    it('should evaluate rad (degrees to radians)', function () {
      store.set('x', 'rad(180)');
      expect(store.get('x')).to.be.closeTo(Math.PI, 0.0001);
    });

    it('should evaluate deg (radians to degrees)', function () {
      store.set('x', 'deg(PI)');
      expect(store.get('x')).to.be.closeTo(180, 0.0001);
    });

    it('should evaluate log', function () {
      store.set('x', 'log(E)');
      expect(store.get('x')).to.be.closeTo(1, 0.0001);
    });

    it('should evaluate log10', function () {
      store.set('x', 'log10(100)');
      expect(store.get('x')).to.equal(2);
    });

    it('should evaluate exp', function () {
      store.set('x', 'exp(1)');
      expect(store.get('x')).to.be.closeTo(Math.E, 0.0001);
    });

    it('should combine functions with parameters', function () {
      store.set('width', 100);
      store.set('height', 50);
      store.set('diagonal', 'sqrt(width^2 + height^2)');
      expect(store.get('diagonal')).to.be.closeTo(111.803, 0.001);
    });

    it('should throw on unknown function', function () {
      store.set('x', 'unknown(5)');
      expect(() => store.get('x')).to.throw('Unknown function');
    });
  });

  describe('Built-in Constants', function () {
    it('should evaluate PI', function () {
      store.set('x', 'PI');
      expect(store.get('x')).to.equal(Math.PI);
    });

    it('should evaluate E', function () {
      store.set('x', 'E');
      expect(store.get('x')).to.equal(Math.E);
    });

    it('should evaluate TAU', function () {
      store.set('x', 'TAU');
      expect(store.get('x')).to.equal(Math.PI * 2);
    });

    it('should use constants in expressions', function () {
      store.set('radius', 10);
      store.set('circumference', '2 * PI * radius');
      expect(store.get('circumference')).to.be.closeTo(62.832, 0.001);
    });
  });

  describe('Dependency Tracking', function () {
    it('should track direct dependencies', function () {
      store.set('a', 10);
      store.set('b', 'a + 1');
      expect(store.getDependencies('b')).to.include('a');
    });

    it('should track multiple dependencies', function () {
      store.set('x', 10);
      store.set('y', 20);
      store.set('z', 'x + y');
      const deps = store.getDependencies('z');
      expect(deps).to.include('x');
      expect(deps).to.include('y');
    });

    it('should find direct dependents', function () {
      store.set('base', 10);
      store.set('derived1', 'base * 2');
      store.set('derived2', 'base + 5');
      const dependents = store.getDependents('base');
      expect(dependents).to.include('derived1');
      expect(dependents).to.include('derived2');
    });

    it('should find all transitive dependents', function () {
      store.set('a', 1);
      store.set('b', 'a + 1');
      store.set('c', 'b + 1');
      store.set('d', 'c + 1');

      const all = store.getAllDependents('a');
      expect(all).to.include('b');
      expect(all).to.include('c');
      expect(all).to.include('d');
    });

    it('should not include constants as dependencies', function () {
      store.set('x', 'PI * 2');
      const deps = store.getDependencies('x');
      expect(deps).to.not.include('PI');
    });
  });

  describe('Delete Constraints', function () {
    it('should prevent deleting parameter with dependents', function () {
      store.set('base', 10);
      store.set('derived', 'base * 2');
      expect(() => store.delete('base')).to.throw('other parameters depend on it');
    });

    it('should allow deleting leaf parameter', function () {
      store.set('base', 10);
      store.set('derived', 'base * 2');
      expect(() => store.delete('derived')).to.not.throw();
      expect(store.has('derived')).to.be.false;
    });
  });

  describe('Rename', function () {
    it('should rename a parameter', function () {
      store.set('oldName', 100);
      store.rename('oldName', 'newName');
      expect(store.has('oldName')).to.be.false;
      expect(store.has('newName')).to.be.true;
      expect(store.get('newName')).to.equal(100);
    });

    it('should update references in dependent expressions', function () {
      store.set('width', 100);
      store.set('area', 'width * width');
      expect(store.get('area')).to.equal(10000);

      store.rename('width', 'size');
      expect(store.get('area')).to.equal(10000);
      expect(store.getExpression('area')).to.equal('size * size');
    });
  });

  describe('Serialization', function () {
    it('should serialize to JSON', function () {
      store.set('width', 100);
      store.set('height', 'width / 2');
      const json = store.toJSON();
      expect(json.width).to.equal('100');
      expect(json.height).to.equal('width / 2');
    });

    it('should deserialize from JSON', function () {
      const json = {
        width: '100',
        height: 'width / 2',
      };
      store.fromJSON(json);
      expect(store.get('width')).to.equal(100);
      expect(store.get('height')).to.equal(50);
    });

    it('should preserve expressions through round-trip', function () {
      store.set('a', 10);
      store.set('b', 'a * 2 + 5');
      store.set('c', 'sqrt(b)');

      const json = store.toJSON();
      const newStore = new ParameterStore();
      newStore.fromJSON(json);

      expect(newStore.get('a')).to.equal(10);
      expect(newStore.get('b')).to.equal(25);
      expect(newStore.get('c')).to.equal(5);
    });
  });

  describe('Topological Order', function () {
    it('should return params in dependency order', function () {
      store.set('c', 'b + 1');
      store.set('a', 10);
      store.set('b', 'a + 1');

      const order = store.getTopologicalOrder();
      expect(order.indexOf('a')).to.be.lessThan(order.indexOf('b'));
      expect(order.indexOf('b')).to.be.lessThan(order.indexOf('c'));
    });
  });

  describe('getAll()', function () {
    it('should return all parameters with values', function () {
      store.set('width', 100);
      store.set('height', 50);

      const all = store.getAll();
      expect(all.length).to.equal(2);

      const width = all.find(p => p.name === 'width');
      expect(width.value).to.equal(100);
      expect(width.expression).to.equal('100');
    });

    it('should include error info for invalid params', function () {
      store.set('valid', 10);
      store.set('invalid', 'unknown_param + 1');

      const all = store.getAll();
      const invalid = all.find(p => p.name === 'invalid');
      expect(invalid.error).to.include('Unknown parameter');
    });
  });

  describe('Evaluate Expression', function () {
    it('should evaluate arbitrary expression', function () {
      store.set('x', 10);
      const result = store.evaluate('x * 2 + 5');
      expect(result).to.equal(25);
    });

    it('should evaluate pure number quickly', function () {
      const result = store.evaluate('42');
      expect(result).to.equal(42);
    });

    it('should evaluate complex expression', function () {
      store.set('r', 5);
      const result = store.evaluate('PI * r^2');
      expect(result).to.be.closeTo(78.54, 0.01);
    });
  });

  describe('onChange callback', function () {
    it('should fire when parameter is set', function () {
      let called = false;
      let changedName = null;
      let changedValue = null;

      store.onChange = (name, value) => {
        called = true;
        changedName = name;
        changedValue = value;
      };

      store.set('width', 100);

      expect(called).to.be.true;
      expect(changedName).to.equal('width');
      expect(changedValue).to.equal(100);
    });
  });

  describe('Static Methods', function () {
    it('should list available functions', function () {
      const funcs = ParameterStore.getFunctions();
      expect(funcs).to.include('sqrt');
      expect(funcs).to.include('sin');
      expect(funcs).to.include('min');
      expect(funcs).to.include('max');
    });

    it('should list available constants', function () {
      const constants = ParameterStore.getConstants();
      expect(constants.PI).to.equal(Math.PI);
      expect(constants.E).to.equal(Math.E);
      expect(constants.TAU).to.equal(Math.PI * 2);
    });
  });
});

describe('evaluateParam helper', function () {
  let store;

  beforeEach(function () {
    store = new ParameterStore();
    store.set('width', 100);
    store.set('height', 50);
  });

  it('should pass through numbers', function () {
    expect(evaluateParam(42, store)).to.equal(42);
  });

  it('should evaluate string expressions', function () {
    expect(evaluateParam('width', store)).to.equal(100);
    expect(evaluateParam('width * 2', store)).to.equal(200);
  });

  it('should handle numeric strings', function () {
    expect(evaluateParam('25', store)).to.equal(25);
  });

  it('should fallback to 0 for invalid values', function () {
    expect(evaluateParam(null, store)).to.equal(0);
    expect(evaluateParam(undefined, store)).to.equal(0);
  });
});

describe('getParamDependencies helper', function () {
  it('should extract dependencies from expression', function () {
    const deps = getParamDependencies('width * height + offset');
    expect(deps).to.include('width');
    expect(deps).to.include('height');
    expect(deps).to.include('offset');
  });

  it('should return empty for plain numbers', function () {
    const deps = getParamDependencies('42');
    expect(deps.length).to.equal(0);
  });

  it('should return empty for non-strings', function () {
    expect(getParamDependencies(42).length).to.equal(0);
    expect(getParamDependencies(null).length).to.equal(0);
  });

  it('should not include functions as dependencies', function () {
    const deps = getParamDependencies('sqrt(width) + sin(angle)');
    expect(deps).to.include('width');
    expect(deps).to.include('angle');
    expect(deps).to.not.include('sqrt');
    expect(deps).to.not.include('sin');
  });

  it('should not include constants as dependencies', function () {
    const deps = getParamDependencies('PI * radius');
    expect(deps).to.include('radius');
    expect(deps).to.not.include('PI');
  });
});

describe('Global parameters instance', function () {
  beforeEach(function () {
    parameters.clear();
  });

  it('should be a ParameterStore instance', function () {
    expect(parameters).to.be.instanceOf(ParameterStore);
  });

  it('should work as singleton', function () {
    parameters.set('global_test', 42);
    expect(parameters.get('global_test')).to.equal(42);
  });
});

describe('Complex Integration Scenarios', function () {
  let store;

  beforeEach(function () {
    store = new ParameterStore();
  });

  it('should handle CAD-style dimensional constraints', function () {
    // Define a parametric enclosure
    store.set('length', 200);
    store.set('width', 100);
    store.set('height', 50);
    store.set('wall_thickness', 3);

    // Derived dimensions
    store.set('inner_length', 'length - 2 * wall_thickness');
    store.set('inner_width', 'width - 2 * wall_thickness');
    store.set('inner_height', 'height - wall_thickness');

    expect(store.get('inner_length')).to.equal(194);
    expect(store.get('inner_width')).to.equal(94);
    expect(store.get('inner_height')).to.equal(47);

    // Change wall thickness
    store.set('wall_thickness', 5);
    expect(store.get('inner_length')).to.equal(190);
    expect(store.get('inner_width')).to.equal(90);
    expect(store.get('inner_height')).to.equal(45);
  });

  it('should handle gear calculations', function () {
    store.set('module', 2);
    store.set('teeth', 24);
    store.set('pressure_angle', 20);

    store.set('pitch_diameter', 'module * teeth');
    store.set('addendum', 'module');
    store.set('dedendum', 'module * 1.25');
    store.set('outside_diameter', 'pitch_diameter + 2 * addendum');
    store.set('root_diameter', 'pitch_diameter - 2 * dedendum');

    expect(store.get('pitch_diameter')).to.equal(48);
    expect(store.get('outside_diameter')).to.equal(52);
    expect(store.get('root_diameter')).to.equal(43);
  });

  it('should handle trigonometric calculations', function () {
    store.set('angle_deg', 30);
    store.set('angle_rad', 'rad(angle_deg)');
    store.set('hypotenuse', 100);

    store.set('adjacent', 'hypotenuse * cos(angle_rad)');
    store.set('opposite', 'hypotenuse * sin(angle_rad)');

    expect(store.get('adjacent')).to.be.closeTo(86.6, 0.1);
    expect(store.get('opposite')).to.be.closeTo(50.0, 0.1);
  });

  it('should handle conditional-like logic with min/max', function () {
    store.set('base_thickness', 2);
    store.set('width', 50);

    // Thickness scales with width but has minimum and maximum
    store.set('min_thickness', 2);
    store.set('max_thickness', 10);
    store.set('calculated', 'width * 0.1');
    store.set('thickness', 'min(max_thickness, max(min_thickness, calculated))');

    expect(store.get('thickness')).to.equal(5);

    store.set('width', 10);
    expect(store.get('thickness')).to.equal(2); // Clamped to min

    store.set('width', 200);
    expect(store.get('thickness')).to.equal(10); // Clamped to max
  });
});
