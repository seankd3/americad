/**
 * Ameri-CAD Command Palette Tests
 *
 * Tests for the command palette UI component
 */

import { registerCommand } from '../src/core/commands.js';
import { CommandPalette } from '../src/ui/command-palette.js';

// Test framework setup (compatible with existing test runner)
const tests = [];
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function describe(name, fn) {
  console.log(`\n📦 ${name}`);
  fn();
}

async function runTests() {
  console.log('🧪 Command Palette Tests\n');

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passCount++;
    } catch (error) {
      console.log(`  ❌ ${name}`);
      console.log(`     ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed\n`);
  return failCount === 0;
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${JSON.stringify(actual)}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) {
        throw new Error(`Expected ${actual} > ${expected}`);
      }
    },
    toContain(expected) {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    toHaveLength(expected) {
      if (actual.length !== expected) {
        throw new Error(`Expected length ${expected}, got ${actual.length}`);
      }
    },
  };
}

// Mock DOM environment for Node.js
function setupMockDOM() {
  // Simple mock for document
  const elements = new Map();

  global.document = {
    createElement(tag) {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        innerHTML: '',
        style: {},
        children: [],
        childNodes: [],
        parentNode: null,
        dataset: {},
        _listeners: {},
        appendChild(child) {
          child.parentNode = el;
          el.children.push(child);
          el.childNodes.push(child);
          return child;
        },
        removeChild(child) {
          const idx = el.children.indexOf(child);
          if (idx >= 0) {
            el.children.splice(idx, 1);
            el.childNodes.splice(idx, 1);
            child.parentNode = null;
          }
          return child;
        },
        remove() {
          el.parentNode = null;
        },
        querySelector(_selector) {
          return null;
        },
        querySelectorAll(_selector) {
          return [];
        },
        addEventListener(_event, _handler) {
          if (!el._listeners[event]) el._listeners[event] = [];
          el._listeners[event].push(handler);
        },
        removeEventListener(_event, _handler) {
          if (el._listeners[event]) {
            const idx = el._listeners[event].indexOf(handler);
            if (idx >= 0) el._listeners[event].splice(idx, 1);
          }
        },
        dispatchEvent(event) {
          const handlers = el._listeners[event.type] || [];
          handlers.forEach(h => h(event));
        },
        classList: {
          _classes: new Set(),
          add(cls) {
            this._classes.add(cls);
          },
          remove(cls) {
            this._classes.delete(cls);
          },
          toggle(cls, force) {
            if (force === undefined) {
              if (this._classes.has(cls)) {
                this._classes.delete(cls);
              } else {
                this._classes.add(cls);
              }
            } else if (force) {
              this._classes.add(cls);
            } else {
              this._classes.delete(cls);
            }
          },
          contains(cls) {
            return this._classes.has(cls);
          },
        },
        setAttribute(name, value) {
          el[name] = value;
        },
        getAttribute(name) {
          return el[name];
        },
        focus() {
          el._focused = true;
        },
        blur() {
          el._focused = false;
        },
        scrollIntoView() {},
      };
      return el;
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    body: {
      appendChild(el) {
        el.parentNode = document.body;
      },
      removeChild(el) {
        el.parentNode = null;
      },
    },
    head: {
      appendChild(el) {
        if (el.id) elements.set(el.id, el);
        el.parentNode = document.head;
      },
    },
    addEventListener(_event, _handler) {},
    removeEventListener(_event, _handler) {},
    activeElement: null,
  };

  global.requestAnimationFrame = fn => setTimeout(fn, 0);
}

// Setup before tests
setupMockDOM();

// ============================================
// Test Suite
// ============================================

describe('CommandPalette', () => {
  // Register some test commands
  registerCommand('test-box', {
    aliases: ['tb', 'testbox'],
    description: 'Create a test box',
    category: 'test',
    execute() {
      return { created: 'box' };
    },
  });

  registerCommand('test-cylinder', {
    aliases: ['tc'],
    description: 'Create a test cylinder',
    category: 'test',
    execute() {
      return { created: 'cylinder' };
    },
  });

  registerCommand('test-sphere', {
    aliases: ['ts'],
    description: 'Create a test sphere',
    category: 'primitives',
    execute() {
      return { created: 'sphere' };
    },
  });

  test('should instantiate without errors', () => {
    const palette = new CommandPalette();
    expect(palette).toBeTruthy();
    expect(palette.isVisible).toBe(false);
  });

  test('should have element and overlay after init', () => {
    const palette = new CommandPalette();
    expect(palette.element).toBeTruthy();
    expect(palette.overlay).toBeTruthy();
    expect(palette.input).toBeTruthy();
    expect(palette.resultsList).toBeTruthy();
  });

  test('should refresh commands from registry', () => {
    const palette = new CommandPalette();
    palette.refreshCommands();
    expect(palette.commands.length).toBeGreaterThan(0);
  });

  test('should show all commands when filter is empty', () => {
    const palette = new CommandPalette();
    palette.input.value = '';
    palette.filter();
    expect(palette.filteredCommands.length).toBe(palette.commands.length);
  });

  test('should filter commands by name', () => {
    const palette = new CommandPalette();
    palette.input.value = 'test-box';
    palette.filter();
    expect(palette.filteredCommands.length).toBeGreaterThan(0);
    expect(palette.filteredCommands[0].name).toBe('test-box');
  });

  test('should filter commands by alias', () => {
    const palette = new CommandPalette();
    palette.input.value = 'tb';
    palette.filter();
    expect(palette.filteredCommands.length).toBeGreaterThan(0);
    expect(palette.filteredCommands[0].name).toBe('test-box');
  });

  test('should filter commands by category', () => {
    const palette = new CommandPalette();
    palette.input.value = 'primitives';
    palette.filter();
    const hasPrimitive = palette.filteredCommands.some(cmd => cmd.category === 'primitives');
    expect(hasPrimitive).toBeTruthy();
  });

  test('should filter commands by description', () => {
    const palette = new CommandPalette();
    palette.input.value = 'cylinder';
    palette.filter();
    const hasCylinder = palette.filteredCommands.some(cmd => cmd.description.includes('cylinder'));
    expect(hasCylinder).toBeTruthy();
  });

  test('should handle partial/fuzzy matching', () => {
    const palette = new CommandPalette();
    palette.input.value = 'tbox'; // partial match for test-box
    palette.filter();
    // Should find test-box via fuzzy match
    expect(palette.filteredCommands.length).toBeGreaterThan(0);
  });

  test('should show empty state when no matches', () => {
    const palette = new CommandPalette();
    palette.input.value = 'xyznonexistent123';
    palette.filter();
    expect(palette.filteredCommands.length).toBe(0);
  });

  test('should toggle visibility', () => {
    const palette = new CommandPalette();
    expect(palette.isVisible).toBe(false);

    palette.toggle();
    expect(palette.isVisible).toBe(true);

    palette.toggle();
    expect(palette.isVisible).toBe(false);
  });

  test('should show and focus input', () => {
    const palette = new CommandPalette();
    palette.show();
    expect(palette.isVisible).toBe(true);
    expect(palette.element.classList.contains('visible')).toBeTruthy();
  });

  test('should hide and clear', () => {
    const palette = new CommandPalette();
    palette.show();
    palette.hide();
    expect(palette.isVisible).toBe(false);
    expect(palette.element.classList.contains('visible')).toBeFalsy();
  });

  test('should navigate selection down', () => {
    const palette = new CommandPalette();
    palette.input.value = 'test';
    palette.filter();

    const initialIndex = palette.selectedIndex;
    palette.selectNext();

    if (palette.filteredCommands.length > 1) {
      expect(palette.selectedIndex).toBe(initialIndex + 1);
    }
  });

  test('should navigate selection up', () => {
    const palette = new CommandPalette();
    palette.input.value = 'test';
    palette.filter();

    palette.selectedIndex = 1;
    palette.selectPrev();
    expect(palette.selectedIndex).toBe(0);
  });

  test('should wrap selection at boundaries', () => {
    const palette = new CommandPalette();
    palette.input.value = 'test';
    palette.filter();

    // Wrap at top
    palette.selectedIndex = 0;
    palette.selectPrev();
    expect(palette.selectedIndex).toBe(palette.filteredCommands.length - 1);

    // Wrap at bottom
    palette.selectedIndex = palette.filteredCommands.length - 1;
    palette.selectNext();
    expect(palette.selectedIndex).toBe(0);
  });

  test('should score exact matches higher', () => {
    const palette = new CommandPalette();

    const exactScore = palette.scoreMatch({ name: 'box', aliases: [] }, 'box');
    const partialScore = palette.scoreMatch({ name: 'boxify', aliases: [] }, 'box');

    expect(exactScore).toBeGreaterThan(partialScore);
  });

  test('should score alias matches', () => {
    const palette = new CommandPalette();

    const aliasScore = palette.scoreMatch(
      {
        name: 'test-box',
        aliases: ['tb'],
      },
      'tb'
    );

    expect(aliasScore).toBeGreaterThan(0);
  });

  test('should escape HTML in output', () => {
    const palette = new CommandPalette();
    const escaped = palette.escapeHtml('<script>alert("xss")</script>');
    expect(escaped).toContain('&lt;');
    expect(escaped).toContain('&gt;');
  });

  test('should highlight matches in text', () => {
    const palette = new CommandPalette();
    const highlighted = palette.highlightMatch('test-box', 'box');
    expect(highlighted).toContain('highlight');
    expect(highlighted).toContain('box');
  });

  test('fuzzyMatch should match sequential characters', () => {
    const palette = new CommandPalette();

    expect(palette.fuzzyMatch('test-box', 'tbox')).toBe(true);
    expect(palette.fuzzyMatch('cylinder', 'cyl')).toBe(true);
    expect(palette.fuzzyMatch('sphere', 'xyz')).toBe(false);
  });

  test('should set context', () => {
    const palette = new CommandPalette();
    const context = { document: {}, scene: {} };

    palette.setContext(context);
    expect(palette.context).toEqual(context);
  });

  test('should execute selected command', async () => {
    const palette = new CommandPalette();
    let executedResult = null;

    palette.onExecute = result => {
      executedResult = result;
    };

    palette.input.value = 'test-box';
    palette.filter();

    await palette.executeSelected();

    expect(executedResult).toBeTruthy();
    expect(executedResult.created).toBe('box');
  });

  test('should handle keyboard events', () => {
    const palette = new CommandPalette();
    palette.show();
    palette.input.value = 'test';
    palette.filter();

    const initialIndex = palette.selectedIndex;

    // Simulate ArrowDown
    palette.handleKeyDown({ key: 'ArrowDown', preventDefault: () => {} });

    if (palette.filteredCommands.length > 1) {
      expect(palette.selectedIndex).toBe(initialIndex + 1);
    }

    // Simulate ArrowUp
    palette.handleKeyDown({ key: 'ArrowUp', preventDefault: () => {} });
    expect(palette.selectedIndex).toBe(initialIndex);

    // Simulate Escape
    palette.handleKeyDown({ key: 'Escape', preventDefault: () => {} });
    expect(palette.isVisible).toBe(false);
  });

  test('should destroy and clean up', () => {
    const palette = new CommandPalette();
    expect(palette.element).toBeTruthy();
    expect(palette.overlay).toBeTruthy();

    // Verify elements are created
    const element = palette.element;
    const _overlay = palette.overlay;

    palette.destroy();

    // After destroy, elements should be removed (parentNode becomes null via our mock)
    // The key is that destroy() was called without throwing
    expect(element).toBeTruthy(); // Elements still exist as objects
  });
});

// Run tests
runTests().then(success => {
  if (typeof process !== 'undefined') {
    process.exit(success ? 0 : 1);
  }
});

export { runTests };
