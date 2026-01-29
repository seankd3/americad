/**
 * Ameri-CAD Parametric Expressions Tests
 * 
 * Run with: node --experimental-vm-modules tests/parameters.test.js
 * Or include in browser test runner
 */

// For Node.js testing without a framework
const isNode = typeof window === 'undefined';

let ParameterStore, evaluateParam, getParamDependencies;

if (isNode) {
    const module = await import('../src/state/parameters.js');
    ParameterStore = module.ParameterStore;
    evaluateParam = module.evaluateParam;
    getParamDependencies = module.getParamDependencies;
} else {
    // Browser environment - modules should be loaded already
    ParameterStore = window.ParameterStore;
    evaluateParam = window.evaluateParam;
    getParamDependencies = window.getParamDependencies;
}

// Simple test framework
let passed = 0;
let failed = 0;
let currentGroup = '';

function group(name) {
    currentGroup = name;
    console.log(`\n━━━ ${name} ━━━`);
}

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (e) {
        failed++;
        console.log(`  ✗ ${name}`);
        console.log(`    Error: ${e.message}`);
    }
}

function assert(condition, message = 'Assertion failed') {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
        throw new Error(`${message} Expected ${expected}, got ${actual}`);
    }
}

function assertClose(actual, expected, epsilon = 0.0001, message = '') {
    if (Math.abs(actual - expected) > epsilon) {
        throw new Error(`${message} Expected ~${expected}, got ${actual}`);
    }
}

function assertThrows(fn, expectedError = null, message = '') {
    let thrown = false;
    let error = null;
    try {
        fn();
    } catch (e) {
        thrown = true;
        error = e;
    }
    if (!thrown) {
        throw new Error(`${message} Expected function to throw`);
    }
    if (expectedError && !error.message.includes(expectedError)) {
        throw new Error(`${message} Expected error containing "${expectedError}", got "${error.message}"`);
    }
}

// ═══════════════════════════════════════════════════════════════
// BASIC EXPRESSION EVALUATION
// ═══════════════════════════════════════════════════════════════

group('Basic Expressions');

test('Simple numbers', () => {
    const store = new ParameterStore();
    store.set('x', 100);
    assertEqual(store.get('x'), 100);
    
    store.set('y', '200');
    assertEqual(store.get('y'), 200);
    
    store.set('z', '-50');
    assertEqual(store.get('z'), -50);
});

test('Decimal numbers', () => {
    const store = new ParameterStore();
    store.set('pi', '3.14159');
    assertClose(store.get('pi'), 3.14159);
    
    store.set('small', '0.001');
    assertClose(store.get('small'), 0.001);
});

test('Scientific notation', () => {
    const store = new ParameterStore();
    store.set('big', '1e6');
    assertEqual(store.get('big'), 1000000);
    
    store.set('tiny', '1e-3');
    assertClose(store.get('tiny'), 0.001);
});

test('Basic arithmetic: addition', () => {
    const store = new ParameterStore();
    store.set('a', '10 + 20');
    assertEqual(store.get('a'), 30);
});

test('Basic arithmetic: subtraction', () => {
    const store = new ParameterStore();
    store.set('a', '100 - 30');
    assertEqual(store.get('a'), 70);
});

test('Basic arithmetic: multiplication', () => {
    const store = new ParameterStore();
    store.set('a', '5 * 7');
    assertEqual(store.get('a'), 35);
});

test('Basic arithmetic: division', () => {
    const store = new ParameterStore();
    store.set('a', '100 / 4');
    assertEqual(store.get('a'), 25);
});

test('Basic arithmetic: modulo', () => {
    const store = new ParameterStore();
    store.set('a', '17 % 5');
    assertEqual(store.get('a'), 2);
});

test('Basic arithmetic: exponent', () => {
    const store = new ParameterStore();
    store.set('a', '2 ^ 10');
    assertEqual(store.get('a'), 1024);
});

test('Operator precedence', () => {
    const store = new ParameterStore();
    
    store.set('a', '2 + 3 * 4');
    assertEqual(store.get('a'), 14, '2 + 3 * 4');
    
    store.set('b', '10 - 2 * 3');
    assertEqual(store.get('b'), 4, '10 - 2 * 3');
    
    store.set('c', '2 ^ 3 * 2');
    assertEqual(store.get('c'), 16, '2 ^ 3 * 2');
});

test('Parentheses override precedence', () => {
    const store = new ParameterStore();
    
    store.set('a', '(2 + 3) * 4');
    assertEqual(store.get('a'), 20);
    
    store.set('b', '100 / (2 + 3)');
    assertEqual(store.get('b'), 20);
});

test('Nested parentheses', () => {
    const store = new ParameterStore();
    store.set('a', '((1 + 2) * (3 + 4))');
    assertEqual(store.get('a'), 21);
});

test('Unary minus', () => {
    const store = new ParameterStore();
    store.set('a', '-5');
    assertEqual(store.get('a'), -5);
    
    store.set('b', '-5 * 2');
    assertEqual(store.get('b'), -10);
    
    store.set('c', '10 + -3');
    assertEqual(store.get('c'), 7);
});

// ═══════════════════════════════════════════════════════════════
// VARIABLE REFERENCES
// ═══════════════════════════════════════════════════════════════

group('Variable References');

test('Simple reference', () => {
    const store = new ParameterStore();
    store.set('width', 100);
    store.set('height', 'width / 2');
    
    assertEqual(store.get('height'), 50);
});

test('Multiple references', () => {
    const store = new ParameterStore();
    store.set('a', 10);
    store.set('b', 20);
    store.set('c', 'a + b');
    
    assertEqual(store.get('c'), 30);
});

test('Chain of references', () => {
    const store = new ParameterStore();
    store.set('base', 100);
    store.set('half', 'base / 2');
    store.set('quarter', 'half / 2');
    
    assertEqual(store.get('quarter'), 25);
});

test('Reference update propagation', () => {
    const store = new ParameterStore();
    store.set('width', 100);
    store.set('height', 'width / 2');
    store.set('area', 'width * height');
    
    assertEqual(store.get('area'), 5000);
    
    // Update base parameter
    store.set('width', 200);
    
    // Dependents should update
    assertEqual(store.get('height'), 100);
    assertEqual(store.get('area'), 20000);
});

test('Complex expression with references', () => {
    const store = new ParameterStore();
    store.set('a', 10);
    store.set('b', 5);
    store.set('result', '(a + b) * 2 - a / 2');
    
    assertEqual(store.get('result'), 25); // (10 + 5) * 2 - 10 / 2 = 30 - 5 = 25
});

// ═══════════════════════════════════════════════════════════════
// BUILT-IN FUNCTIONS
// ═══════════════════════════════════════════════════════════════

group('Built-in Functions');

test('min function', () => {
    const store = new ParameterStore();
    store.set('a', 'min(10, 5)');
    assertEqual(store.get('a'), 5);
    
    store.set('b', 'min(1, 2, 3, -5, 10)');
    assertEqual(store.get('b'), -5);
});

test('max function', () => {
    const store = new ParameterStore();
    store.set('a', 'max(10, 5)');
    assertEqual(store.get('a'), 10);
    
    store.set('b', 'max(1, 2, 3, -5, 10)');
    assertEqual(store.get('b'), 10);
});

test('sqrt function', () => {
    const store = new ParameterStore();
    store.set('a', 'sqrt(16)');
    assertEqual(store.get('a'), 4);
    
    store.set('b', 'sqrt(2)');
    assertClose(store.get('b'), 1.4142135);
});

test('abs function', () => {
    const store = new ParameterStore();
    store.set('a', 'abs(-42)');
    assertEqual(store.get('a'), 42);
    
    store.set('b', 'abs(42)');
    assertEqual(store.get('b'), 42);
});

test('Trigonometric functions', () => {
    const store = new ParameterStore();
    
    store.set('s', 'sin(0)');
    assertEqual(store.get('s'), 0);
    
    store.set('c', 'cos(0)');
    assertEqual(store.get('c'), 1);
    
    store.set('t', 'tan(0)');
    assertEqual(store.get('t'), 0);
});

test('floor, ceil, round functions', () => {
    const store = new ParameterStore();
    
    store.set('a', 'floor(3.7)');
    assertEqual(store.get('a'), 3);
    
    store.set('b', 'ceil(3.2)');
    assertEqual(store.get('b'), 4);
    
    store.set('c', 'round(3.5)');
    assertEqual(store.get('c'), 4);
});

test('pow function', () => {
    const store = new ParameterStore();
    store.set('a', 'pow(2, 8)');
    assertEqual(store.get('a'), 256);
});

test('log functions', () => {
    const store = new ParameterStore();
    
    store.set('a', 'log(1)');
    assertEqual(store.get('a'), 0);
    
    store.set('b', 'log10(100)');
    assertClose(store.get('b'), 2);
});

test('rad/deg conversion', () => {
    const store = new ParameterStore();
    
    store.set('r', 'rad(180)');
    assertClose(store.get('r'), Math.PI);
    
    store.set('d', 'deg(PI)');
    assertClose(store.get('d'), 180);
});

test('Nested function calls', () => {
    const store = new ParameterStore();
    store.set('a', 'max(min(10, 20), 5)');
    assertEqual(store.get('a'), 10);
    
    store.set('b', 'sqrt(abs(-16))');
    assertEqual(store.get('b'), 4);
});

test('Functions with variable arguments', () => {
    const store = new ParameterStore();
    store.set('width', 100);
    store.set('height', 50);
    store.set('smaller', 'min(width, height)');
    
    assertEqual(store.get('smaller'), 50);
});

// ═══════════════════════════════════════════════════════════════
// BUILT-IN CONSTANTS
// ═══════════════════════════════════════════════════════════════

group('Built-in Constants');

test('PI constant', () => {
    const store = new ParameterStore();
    store.set('a', 'PI');
    assertClose(store.get('a'), Math.PI);
    
    store.set('b', 'PI * 2');
    assertClose(store.get('b'), Math.PI * 2);
});

test('E constant', () => {
    const store = new ParameterStore();
    store.set('a', 'E');
    assertClose(store.get('a'), Math.E);
});

test('TAU constant', () => {
    const store = new ParameterStore();
    store.set('a', 'TAU');
    assertClose(store.get('a'), Math.PI * 2);
});

// ═══════════════════════════════════════════════════════════════
// DEPENDENCY TRACKING
// ═══════════════════════════════════════════════════════════════

group('Dependency Tracking');

test('getDependencies returns direct dependencies', () => {
    const store = new ParameterStore();
    store.set('a', 10);
    store.set('b', 20);
    store.set('c', 'a + b');
    
    const deps = store.getDependencies('c');
    assert(deps.includes('a'), 'Should include a');
    assert(deps.includes('b'), 'Should include b');
    assertEqual(deps.length, 2);
});

test('getDependents returns direct dependents', () => {
    const store = new ParameterStore();
    store.set('base', 100);
    store.set('derived1', 'base * 2');
    store.set('derived2', 'base + 10');
    
    const deps = store.getDependents('base');
    assert(deps.includes('derived1'), 'Should include derived1');
    assert(deps.includes('derived2'), 'Should include derived2');
    assertEqual(deps.length, 2);
});

test('getAllDependents includes transitive dependents', () => {
    const store = new ParameterStore();
    store.set('a', 1);
    store.set('b', 'a * 2');
    store.set('c', 'b * 2');
    store.set('d', 'c * 2');
    
    const allDeps = store.getAllDependents('a');
    assert(allDeps.includes('b'), 'Should include b');
    assert(allDeps.includes('c'), 'Should include c');
    assert(allDeps.includes('d'), 'Should include d');
    assertEqual(allDeps.length, 3);
});

test('getParamDependencies helper function', () => {
    const deps = getParamDependencies('width * height + offset');
    assert(deps.includes('width'));
    assert(deps.includes('height'));
    assert(deps.includes('offset'));
    assertEqual(deps.length, 3);
});

test('Constants not included in dependencies', () => {
    const deps = getParamDependencies('PI * radius');
    assert(!deps.includes('PI'), 'PI should not be a dependency');
    assert(deps.includes('radius'));
    assertEqual(deps.length, 1);
});

// ═══════════════════════════════════════════════════════════════
// CIRCULAR DEPENDENCY DETECTION
// ═══════════════════════════════════════════════════════════════

group('Circular Dependency Detection');

test('Self-reference throws immediately', () => {
    const store = new ParameterStore();
    assertThrows(
        () => store.set('x', 'x + 1'),
        'Circular dependency'
    );
});

test('Two-step cycle detected on evaluation', () => {
    const store = new ParameterStore();
    store.set('a', 10); // Initially safe
    store.set('b', 'a + 1');
    
    // Now create cycle by redefining a
    store.set('a', 'b + 1');
    
    assertThrows(
        () => store.get('a'),
        'Circular dependency'
    );
});

test('checkCircular method', () => {
    const store = new ParameterStore();
    store.set('a', 10);
    store.set('b', 'a + 1');
    store.set('a', 'b + 1'); // Create cycle
    
    const result = store.checkCircular('a');
    assert(result.circular, 'Should detect cycle');
    assert(result.cycle.length > 0, 'Should report cycle path');
});

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════

group('Error Handling');

test('Unknown parameter throws', () => {
    const store = new ParameterStore();
    assertThrows(
        () => store.get('nonexistent'),
        'Unknown parameter'
    );
});

test('Division by zero throws', () => {
    const store = new ParameterStore();
    store.set('a', '10 / 0');
    assertThrows(
        () => store.get('a'),
        'Division by zero'
    );
});

test('Unknown function throws', () => {
    const store = new ParameterStore();
    assertThrows(
        () => store.set('a', 'unknownFunc(5)'),
        'Unknown function'
    );
});

test('Invalid parameter name (starts with number)', () => {
    const store = new ParameterStore();
    assertThrows(
        () => store.set('123abc', 10),
        'Invalid parameter name'
    );
});

test('Reserved constant name rejected', () => {
    const store = new ParameterStore();
    assertThrows(
        () => store.set('PI', 10),
        'reserved constant'
    );
});

test('Reserved function name rejected', () => {
    const store = new ParameterStore();
    assertThrows(
        () => store.set('sqrt', 10),
        'reserved function'
    );
});

test('Delete parameter with dependents throws', () => {
    const store = new ParameterStore();
    store.set('base', 100);
    store.set('derived', 'base * 2');
    
    assertThrows(
        () => store.delete('base'),
        'depend on it'
    );
});

test('Syntax error: unmatched parenthesis', () => {
    const store = new ParameterStore();
    assertThrows(
        () => store.set('a', '(10 + 5'),
        'Expected'
    );
});

// ═══════════════════════════════════════════════════════════════
// SERIALIZATION
// ═══════════════════════════════════════════════════════════════

group('Serialization');

test('toJSON exports all parameters', () => {
    const store = new ParameterStore();
    store.set('width', 100);
    store.set('height', 'width / 2');
    
    const json = store.toJSON();
    assertEqual(json.width, '100');
    assertEqual(json.height, 'width / 2');
});

test('fromJSON restores parameters', () => {
    const store = new ParameterStore();
    store.fromJSON({
        width: '100',
        height: 'width / 2',
        depth: 'min(width, height)'
    });
    
    assertEqual(store.get('width'), 100);
    assertEqual(store.get('height'), 50);
    assertEqual(store.get('depth'), 50);
});

test('Round-trip serialization preserves values', () => {
    const store1 = new ParameterStore();
    store1.set('a', 10);
    store1.set('b', 'a * 2 + 5');
    store1.set('c', 'max(a, b)');
    
    const json = store1.toJSON();
    
    const store2 = new ParameterStore();
    store2.fromJSON(json);
    
    assertEqual(store2.get('a'), store1.get('a'));
    assertEqual(store2.get('b'), store1.get('b'));
    assertEqual(store2.get('c'), store1.get('c'));
});

// ═══════════════════════════════════════════════════════════════
// GETALL AND LISTING
// ═══════════════════════════════════════════════════════════════

group('Parameter Listing');

test('getAll returns all parameters with values', () => {
    const store = new ParameterStore();
    store.set('x', 10);
    store.set('y', 'x * 2');
    
    const all = store.getAll();
    assertEqual(all.length, 2);
    
    const x = all.find(p => p.name === 'x');
    assertEqual(x.value, 10);
    assertEqual(x.expression, '10');
    
    const y = all.find(p => p.name === 'y');
    assertEqual(y.value, 20);
    assertEqual(y.expression, 'x * 2');
    assert(y.dependencies.includes('x'));
});

test('getTopologicalOrder returns correct order', () => {
    const store = new ParameterStore();
    store.set('c', 'b + 1');
    store.set('a', 1);
    store.set('b', 'a + 1');
    
    const order = store.getTopologicalOrder();
    
    // 'a' should come before 'b', 'b' before 'c'
    const aIdx = order.indexOf('a');
    const bIdx = order.indexOf('b');
    const cIdx = order.indexOf('c');
    
    assert(aIdx < bIdx, 'a should come before b');
    assert(bIdx < cIdx, 'b should come before c');
});

// ═══════════════════════════════════════════════════════════════
// EVALUATE HELPER
// ═══════════════════════════════════════════════════════════════

group('evaluateParam Helper');

test('Evaluates numbers directly', () => {
    const store = new ParameterStore();
    assertEqual(evaluateParam(42, store), 42);
    assertEqual(evaluateParam(3.14, store), 3.14);
});

test('Evaluates expression strings', () => {
    const store = new ParameterStore();
    store.set('base', 100);
    
    assertEqual(evaluateParam('base', store), 100);
    assertEqual(evaluateParam('base / 2', store), 50);
    assertEqual(evaluateParam('base + 10', store), 110);
});

test('Evaluates pure expressions without params', () => {
    const store = new ParameterStore();
    assertEqual(evaluateParam('10 * 5', store), 50);
    assertEqual(evaluateParam('sqrt(16)', store), 4);
});

// ═══════════════════════════════════════════════════════════════
// CACHING
// ═══════════════════════════════════════════════════════════════

group('Caching');

test('Cache is invalidated on update', () => {
    const store = new ParameterStore();
    store.set('x', 10);
    store.set('y', 'x * 2');
    
    assertEqual(store.get('y'), 20);
    
    store.set('x', 50);
    
    assertEqual(store.get('y'), 100);
});

test('Cache invalidates dependent chain', () => {
    const store = new ParameterStore();
    store.set('a', 1);
    store.set('b', 'a + 1');
    store.set('c', 'b + 1');
    store.set('d', 'c + 1');
    
    // Populate cache
    assertEqual(store.get('d'), 4);
    
    // Update root
    store.set('a', 10);
    
    // All should be updated
    assertEqual(store.get('b'), 11);
    assertEqual(store.get('c'), 12);
    assertEqual(store.get('d'), 13);
});

// ═══════════════════════════════════════════════════════════════
// RENAME
// ═══════════════════════════════════════════════════════════════

group('Parameter Renaming');

test('Rename updates dependent expressions', () => {
    const store = new ParameterStore();
    store.set('oldName', 100);
    store.set('derived', 'oldName * 2');
    
    store.rename('oldName', 'newName');
    
    assert(!store.has('oldName'), 'Old name should be gone');
    assert(store.has('newName'), 'New name should exist');
    
    assertEqual(store.get('newName'), 100);
    assertEqual(store.get('derived'), 200);
    assertEqual(store.getExpression('derived'), 'newName * 2');
});

// ═══════════════════════════════════════════════════════════════
// REAL-WORLD CAD EXAMPLES
// ═══════════════════════════════════════════════════════════════

group('CAD-like Usage Examples');

test('Box with proportional dimensions', () => {
    const store = new ParameterStore();
    store.set('width', 100);
    store.set('height', 'width / 2');
    store.set('depth', 'width + 10');
    
    assertEqual(store.get('width'), 100);
    assertEqual(store.get('height'), 50);
    assertEqual(store.get('depth'), 110);
    
    // Change base dimension
    store.set('width', 200);
    assertEqual(store.get('height'), 100);
    assertEqual(store.get('depth'), 210);
});

test('Fillet radius as fraction of smallest dimension', () => {
    const store = new ParameterStore();
    store.set('width', 100);
    store.set('height', 60);
    store.set('filletRadius', 'min(width, height) / 10');
    
    assertEqual(store.get('filletRadius'), 6);
});

test('Circular pattern count', () => {
    const store = new ParameterStore();
    store.set('angle', 360);
    store.set('spacing', 45);
    store.set('count', 'floor(angle / spacing)');
    
    assertEqual(store.get('count'), 8);
});

test('Wall thickness and inner dimensions', () => {
    const store = new ParameterStore();
    store.set('outerWidth', 100);
    store.set('wallThickness', 5);
    store.set('innerWidth', 'outerWidth - 2 * wallThickness');
    
    assertEqual(store.get('innerWidth'), 90);
});

test('Gear calculations', () => {
    const store = new ParameterStore();
    store.set('module', 2);
    store.set('teeth', 20);
    store.set('pitchDiameter', 'module * teeth');
    store.set('addendum', 'module');
    store.set('dedendum', 'module * 1.25');
    store.set('outerDiameter', 'pitchDiameter + 2 * addendum');
    store.set('rootDiameter', 'pitchDiameter - 2 * dedendum');
    
    assertEqual(store.get('pitchDiameter'), 40);
    assertEqual(store.get('outerDiameter'), 44);
    assertEqual(store.get('rootDiameter'), 35);
});

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(50));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(50));

if (isNode) {
    process.exit(failed > 0 ? 1 : 0);
}
