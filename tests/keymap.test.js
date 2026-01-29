/**
 * Ameri-CAD Keymap Tests
 * Tests for keyboard shortcut customization from src/core/keymap.js
 */

import { KeymapManager, defaultKeymap, actionMetadata } from '../src/core/keymap.js';

// Export for runner compatibility
window.KeymapManager = KeymapManager;

describe('KeymapManager', function () {
  let manager;

  beforeEach(function () {
    // Create a fresh manager for each test
    // Clear any stored keymaps
    try {
      localStorage.removeItem('ameri-cad-keymap');
    } catch {
      // localStorage might not be available
    }
    manager = new KeymapManager();
  });

  afterEach(function () {
    // Clean up localStorage
    try {
      localStorage.removeItem('ameri-cad-keymap');
    } catch {
      // localStorage might not be available
    }
  });

  describe('Default Keymap', function () {
    it('should have all default shortcuts loaded', function () {
      expect(manager.keymap).to.be.an('object');
      expect(Object.keys(manager.keymap).length).to.be.at.least(10);
    });

    it('should have common shortcuts', function () {
      expect(manager.getActionForShortcut('ctrl+s')).to.equal('save');
      expect(manager.getActionForShortcut('ctrl+z')).to.equal('undo');
      expect(manager.getActionForShortcut('ctrl+c')).to.equal('copy');
    });

    it('should have Blender-style transform shortcuts', function () {
      expect(manager.getActionForShortcut('g')).to.equal('grab');
      expect(manager.getActionForShortcut('r')).to.equal('rotate');
      expect(manager.getActionForShortcut('s')).to.equal('scale');
    });

    it('should have view shortcuts', function () {
      expect(manager.getActionForShortcut('1')).to.equal('viewFront');
      expect(manager.getActionForShortcut('3')).to.equal('viewRight');
      expect(manager.getActionForShortcut('7')).to.equal('viewTop');
      expect(manager.getActionForShortcut('5')).to.equal('toggleOrtho');
    });
  });

  describe('bind()', function () {
    it('should bind a shortcut to an action', function () {
      manager.bind('ctrl+b', 'box');
      expect(manager.getActionForShortcut('ctrl+b')).to.equal('box');
    });

    it('should return conflict info when overwriting', function () {
      manager.bind('ctrl+t', 'test1');
      const conflict = manager.bind('ctrl+t', 'test2');

      expect(conflict).to.not.be.null;
      expect(conflict.previousAction).to.equal('test1');
      expect(manager.getActionForShortcut('ctrl+t')).to.equal('test2');
    });

    it('should return null when no conflict', function () {
      const conflict = manager.bind('ctrl+shift+alt+x', 'testAction');
      expect(conflict).to.be.null;
    });

    it('should normalize shortcut format', function () {
      manager.bind('Ctrl+Shift+A', 'selectAll');
      expect(manager.getActionForShortcut('ctrl+shift+a')).to.equal('selectAll');
    });

    it('should update reverse map', function () {
      manager.bind('ctrl+q', 'quit');
      const shortcuts = manager.getShortcutsForAction('quit');
      expect(shortcuts).to.include('ctrl+q');
    });
  });

  describe('unbind()', function () {
    it('should remove a shortcut binding', function () {
      manager.bind('ctrl+t', 'test');
      const removed = manager.unbind('ctrl+t');

      expect(removed).to.equal('test');
      expect(manager.getActionForShortcut('ctrl+t')).to.be.null;
    });

    it('should return null for non-existent shortcut', function () {
      const result = manager.unbind('ctrl+shift+alt+nonexistent');
      expect(result).to.be.null;
    });

    it('should update reverse map', function () {
      const original = manager.getShortcutsForAction('save');
      expect(original).to.include('ctrl+s');

      manager.unbind('ctrl+s');
      const updated = manager.getShortcutsForAction('save');
      expect(updated).to.not.include('ctrl+s');
    });
  });

  describe('eventToKey()', function () {
    function mockEvent(options) {
      return {
        key: options.key || '',
        ctrlKey: options.ctrl || false,
        shiftKey: options.shift || false,
        altKey: options.alt || false,
        metaKey: options.meta || false,
      };
    }

    it('should convert basic key press', function () {
      const event = mockEvent({ key: 'a' });
      expect(manager.eventToKey(event)).to.equal('a');
    });

    it('should handle ctrl modifier', function () {
      const event = mockEvent({ key: 's', ctrl: true });
      expect(manager.eventToKey(event)).to.equal('ctrl+s');
    });

    it('should handle multiple modifiers', function () {
      const event = mockEvent({ key: 's', ctrl: true, shift: true });
      expect(manager.eventToKey(event)).to.equal('ctrl+shift+s');
    });

    it('should handle all modifiers', function () {
      const event = mockEvent({ key: 'a', ctrl: true, shift: true, alt: true });
      expect(manager.eventToKey(event)).to.equal('ctrl+shift+alt+a');
    });

    it('should lowercase key names', function () {
      const event = mockEvent({ key: 'A', shift: true });
      expect(manager.eventToKey(event)).to.equal('shift+a');
    });

    it('should convert special keys', function () {
      expect(manager.eventToKey(mockEvent({ key: ' ' }))).to.equal('space');
      expect(manager.eventToKey(mockEvent({ key: 'ArrowUp' }))).to.equal('up');
      expect(manager.eventToKey(mockEvent({ key: 'ArrowDown' }))).to.equal('down');
    });

    it('should ignore modifier-only events', function () {
      expect(manager.eventToKey(mockEvent({ key: 'Control', ctrl: true }))).to.equal('ctrl');
      expect(manager.eventToKey(mockEvent({ key: 'Shift', shift: true }))).to.equal('shift');
    });
  });

  describe('normalizeShortcut()', function () {
    it('should lowercase all parts', function () {
      expect(manager.normalizeShortcut('CTRL+S')).to.equal('ctrl+s');
    });

    it('should sort modifiers consistently', function () {
      expect(manager.normalizeShortcut('alt+ctrl+shift+a')).to.equal('ctrl+shift+alt+a');
      expect(manager.normalizeShortcut('shift+ctrl+a')).to.equal('ctrl+shift+a');
    });

    it('should handle cmd/meta as ctrl', function () {
      expect(manager.normalizeShortcut('cmd+s')).to.equal('ctrl+s');
      expect(manager.normalizeShortcut('meta+s')).to.equal('ctrl+s');
    });

    it('should handle option as alt', function () {
      expect(manager.normalizeShortcut('option+a')).to.equal('alt+a');
    });

    it('should trim whitespace', function () {
      expect(manager.normalizeShortcut(' ctrl + s ')).to.equal('ctrl+s');
    });
  });

  describe('getAction()', function () {
    it('should return action for matching event', function () {
      const event = { key: 's', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false };
      expect(manager.getAction(event)).to.equal('save');
    });

    it('should return null for unbound shortcut', function () {
      const event = { key: 'q', ctrlKey: true, shiftKey: true, altKey: true, metaKey: false };
      expect(manager.getAction(event)).to.be.null;
    });
  });

  describe('checkConflict()', function () {
    it('should detect conflict with existing binding', function () {
      const conflict = manager.checkConflict('ctrl+s');
      expect(conflict).to.not.be.null;
      expect(conflict.action).to.equal('save');
    });

    it('should return null when no conflict', function () {
      const conflict = manager.checkConflict('ctrl+shift+alt+q');
      expect(conflict).to.be.null;
    });

    it('should not report conflict when binding to same action', function () {
      const conflict = manager.checkConflict('ctrl+s', 'save');
      expect(conflict).to.be.null;
    });

    it('should include action metadata in conflict', function () {
      const conflict = manager.checkConflict('ctrl+s');
      expect(conflict.metadata).to.be.an('object');
      expect(conflict.metadata.category).to.equal('file');
    });
  });

  describe('Persistence', function () {
    it('should save custom bindings to localStorage', function () {
      manager.bind('ctrl+q', 'quit');

      const saved = localStorage.getItem('ameri-cad-keymap');
      expect(saved).to.not.be.null;

      const parsed = JSON.parse(saved);
      expect(parsed['ctrl+q']).to.equal('quit');
    });

    it('should load custom bindings on creation', function () {
      manager.bind('ctrl+q', 'quit');

      // Create new manager - should load from localStorage
      const newManager = new KeymapManager();
      expect(newManager.getActionForShortcut('ctrl+q')).to.equal('quit');
    });

    it('should persist across sessions', function () {
      manager.bind('ctrl+w', 'close');
      manager.unbind('g'); // Remove a default

      const newManager = new KeymapManager();
      expect(newManager.getActionForShortcut('ctrl+w')).to.equal('close');
      expect(newManager.getActionForShortcut('g')).to.be.null;
    });

    it('should only save differences from defaults', function () {
      // Just save with no changes
      manager.save();

      const saved = localStorage.getItem('ameri-cad-keymap');
      const parsed = JSON.parse(saved || '{}');

      // Should be empty or very small
      expect(Object.keys(parsed).length).to.be.lessThan(5);
    });
  });

  describe('reset()', function () {
    it('should restore all default shortcuts', function () {
      // Make some changes
      manager.bind('ctrl+q', 'quit');
      manager.unbind('g');
      manager.bind('ctrl+s', 'custom');

      // Reset
      manager.reset();

      // Verify defaults restored
      expect(manager.getActionForShortcut('ctrl+s')).to.equal('save');
      expect(manager.getActionForShortcut('g')).to.equal('grab');
      expect(manager.getActionForShortcut('ctrl+q')).to.be.null;
    });

    it('should clear localStorage customizations', function () {
      manager.bind('ctrl+q', 'quit');
      expect(localStorage.getItem('ameri-cad-keymap')).to.not.be.null;

      manager.reset();

      // LocalStorage should still exist but have empty/minimal customizations
      const newManager = new KeymapManager();
      expect(newManager.getActionForShortcut('ctrl+q')).to.be.null;
    });
  });

  describe('getBindingsByCategory()', function () {
    it('should return bindings grouped by category', function () {
      const byCategory = manager.getBindingsByCategory();

      expect(byCategory).to.be.an('object');
      expect(byCategory.file).to.be.an('array');
      expect(byCategory.edit).to.be.an('array');
      expect(byCategory.transform).to.be.an('array');
      expect(byCategory.view).to.be.an('array');
    });

    it('should include action metadata', function () {
      const byCategory = manager.getBindingsByCategory();
      const saveAction = byCategory.file.find(a => a.action === 'save');

      expect(saveAction).to.exist;
      expect(saveAction.description).to.equal('Save document');
      expect(saveAction.shortcuts).to.include('ctrl+s');
    });

    it('should indicate modified bindings', function () {
      manager.unbind('ctrl+s');
      const byCategory = manager.getBindingsByCategory();
      const saveAction = byCategory.file.find(a => a.action === 'save');

      // Since we unbound, shortcuts should be empty
      expect(saveAction.shortcuts).to.be.empty;
    });
  });

  describe('Export/Import', function () {
    it('should export keymap as JSON', function () {
      const json = manager.exportKeymap();
      const parsed = JSON.parse(json);

      expect(parsed.version).to.equal(1);
      expect(parsed.keymap).to.be.an('object');
      expect(parsed.keymap['ctrl+s']).to.equal('save');
      expect(parsed.exportedAt).to.be.a('string');
    });

    it('should import valid keymap', function () {
      const exportedJson = JSON.stringify({
        version: 1,
        keymap: {
          'ctrl+q': 'quit',
          'ctrl+w': 'close',
        },
      });

      const result = manager.importKeymap(exportedJson);

      expect(result.success).to.be.true;
      expect(result.count).to.equal(2);
      expect(manager.getActionForShortcut('ctrl+q')).to.equal('quit');
    });

    it('should reject invalid keymap format', function () {
      const result = manager.importKeymap('{"invalid": true}');
      expect(result.success).to.be.false;
      expect(result.error).to.include('Invalid keymap');
    });

    it('should reject invalid JSON', function () {
      const result = manager.importKeymap('not json at all');
      expect(result.success).to.be.false;
      expect(result.error).to.include('Parse error');
    });

    it('should round-trip export/import', function () {
      manager.bind('ctrl+q', 'quit');

      const exported = manager.exportKeymap();

      // Create new manager and import
      const newManager = new KeymapManager();
      newManager.reset();
      const result = newManager.importKeymap(exported);

      expect(result.success).to.be.true;
      expect(newManager.getActionForShortcut('ctrl+q')).to.equal('quit');
    });
  });

  describe('Listeners', function () {
    it('should notify on bind', function (done) {
      manager.subscribe((event, data) => {
        if (event === 'bind') {
          expect(data.shortcut).to.equal('ctrl+t');
          expect(data.action).to.equal('test');
          done();
        }
      });

      manager.bind('ctrl+t', 'test');
    });

    it('should notify on unbind', function (done) {
      manager.bind('ctrl+t', 'test');

      manager.subscribe((event, data) => {
        if (event === 'unbind') {
          expect(data.shortcut).to.equal('ctrl+t');
          expect(data.action).to.equal('test');
          done();
        }
      });

      manager.unbind('ctrl+t');
    });

    it('should notify on reset', function (done) {
      manager.subscribe(event => {
        if (event === 'reset') {
          done();
        }
      });

      manager.reset();
    });

    it('should allow unsubscribe', function () {
      let callCount = 0;

      const unsubscribe = manager.subscribe(() => {
        callCount++;
      });

      manager.bind('ctrl+t', 'test');
      expect(callCount).to.equal(1);

      unsubscribe();

      manager.bind('ctrl+u', 'test2');
      expect(callCount).to.equal(1); // Should not increase
    });
  });

  describe('formatShortcut()', function () {
    it('should format basic shortcuts', function () {
      // Non-Mac format
      expect(manager.formatShortcut('ctrl+s')).to.match(/Ctrl\+S|⌘S/);
      expect(manager.formatShortcut('shift+a')).to.match(/Shift\+A|⇧A/);
    });

    it('should handle special keys', function () {
      expect(manager.formatShortcut('delete')).to.equal('Del');
      expect(manager.formatShortcut('escape')).to.equal('Esc');
    });
  });

  describe('getShortcutsForAction()', function () {
    it('should return all shortcuts for action', function () {
      const undoShortcuts = manager.getShortcutsForAction('redo');
      // redo has both ctrl+shift+z and ctrl+y by default
      expect(undoShortcuts.length).to.be.at.least(1);
    });

    it('should return empty array for unknown action', function () {
      const shortcuts = manager.getShortcutsForAction('nonExistentAction');
      expect(shortcuts).to.be.an('array');
      expect(shortcuts).to.be.empty;
    });

    it('should update after bind', function () {
      manager.bind('ctrl+alt+s', 'save');
      const shortcuts = manager.getShortcutsForAction('save');
      expect(shortcuts).to.include('ctrl+s');
      expect(shortcuts).to.include('ctrl+alt+s');
    });
  });
});

describe('Default Keymap Constants', function () {
  it('should have all required file operations', function () {
    expect(defaultKeymap['ctrl+s']).to.equal('save');
    expect(defaultKeymap['ctrl+o']).to.equal('open');
    expect(defaultKeymap['ctrl+n']).to.equal('new');
  });

  it('should have all required edit operations', function () {
    expect(defaultKeymap['ctrl+z']).to.equal('undo');
    expect(defaultKeymap['ctrl+c']).to.equal('copy');
    expect(defaultKeymap['ctrl+v']).to.equal('paste');
    expect(defaultKeymap['delete']).to.equal('delete');
  });

  it('should have transform shortcuts', function () {
    expect(defaultKeymap['g']).to.equal('grab');
    expect(defaultKeymap['r']).to.equal('rotate');
    expect(defaultKeymap['s']).to.equal('scale');
  });
});

describe('Action Metadata', function () {
  it('should have metadata for all default actions', function () {
    const actions = new Set(Object.values(defaultKeymap));

    for (const action of actions) {
      expect(actionMetadata[action], `Missing metadata for: ${action}`).to.exist;
      expect(actionMetadata[action].description).to.be.a('string');
      expect(actionMetadata[action].category).to.be.a('string');
    }
  });

  it('should categorize actions correctly', function () {
    expect(actionMetadata.save.category).to.equal('file');
    expect(actionMetadata.undo.category).to.equal('edit');
    expect(actionMetadata.grab.category).to.equal('transform');
    expect(actionMetadata.box.category).to.equal('tools');
    expect(actionMetadata.viewFront.category).to.equal('view');
  });
});
