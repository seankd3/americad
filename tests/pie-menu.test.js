/**
 * Ameri-CAD Pie Menu Tests
 *
 * Tests for radial pie menu system (Blender-style)
 */

import { PieMenu, PieMenuContext, DEFAULT_PIE_ITEMS } from '../src/ui/pie-menu.js';

describe('PieMenu', function () {
  let pieMenu;
  let actionCallback;
  let contextCallback;
  let logMessages;
  let mockContainer;

  beforeEach(function () {
    // Create mock container
    mockContainer = document.createElement('div');
    mockContainer.id = 'pie-menu-test-container';
    document.body.appendChild(mockContainer);

    logMessages = [];
    actionCallback = function (id, item, context) {
      logMessages.push({ type: 'action', id, item, context });
    };
    contextCallback = function () {
      return PieMenuContext.DEFAULT;
    };

    // Create instance
    pieMenu = new PieMenu({
      container: mockContainer,
      onAction: actionCallback,
      getContext: contextCallback,
      log: function (msg, type) {
        logMessages.push({ msg, type });
      },
    });
  });

  afterEach(function () {
    if (pieMenu) {
      pieMenu.destroy();
    }
    if (mockContainer && mockContainer.parentNode) {
      mockContainer.parentNode.removeChild(mockContainer);
    }
  });

  describe('Construction', function () {
    it('should create pie menu with default options', function () {
      expect(pieMenu.radius).to.equal(100);
      expect(pieMenu.itemRadius).to.equal(40);
      expect(pieMenu.deadZone).to.equal(30);
      expect(pieMenu.holdDelay).to.equal(150);
    });

    it('should accept custom options', function () {
      const custom = new PieMenu({
        container: mockContainer,
        radius: 150,
        itemRadius: 50,
        deadZone: 40,
        holdDelay: 200,
      });

      expect(custom.radius).to.equal(150);
      expect(custom.itemRadius).to.equal(50);
      expect(custom.deadZone).to.equal(40);
      expect(custom.holdDelay).to.equal(200);

      custom.destroy();
    });

    it('should create DOM elements', function () {
      expect(pieMenu.element).to.exist;
      expect(pieMenu.backgroundElement).to.exist;
      expect(pieMenu.centerElement).to.exist;
    });

    it('should add styles to document', function () {
      const styleEl = document.getElementById('pie-menu-styles');
      expect(styleEl).to.exist;
    });
  });

  describe('PieMenuContext', function () {
    it('should have expected context types', function () {
      expect(PieMenuContext.DEFAULT).to.equal('default');
      expect(PieMenuContext.SELECTION).to.equal('selection');
      expect(PieMenuContext.SKETCH).to.equal('sketch');
    });
  });

  describe('DEFAULT_PIE_ITEMS', function () {
    it('should have items for all contexts', function () {
      expect(DEFAULT_PIE_ITEMS[PieMenuContext.DEFAULT]).to.exist;
      expect(DEFAULT_PIE_ITEMS[PieMenuContext.SELECTION]).to.exist;
      expect(DEFAULT_PIE_ITEMS[PieMenuContext.SKETCH]).to.exist;
    });

    it('should have 8 items per context', function () {
      expect(DEFAULT_PIE_ITEMS[PieMenuContext.DEFAULT].length).to.equal(8);
      expect(DEFAULT_PIE_ITEMS[PieMenuContext.SELECTION].length).to.equal(8);
      expect(DEFAULT_PIE_ITEMS[PieMenuContext.SKETCH].length).to.equal(8);
    });

    it('should have required properties on items', function () {
      const item = DEFAULT_PIE_ITEMS[PieMenuContext.DEFAULT][0];
      expect(item.id).to.exist;
      expect(item.label).to.exist;
      expect(item.icon).to.exist;
      expect(item.position).to.exist;
    });
  });

  describe('Show/Hide', function () {
    beforeEach(function () {
      pieMenu.enable();
    });

    it('should show menu at specified position', function () {
      pieMenu.show(100, 200, 'q');

      expect(pieMenu.isVisible()).to.be.true;
      expect(pieMenu.state.centerX).to.equal(100);
      expect(pieMenu.state.centerY).to.equal(200);
      expect(pieMenu.element.style.left).to.equal('100px');
      expect(pieMenu.element.style.top).to.equal('200px');
    });

    it('should not show if already visible', function () {
      pieMenu.show(100, 200, 'q');
      pieMenu.show(300, 400, 'q'); // Should be ignored

      expect(pieMenu.state.centerX).to.equal(100);
      expect(pieMenu.state.centerY).to.equal(200);
    });

    it('should render items on show', function () {
      pieMenu.show(500, 500, 'q');

      expect(pieMenu.itemElements.length).to.equal(8);
    });

    it('should hide menu', function () {
      pieMenu.show(500, 500, 'q');
      pieMenu.hide();

      expect(pieMenu.isVisible()).to.be.false;
    });

    it('should add visible class when shown', function () {
      pieMenu.show(500, 500, 'q');

      expect(pieMenu.element.classList.contains('visible')).to.be.true;
      expect(pieMenu.backgroundElement.classList.contains('visible')).to.be.true;
    });

    it('should remove visible class when hidden', function () {
      pieMenu.show(500, 500, 'q');
      pieMenu.hide();

      expect(pieMenu.element.classList.contains('visible')).to.be.false;
      expect(pieMenu.backgroundElement.classList.contains('visible')).to.be.false;
    });
  });

  describe('Selection', function () {
    beforeEach(function () {
      pieMenu.enable();
      pieMenu.show(500, 500, 'q');
    });

    it('should return null when no selection', function () {
      expect(pieMenu.getSelected()).to.be.null;
    });

    it('should not select when in dead zone', function () {
      pieMenu.updateSelection(510, 510); // Close to center

      expect(pieMenu.state.selectedIndex).to.equal(-1);
      expect(pieMenu.getSelected()).to.be.null;
    });

    it('should select item when moved outside dead zone', function () {
      // Move to top (item 0)
      pieMenu.updateSelection(500, 400);

      expect(pieMenu.state.selectedIndex).to.equal(0);
      expect(pieMenu.getSelected()).to.not.be.null;
    });

    it('should select correct item based on angle - top', function () {
      // Top (0 degrees) -> index 0
      pieMenu.updateSelection(500, 400);
      expect(pieMenu.state.selectedIndex).to.equal(0);
    });

    it('should select correct item based on angle - right', function () {
      // Right (90 degrees) -> index 2
      pieMenu.updateSelection(600, 500);
      expect(pieMenu.state.selectedIndex).to.equal(2);
    });

    it('should select correct item based on angle - bottom', function () {
      // Bottom (180 degrees) -> index 4
      pieMenu.updateSelection(500, 600);
      expect(pieMenu.state.selectedIndex).to.equal(4);
    });

    it('should select correct item based on angle - left', function () {
      // Left (270 degrees) -> index 6
      pieMenu.updateSelection(400, 500);
      expect(pieMenu.state.selectedIndex).to.equal(6);
    });

    it('should highlight selected item', function () {
      pieMenu.updateSelection(500, 400);

      const selectedEl = pieMenu.itemElements[0];
      expect(selectedEl.classList.contains('selected')).to.be.true;
    });

    it('should remove highlight from previous selection', function () {
      pieMenu.updateSelection(500, 400); // Select top
      pieMenu.updateSelection(600, 500); // Select right

      const topEl = pieMenu.itemElements[0];
      const rightEl = pieMenu.itemElements[2];

      expect(topEl.classList.contains('selected')).to.be.false;
      expect(rightEl.classList.contains('selected')).to.be.true;
    });

    it('should update center element on selection', function () {
      pieMenu.updateSelection(500, 400);

      const selected = pieMenu.getSelected();
      expect(pieMenu.centerElement.textContent).to.equal(selected.icon);
      expect(pieMenu.centerElement.classList.contains('has-selection')).to.be.true;
    });

    it('should set hasMoved flag when moving beyond threshold', function () {
      expect(pieMenu.state.hasMoved).to.be.false;

      pieMenu.updateSelection(500, 480); // Small move
      expect(pieMenu.state.hasMoved).to.be.true;
    });
  });

  describe('Action Execution', function () {
    beforeEach(function () {
      pieMenu.enable();
    });

    it('should execute action on hide when item selected and moved', function () {
      pieMenu.show(500, 500, 'q');
      pieMenu.updateSelection(500, 400); // Select top item
      pieMenu.hide(true);

      const actionLog = logMessages.find(l => l.type === 'action');
      expect(actionLog).to.exist;
      expect(actionLog.id).to.equal('box');
      expect(actionLog.context).to.equal('default');
    });

    it('should not execute action if not moved', function () {
      pieMenu.show(500, 500, 'q');
      pieMenu.state.selectedIndex = 0; // Force selection without moving
      pieMenu.state.hasMoved = false;
      pieMenu.hide(true);

      const actionLog = logMessages.find(l => l.type === 'action');
      expect(actionLog).to.be.undefined;
    });

    it('should not execute action on cancel', function () {
      pieMenu.show(500, 500, 'q');
      pieMenu.updateSelection(500, 400);
      pieMenu.cancel();

      const actionLog = logMessages.find(l => l.type === 'action');
      expect(actionLog).to.be.undefined;
    });

    it('should log action on execution', function () {
      pieMenu.show(500, 500, 'q');
      pieMenu.updateSelection(500, 400);
      pieMenu.hide(true);

      const msgLog = logMessages.find(l => l.msg && l.msg.includes('PIE'));
      expect(msgLog).to.exist;
      expect(msgLog.msg).to.include('BOX');
    });
  });

  describe('Context-Aware Items', function () {
    it('should show selection items when selection context', function () {
      contextCallback = function () {
        return PieMenuContext.SELECTION;
      };

      const selectionPie = new PieMenu({
        container: mockContainer,
        getContext: contextCallback,
      });

      selectionPie.enable();
      selectionPie.show(500, 500, 'q');

      // First item in selection context is 'delete'
      expect(selectionPie.items[PieMenuContext.SELECTION][0].id).to.equal('delete');

      selectionPie.destroy();
    });

    it('should show sketch items when sketch context', function () {
      contextCallback = function () {
        return PieMenuContext.SKETCH;
      };

      const sketchPie = new PieMenu({
        container: mockContainer,
        getContext: contextCallback,
      });

      sketchPie.enable();
      sketchPie.show(500, 500, 'q');

      // First item in sketch context is 'line'
      expect(sketchPie.items[PieMenuContext.SKETCH][0].id).to.equal('line');

      sketchPie.destroy();
    });
  });

  describe('Custom Items', function () {
    it('should allow setting custom items', function () {
      const customItems = [
        { id: 'custom1', label: 'Custom 1', icon: '★' },
        { id: 'custom2', label: 'Custom 2', icon: '◆' },
      ];

      pieMenu.setItems('custom', customItems);

      expect(pieMenu.getItems('custom')).to.deep.equal(customItems);
    });
  });

  describe('Enable/Disable', function () {
    it('should hide menu when disabled', function () {
      pieMenu.enable();
      pieMenu.show(500, 500, 'q');
      expect(pieMenu.isVisible()).to.be.true;

      pieMenu.disable();
      expect(pieMenu.isVisible()).to.be.false;
    });
  });

  describe('Destroy', function () {
    it('should remove DOM elements on destroy', function () {
      const element = pieMenu.element;
      pieMenu.destroy();

      expect(element.parentNode).to.be.null;
    });
  });
});
