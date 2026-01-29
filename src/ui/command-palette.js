/**
 * Ameri-CAD Command Palette
 *
 * VS Code / Blender-style searchable command palette.
 * - Ctrl+Shift+P or F3 opens palette
 * - Fuzzy search across commands
 * - Keyboard navigation
 * - Shows shortcuts, categories, descriptions
 */

import { listCommands, execute, help } from '../core/commands.js';

export class CommandPalette {
  constructor(options = {}) {
    this.commands = [];
    this.context = options.context || {};
    this.onExecute = options.onExecute || (() => {});

    this.element = null;
    this.input = null;
    this.resultsList = null;
    this.overlay = null;

    this.selectedIndex = 0;
    this.filteredCommands = [];
    this.isVisible = false;

    this.init();
  }

  init() {
    this.createElement();
    this.attachStyles();
    this.attachKeyboardShortcuts();
    this.refreshCommands();
  }

  /**
   * Refresh command list from registry
   */
  refreshCommands() {
    this.commands = listCommands();
  }

  /**
   * Create the palette DOM structure
   */
  createElement() {
    // Overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'command-palette-overlay';
    this.overlay.addEventListener('click', () => this.hide());

    // Main container
    this.element = document.createElement('div');
    this.element.className = 'command-palette';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-label', 'Command Palette');

    // Input container
    const inputContainer = document.createElement('div');
    inputContainer.className = 'command-palette-input-container';

    // Search icon
    const searchIcon = document.createElement('span');
    searchIcon.className = 'command-palette-icon';
    searchIcon.innerHTML = '⌘';

    // Input
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'command-palette-input';
    this.input.placeholder = 'Search commands...';
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    this.input.setAttribute('aria-autocomplete', 'list');
    this.input.setAttribute('aria-controls', 'command-palette-results');

    inputContainer.appendChild(searchIcon);
    inputContainer.appendChild(this.input);

    // Results list
    this.resultsList = document.createElement('ul');
    this.resultsList.id = 'command-palette-results';
    this.resultsList.className = 'command-palette-results';
    this.resultsList.setAttribute('role', 'listbox');

    this.element.appendChild(inputContainer);
    this.element.appendChild(this.resultsList);

    // Add to body
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.element);

    // Event listeners
    this.input.addEventListener('input', () => this.filter());
    this.input.addEventListener('keydown', e => this.handleKeyDown(e));

    // Prevent clicks inside palette from closing it
    this.element.addEventListener('click', e => e.stopPropagation());
  }

  /**
   * Attach CSS styles
   */
  attachStyles() {
    if (document.getElementById('command-palette-styles')) return;

    const style = document.createElement('style');
    style.id = 'command-palette-styles';
    style.textContent = `
            .command-palette-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 9998;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.15s ease, visibility 0.15s ease;
            }
            
            .command-palette-overlay.visible {
                opacity: 1;
                visibility: visible;
            }
            
            .command-palette {
                position: fixed;
                top: 15%;
                left: 50%;
                transform: translateX(-50%) translateY(-10px);
                width: 90%;
                max-width: 560px;
                max-height: 60vh;
                background: var(--bg-200, #18181a);
                border: 1px solid var(--border-default, #35353a);
                border-radius: 8px;
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
                z-index: 9999;
                display: flex;
                flex-direction: column;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
                font-family: var(--font-mono, 'SF Mono', 'Menlo', monospace);
            }
            
            .command-palette.visible {
                opacity: 1;
                visibility: visible;
                transform: translateX(-50%) translateY(0);
            }
            
            .command-palette-input-container {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid var(--border-subtle, #27272b);
            }
            
            .command-palette-icon {
                color: var(--text-tertiary, #6a6a70);
                margin-right: 12px;
                font-size: 16px;
            }
            
            .command-palette-input {
                flex: 1;
                background: transparent;
                border: none;
                outline: none;
                color: var(--text-primary, #f5f5f5);
                font-family: inherit;
                font-size: 14px;
            }
            
            .command-palette-input::placeholder {
                color: var(--text-muted, #4a4a50);
            }
            
            .command-palette-results {
                list-style: none;
                margin: 0;
                padding: 8px 0;
                overflow-y: auto;
                flex: 1;
            }
            
            .command-palette-item {
                display: flex;
                align-items: center;
                padding: 8px 16px;
                cursor: pointer;
                transition: background 0.1s ease;
            }
            
            .command-palette-item:hover,
            .command-palette-item.selected {
                background: var(--surface-hover, #35353a);
            }
            
            .command-palette-item.selected {
                background: var(--bg-400, #27272b);
            }
            
            .command-palette-item-content {
                flex: 1;
                min-width: 0;
            }
            
            .command-palette-item-name {
                color: var(--text-primary, #f5f5f5);
                font-size: 13px;
                font-weight: 500;
            }
            
            .command-palette-item-name .highlight {
                color: var(--accent-primary, #e8b13f);
                background: rgba(232, 177, 63, 0.15);
                border-radius: 2px;
            }
            
            .command-palette-item-description {
                color: var(--text-tertiary, #6a6a70);
                font-size: 11px;
                margin-top: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .command-palette-item-meta {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
                margin-left: 12px;
            }
            
            .command-palette-category {
                color: var(--text-muted, #4a4a50);
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .command-palette-shortcut {
                display: inline-flex;
                align-items: center;
                gap: 2px;
            }
            
            .command-palette-shortcut kbd {
                background: var(--bg-300, #1f1f22);
                border: 1px solid var(--border-subtle, #27272b);
                border-radius: 3px;
                padding: 2px 5px;
                font-size: 10px;
                color: var(--text-secondary, #a0a0a5);
                font-family: inherit;
            }
            
            .command-palette-empty {
                padding: 24px 16px;
                text-align: center;
                color: var(--text-tertiary, #6a6a70);
                font-size: 12px;
            }
            
            .command-palette-hint {
                padding: 8px 16px;
                border-top: 1px solid var(--border-subtle, #27272b);
                display: flex;
                justify-content: space-between;
                color: var(--text-muted, #4a4a50);
                font-size: 10px;
            }
            
            .command-palette-hint kbd {
                background: var(--bg-300, #1f1f22);
                border: 1px solid var(--border-subtle, #27272b);
                border-radius: 3px;
                padding: 1px 4px;
                margin: 0 2px;
            }
        `;

    document.head.appendChild(style);
  }

  /**
   * Attach global keyboard shortcuts
   */
  attachKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      // Don't trigger if user is typing in an input (except our own)
      if (
        e.target !== this.input &&
        (e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.isContentEditable)
      ) {
        return;
      }

      // Ctrl+Shift+P or F3 opens palette
      if (
        (e.ctrlKey && e.shiftKey && e.key === 'P') ||
        (e.key === 'F3' && !e.ctrlKey && !e.shiftKey && !e.altKey)
      ) {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * Handle keyboard navigation within palette
   */
  handleKeyDown(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectNext();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.selectPrev();
        break;

      case 'Enter':
        e.preventDefault();
        this.executeSelected();
        break;

      case 'Escape':
        e.preventDefault();
        this.hide();
        break;

      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          this.selectPrev();
        } else {
          this.selectNext();
        }
        break;
    }
  }

  /**
   * Filter commands based on input
   */
  filter() {
    const query = this.input.value.toLowerCase().trim();

    if (!query) {
      // Show all commands when empty
      this.filteredCommands = [...this.commands];
    } else {
      // Fuzzy match on name, aliases, description, and category
      this.filteredCommands = this.commands
        .map(cmd => ({
          cmd,
          score: this.scoreMatch(cmd, query),
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.cmd);
    }

    this.selectedIndex = 0;
    this.renderResults(query);
  }

  /**
   * Score how well a command matches the query
   */
  scoreMatch(cmd, query) {
    let score = 0;
    const queryLower = query.toLowerCase();

    // Exact name match (highest priority)
    if (cmd.name === queryLower) {
      score += 100;
    } else if (cmd.name.startsWith(queryLower)) {
      score += 50;
    } else if (cmd.name.includes(queryLower)) {
      score += 30;
    }

    // Alias matches
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        if (alias === queryLower) {
          score += 80;
        } else if (alias.startsWith(queryLower)) {
          score += 40;
        } else if (alias.includes(queryLower)) {
          score += 20;
        }
      }
    }

    // Category match
    if (cmd.category && cmd.category.toLowerCase().includes(queryLower)) {
      score += 15;
    }

    // Description match
    if (cmd.description && cmd.description.toLowerCase().includes(queryLower)) {
      score += 10;
    }

    // Fuzzy character match for partial typing
    if (score === 0 && this.fuzzyMatch(cmd.name, query)) {
      score += 5;
    }

    return score;
  }

  /**
   * Simple fuzzy matching (characters appear in order)
   */
  fuzzyMatch(str, query) {
    const strLower = str.toLowerCase();
    let queryIdx = 0;

    for (let i = 0; i < strLower.length && queryIdx < query.length; i++) {
      if (strLower[i] === query[queryIdx]) {
        queryIdx++;
      }
    }

    return queryIdx === query.length;
  }

  /**
   * Render filtered results
   */
  renderResults(query = '') {
    if (this.filteredCommands.length === 0) {
      this.resultsList.innerHTML = `
                <li class="command-palette-empty">
                    No commands found for "${this.escapeHtml(query)}"
                </li>
            `;
      return;
    }

    this.resultsList.innerHTML = this.filteredCommands
      .map((cmd, index) => {
        const isSelected = index === this.selectedIndex;
        const name = this.highlightMatch(cmd.name, query);
        const shortcut = this.formatShortcut(cmd);

        return `
                <li class="command-palette-item ${isSelected ? 'selected' : ''}"
                    role="option"
                    aria-selected="${isSelected}"
                    data-index="${index}">
                    <div class="command-palette-item-content">
                        <div class="command-palette-item-name">${name}</div>
                        ${cmd.description ? `<div class="command-palette-item-description">${this.escapeHtml(cmd.description)}</div>` : ''}
                    </div>
                    <div class="command-palette-item-meta">
                        <span class="command-palette-category">${this.escapeHtml(cmd.category || 'general')}</span>
                        ${shortcut ? `<span class="command-palette-shortcut">${shortcut}</span>` : ''}
                    </div>
                </li>
            `;
      })
      .join('');

    // Attach click listeners
    this.resultsList.querySelectorAll('.command-palette-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectedIndex = parseInt(item.dataset.index, 10);
        this.executeSelected();
      });

      item.addEventListener('mouseenter', () => {
        this.selectedIndex = parseInt(item.dataset.index, 10);
        this.updateSelection();
      });
    });

    this.scrollToSelected();
  }

  /**
   * Highlight matching characters in text
   */
  highlightMatch(text, query) {
    if (!query) return this.escapeHtml(text);

    const escaped = this.escapeHtml(text);
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Find all positions where query matches
    let result = '';
    let lastIdx = 0;
    let searchIdx = 0;

    while ((searchIdx = textLower.indexOf(queryLower, searchIdx)) !== -1) {
      result += escaped.slice(lastIdx, searchIdx);
      result += `<span class="highlight">${escaped.slice(searchIdx, searchIdx + query.length)}</span>`;
      lastIdx = searchIdx + query.length;
      searchIdx = lastIdx;
    }

    result += escaped.slice(lastIdx);
    return result || escaped;
  }

  /**
   * Format keyboard shortcut for display
   */
  formatShortcut(cmd) {
    // Check if command has a shortcut defined
    const shortcut = cmd.shortcut;
    if (!shortcut) return '';

    const keys = shortcut.split('+').map(k => `<kbd>${k}</kbd>`);
    return keys.join('');
  }

  /**
   * Escape HTML entities
   */
  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Select next item
   */
  selectNext() {
    if (this.filteredCommands.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.filteredCommands.length;
    this.updateSelection();
  }

  /**
   * Select previous item
   */
  selectPrev() {
    if (this.filteredCommands.length === 0) return;
    this.selectedIndex =
      this.selectedIndex <= 0 ? this.filteredCommands.length - 1 : this.selectedIndex - 1;
    this.updateSelection();
  }

  /**
   * Update visual selection state
   */
  updateSelection() {
    const items = this.resultsList.querySelectorAll('.command-palette-item');
    items.forEach((item, idx) => {
      item.classList.toggle('selected', idx === this.selectedIndex);
      item.setAttribute('aria-selected', idx === this.selectedIndex);
    });
    this.scrollToSelected();
  }

  /**
   * Scroll to keep selected item visible
   */
  scrollToSelected() {
    const selected = this.resultsList.querySelector('.command-palette-item.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /**
   * Execute the currently selected command
   */
  async executeSelected() {
    if (this.filteredCommands.length === 0) return;

    const cmd = this.filteredCommands[this.selectedIndex];
    if (!cmd) return;

    this.hide();

    try {
      // Execute command
      const result = await execute(cmd.name, this.context);
      this.onExecute(result, cmd);
    } catch (error) {
      console.error('[CommandPalette] Execution error:', error);
      // Could show error feedback here
    }
  }

  /**
   * Show the command palette
   */
  show() {
    if (this.isVisible) return;

    this.refreshCommands();
    this.isVisible = true;
    this.overlay.classList.add('visible');
    this.element.classList.add('visible');

    // Reset state
    this.input.value = '';
    this.selectedIndex = 0;
    this.filter();

    // Focus input
    requestAnimationFrame(() => {
      this.input.focus();
    });
  }

  /**
   * Hide the command palette
   */
  hide() {
    if (!this.isVisible) return;

    this.isVisible = false;
    this.overlay.classList.remove('visible');
    this.element.classList.remove('visible');
    this.input.blur();
  }

  /**
   * Toggle visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Set execution context
   */
  setContext(context) {
    this.context = context;
  }

  /**
   * Show help for a specific command
   */
  showHelp(commandName) {
    const helpText = help(commandName);
    console.log(helpText);
    // Could display this in a modal or tooltip
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    this.overlay?.remove();
    this.element?.remove();
    document.getElementById('command-palette-styles')?.remove();
  }
}

// Register palette commands
export function registerPaletteCommands(palette, registerCommand) {
  registerCommand('commands', {
    aliases: ['palette', 'cmd'],
    description: 'Open command palette',
    category: 'general',
    shortcut: 'Ctrl+Shift+P',
    execute() {
      palette.show();
      return 'Command palette opened';
    },
  });
}

export default CommandPalette;
