/**
 * Ameri-CAD Shortcuts Commands
 *
 * Commands for managing keyboard shortcuts.
 * Can be invoked via CLI or programmatically.
 */

import { registerCommand } from '../core/commands.js';
import { keymapManager, actionMetadata } from '../core/keymap.js';
import { showShortcutsPanel } from '../ui/shortcuts-panel.js';

/**
 * Register all shortcuts-related commands
 */
export function registerShortcutCommands() {
  // SHORTCUTS - Open shortcuts panel or reset
  registerCommand('shortcuts', {
    aliases: ['keymap', 'keys', 'hotkeys'],
    description: 'Open shortcuts panel or manage keybindings',
    category: 'settings',
    params: [
      {
        name: 'subcommand',
        type: 'string',
        required: false,
        default: null,
        description: 'Subcommand: reset, list, or leave empty to open panel',
      },
    ],
    async execute(params) {
      const subcmd = params.subcommand?.toLowerCase();

      if (subcmd === 'reset') {
        keymapManager.reset();
        return { success: true, message: 'Shortcuts reset to defaults' };
      }

      if (subcmd === 'list') {
        const bindings = keymapManager.getBindingsByCategory();
        const lines = [];

        for (const [category, items] of Object.entries(bindings)) {
          lines.push(`\n[${category.toUpperCase()}]`);
          for (const item of items) {
            const shortcuts =
              item.shortcuts.length > 0
                ? item.shortcuts.map(s => keymapManager.formatShortcut(s)).join(', ')
                : '(unbound)';
            lines.push(`  ${item.action}: ${shortcuts}`);
          }
        }

        return lines.join('\n');
      }

      // Default: open panel
      showShortcutsPanel();
      return { success: true, message: 'Shortcuts panel opened' };
    },
  });

  // BIND - Bind a shortcut to an action
  registerCommand('bind', {
    aliases: ['keybind', 'shortcut'],
    description: 'Bind a keyboard shortcut to an action',
    category: 'settings',
    params: [
      {
        name: 'shortcut',
        type: 'string',
        required: true,
        description: 'Key combination (e.g., ctrl+b, shift+g)',
      },
      {
        name: 'action',
        type: 'string',
        required: true,
        description: 'Action name to bind to',
      },
    ],
    validate(params) {
      if (!params.shortcut) return 'Shortcut is required';
      if (!params.action) return 'Action is required';

      // Check if action exists
      if (!actionMetadata[params.action]) {
        const availableActions = Object.keys(actionMetadata).join(', ');
        return `Unknown action: ${params.action}. Available: ${availableActions}`;
      }

      return true;
    },
    async execute(params) {
      const shortcut = params.shortcut;
      const action = params.action;

      // Check for conflicts
      const conflict = keymapManager.checkConflict(shortcut, action);

      // Perform the binding
      keymapManager.bind(shortcut, action);

      const formatted = keymapManager.formatShortcut(shortcut);

      if (conflict) {
        return {
          success: true,
          message: `Bound ${formatted} to "${action}" (was "${conflict.action}")`,
          conflict,
        };
      }

      return {
        success: true,
        message: `Bound ${formatted} to "${action}"`,
      };
    },
  });

  // UNBIND - Remove a shortcut binding
  registerCommand('unbind', {
    aliases: ['unkeybind', 'unshortcut'],
    description: 'Remove a keyboard shortcut binding',
    category: 'settings',
    params: [
      {
        name: 'shortcut',
        type: 'string',
        required: true,
        description: 'Key combination to unbind (e.g., ctrl+b)',
      },
    ],
    validate(params) {
      if (!params.shortcut) return 'Shortcut is required';
      return true;
    },
    async execute(params) {
      const shortcut = params.shortcut;
      const action = keymapManager.unbind(shortcut);
      const formatted = keymapManager.formatShortcut(shortcut);

      if (action) {
        return {
          success: true,
          message: `Unbound ${formatted} from "${action}"`,
        };
      }

      return {
        success: false,
        message: `${formatted} was not bound`,
      };
    },
  });

  // GETBINDING - Get the action for a shortcut
  registerCommand('getbinding', {
    aliases: ['whatkey', 'keywhat'],
    description: 'Show what action a shortcut is bound to',
    category: 'settings',
    params: [
      {
        name: 'shortcut',
        type: 'string',
        required: true,
        description: 'Key combination to look up',
      },
    ],
    async execute(params) {
      const shortcut = params.shortcut;
      const action = keymapManager.getActionForShortcut(shortcut);
      const formatted = keymapManager.formatShortcut(shortcut);

      if (action) {
        const meta = actionMetadata[action] || {};
        return {
          shortcut: formatted,
          action,
          description: meta.description || '',
          category: meta.category || 'unknown',
        };
      }

      return {
        shortcut: formatted,
        action: null,
        message: `${formatted} is not bound`,
      };
    },
  });
}

export default registerShortcutCommands;
