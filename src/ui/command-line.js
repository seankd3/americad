/**
 * Ameri-CAD Command Line UI
 *
 * AutoCAD-style command line at the bottom of the screen.
 * - Type commands directly
 * - Autocomplete with Tab
 * - Command history with Up/Down arrows
 * - Real-time feedback
 */

import { execute, autocomplete, listCommands, on } from '../core/commands.js';

export class CommandLine {
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.context = options.context || {};
    this.onExecute = options.onExecute || (() => {});

    this.history = [];
    this.historyIndex = -1;
    this.suggestions = [];
    this.suggestionIndex = -1;

    this.element = null;
    this.input = null;
    this.output = null;
    this.suggestionsEl = null;

    this.maxHistory = 100;
    this.maxOutput = 50;

    this.init();
  }

  init() {
    this.createElement();
    this.attachEventListeners();
    this.loadHistory();

    // Listen to command events
    on('execute', e => this.logExecute(e));
    on('error', e => this.logError(e));
  }

  createElement() {
    // Main container
    this.element = document.createElement('div');
    this.element.className = 'ameri-command-line';
    this.element.innerHTML = `
            <div class="cmd-output"></div>
            <div class="cmd-suggestions"></div>
            <div class="cmd-input-row">
                <span class="cmd-prompt">Command:</span>
                <input type="text" class="cmd-input" placeholder="Type command or press ? for help" autocomplete="off" spellcheck="false">
            </div>
        `;

    this.container.appendChild(this.element);

    this.input = this.element.querySelector('.cmd-input');
    this.output = this.element.querySelector('.cmd-output');
    this.suggestionsEl = this.element.querySelector('.cmd-suggestions');

    this.addStyles();
  }

  addStyles() {
    if (document.getElementById('ameri-cmd-styles')) return;

    const style = document.createElement('style');
    style.id = 'ameri-cmd-styles';
    style.textContent = `
            .ameri-command-line {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: #1a1a2e;
                border-top: 1px solid #0f3460;
                font-family: 'JetBrains Mono', 'Fira Code', monospace;
                font-size: 13px;
                z-index: 1000;
            }
            
            .cmd-output {
                max-height: 150px;
                overflow-y: auto;
                padding: 8px 12px;
                color: #a0a0a0;
                border-bottom: 1px solid #0f3460;
                display: none;
            }
            
            .cmd-output.visible {
                display: block;
            }
            
            .cmd-output-line {
                padding: 2px 0;
                white-space: pre-wrap;
            }
            
            .cmd-output-line.cmd-executed {
                color: #4ecca3;
            }
            
            .cmd-output-line.cmd-error {
                color: #e94560;
            }
            
            .cmd-output-line.cmd-result {
                color: #64b5f6;
            }
            
            .cmd-suggestions {
                padding: 4px 12px;
                background: #16213e;
                display: none;
            }
            
            .cmd-suggestions.visible {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            
            .cmd-suggestion {
                padding: 2px 8px;
                background: #1a1a2e;
                border-radius: 3px;
                cursor: pointer;
                color: #e0e0e0;
            }
            
            .cmd-suggestion:hover,
            .cmd-suggestion.selected {
                background: #0f3460;
                color: #4ecca3;
            }
            
            .cmd-suggestion-desc {
                color: #666;
                font-size: 11px;
                margin-left: 8px;
            }
            
            .cmd-input-row {
                display: flex;
                align-items: center;
                padding: 8px 12px;
            }
            
            .cmd-prompt {
                color: #4ecca3;
                margin-right: 8px;
                font-weight: bold;
            }
            
            .cmd-input {
                flex: 1;
                background: transparent;
                border: none;
                outline: none;
                color: #ffffff;
                font-family: inherit;
                font-size: inherit;
            }
            
            .cmd-input::placeholder {
                color: #555;
            }
        `;

    document.head.appendChild(style);
  }

  attachEventListeners() {
    this.input.addEventListener('keydown', e => this.handleKeyDown(e));
    this.input.addEventListener('input', e => this.handleInput(e));
    this.input.addEventListener('blur', () => this.hideSuggestions());

    // Global keyboard shortcut to focus command line
    document.addEventListener('keydown', e => {
      // Focus on backtick/tilde or when typing starts
      if (e.key === '`' || e.key === '~') {
        e.preventDefault();
        this.focus();
      }
      // Escape to blur
      if (e.key === 'Escape' && document.activeElement === this.input) {
        this.input.blur();
      }
    });
  }

  handleKeyDown(e) {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        this.executeInput();
        break;

      case 'Tab':
        e.preventDefault();
        this.completeSuggestion();
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (this.suggestions.length > 0) {
          this.navigateSuggestions(-1);
        } else {
          this.navigateHistory(-1);
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (this.suggestions.length > 0) {
          this.navigateSuggestions(1);
        } else {
          this.navigateHistory(1);
        }
        break;

      case 'Escape':
        this.hideSuggestions();
        this.suggestionIndex = -1;
        break;

      case '?':
        if (this.input.value === '') {
          e.preventDefault();
          this.showHelp();
        }
        break;
    }
  }

  handleInput(_e) {
    const value = this.input.value.trim();

    if (value.length > 0) {
      this.updateSuggestions(value);
    } else {
      this.hideSuggestions();
    }
  }

  updateSuggestions(partial) {
    // Only show suggestions for command name (first word)
    const firstWord = partial.split(/\s+/)[0];
    if (partial.includes(' ')) {
      this.hideSuggestions();
      return;
    }

    this.suggestions = autocomplete(firstWord);
    this.suggestionIndex = -1;

    if (this.suggestions.length > 0) {
      this.showSuggestions();
    } else {
      this.hideSuggestions();
    }
  }

  showSuggestions() {
    this.suggestionsEl.innerHTML = this.suggestions
      .map(
        (s, i) => `
            <div class="cmd-suggestion ${i === this.suggestionIndex ? 'selected' : ''}" data-index="${i}">
                ${s.name}
                <span class="cmd-suggestion-desc">${s.description}</span>
            </div>
        `
      )
      .join('');

    this.suggestionsEl.classList.add('visible');

    // Click handler for suggestions
    this.suggestionsEl.querySelectorAll('.cmd-suggestion').forEach(el => {
      el.addEventListener('click', () => {
        this.suggestionIndex = parseInt(el.dataset.index);
        this.completeSuggestion();
      });
    });
  }

  hideSuggestions() {
    this.suggestionsEl.classList.remove('visible');
    this.suggestions = [];
  }

  navigateSuggestions(direction) {
    if (this.suggestions.length === 0) return;

    this.suggestionIndex += direction;
    if (this.suggestionIndex < 0) this.suggestionIndex = this.suggestions.length - 1;
    if (this.suggestionIndex >= this.suggestions.length) this.suggestionIndex = 0;

    this.showSuggestions();
  }

  completeSuggestion() {
    if (this.suggestions.length === 0) return;

    const index = this.suggestionIndex >= 0 ? this.suggestionIndex : 0;
    const suggestion = this.suggestions[index];

    this.input.value = suggestion.name + ' ';
    this.hideSuggestions();
    this.input.focus();
  }

  navigateHistory(direction) {
    if (this.history.length === 0) return;

    this.historyIndex += direction;
    if (this.historyIndex < 0) this.historyIndex = 0;
    if (this.historyIndex >= this.history.length) {
      this.historyIndex = this.history.length;
      this.input.value = '';
      return;
    }

    this.input.value = this.history[this.historyIndex];
  }

  async executeInput() {
    const input = this.input.value.trim();
    if (!input) return;

    // Add to history
    this.addToHistory(input);
    this.input.value = '';
    this.hideSuggestions();

    // Log the command
    this.log(input, 'cmd-executed');

    try {
      const result = await execute(input, this.context);

      // Log result
      if (result !== undefined) {
        const resultStr =
          typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        this.log(resultStr, 'cmd-result');
      }

      this.onExecute(result);
    } catch (error) {
      this.log(`Error: ${error.message}`, 'cmd-error');
      if (error.suggestion) {
        this.log(error.suggestion, 'cmd-result');
      }
    }
  }

  addToHistory(command) {
    // Don't add duplicates of the last command
    if (this.history[this.history.length - 1] === command) return;

    this.history.push(command);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    this.historyIndex = this.history.length;

    this.saveHistory();
  }

  log(message, className = '') {
    const line = document.createElement('div');
    line.className = `cmd-output-line ${className}`;
    line.textContent = message;

    this.output.appendChild(line);

    // Limit output lines
    while (this.output.children.length > this.maxOutput) {
      this.output.removeChild(this.output.firstChild);
    }

    // Show output and scroll to bottom
    this.output.classList.add('visible');
    this.output.scrollTop = this.output.scrollHeight;
  }

  logExecute(_event) {
    // Already logged in executeInput
  }

  logError(_event) {
    // Already logged in executeInput
  }

  showHelp() {
    const commands = listCommands();
    const categories = {};

    for (const cmd of commands) {
      if (!categories[cmd.category]) {
        categories[cmd.category] = [];
      }
      categories[cmd.category].push(cmd);
    }

    this.log('=== Ameri-CAD Commands ===', 'cmd-result');

    for (const [category, cmds] of Object.entries(categories).sort()) {
      this.log(`\n[${category.toUpperCase()}]`);
      for (const cmd of cmds) {
        const aliases = cmd.aliases.length ? ` (${cmd.aliases.join(', ')})` : '';
        this.log(`  ${cmd.name}${aliases} - ${cmd.description}`);
      }
    }

    this.log('\nType command name for help, e.g.: "help box"', 'cmd-result');
  }

  focus() {
    this.input.focus();
  }

  blur() {
    this.input.blur();
  }

  saveHistory() {
    try {
      localStorage.setItem('ameri-cmd-history', JSON.stringify(this.history));
    } catch {
      // localStorage not available
    }
  }

  loadHistory() {
    try {
      const saved = localStorage.getItem('ameri-cmd-history');
      if (saved) {
        this.history = JSON.parse(saved);
        this.historyIndex = this.history.length;
      }
    } catch {
      // localStorage not available
    }
  }

  setContext(context) {
    this.context = context;
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export default CommandLine;
