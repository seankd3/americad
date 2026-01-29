/**
 * Ameri-CAD Command System
 * 
 * Inspired by Blender & AutoCAD - every action is a command that can be:
 * - Invoked via UI (buttons, menus, shortcuts)
 * - Typed in the command line
 * - Scripted/automated
 * - Recorded for macros
 * 
 * Commands are the single source of truth for all operations.
 */

// Command registry
const commands = new Map();

// Command history for scripting/macro playback
const commandHistory = [];

// Listeners for command events
const listeners = {
    execute: [],
    register: [],
    error: []
};

/**
 * Register a command
 * @param {string} name - Command name (e.g., 'box', 'move', 'extrude')
 * @param {Object} definition - Command definition
 */
export function registerCommand(name, definition) {
    const cmd = {
        name: name.toLowerCase(),
        aliases: definition.aliases || [],
        description: definition.description || '',
        params: definition.params || [],  // Parameter definitions
        execute: definition.execute,       // Main execution function
        undo: definition.undo,             // Optional undo function
        validate: definition.validate,     // Optional validation
        category: definition.category || 'general'
    };
    
    commands.set(cmd.name, cmd);
    
    // Register aliases
    for (const alias of cmd.aliases) {
        commands.set(alias.toLowerCase(), cmd);
    }
    
    emit('register', cmd);
    return cmd;
}

/**
 * Execute a command by name with arguments
 * @param {string} input - Command string (e.g., "box 10 20 30" or "move 0,0,10")
 * @param {Object} context - Execution context (selection, document, etc.)
 * @returns {Promise<any>} Command result
 */
export async function execute(input, context = {}) {
    const parsed = parseCommand(input);
    if (!parsed) {
        throw new CommandError(`Invalid command: ${input}`);
    }
    
    const { name, args } = parsed;
    const cmd = commands.get(name.toLowerCase());
    
    if (!cmd) {
        throw new CommandError(`Unknown command: ${name}`, suggestCommand(name));
    }
    
    // Parse arguments into parameters
    const params = parseParams(cmd, args);
    
    // Validate if validator exists
    if (cmd.validate) {
        const validation = cmd.validate(params, context);
        if (validation !== true) {
            throw new CommandError(validation || 'Validation failed');
        }
    }
    
    try {
        const result = await cmd.execute(params, context);
        
        // Record in history
        commandHistory.push({
            command: cmd.name,
            params,
            timestamp: Date.now(),
            result
        });
        
        emit('execute', { command: cmd, params, result });
        return result;
        
    } catch (error) {
        emit('error', { command: cmd, params, error });
        throw error;
    }
}

/**
 * Parse a command string into name and arguments
 */
function parseCommand(input) {
    if (!input || typeof input !== 'string') return null;
    
    const trimmed = input.trim();
    if (!trimmed) return null;
    
    // Handle quoted strings and special syntax
    const tokens = tokenize(trimmed);
    if (tokens.length === 0) return null;
    
    return {
        name: tokens[0],
        args: tokens.slice(1)
    };
}

/**
 * Tokenize command string, respecting quotes and special chars
 */
function tokenize(input) {
    const tokens = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        
        if (inQuotes) {
            if (char === quoteChar) {
                inQuotes = false;
                tokens.push(current);
                current = '';
            } else {
                current += char;
            }
        } else if (char === '"' || char === "'") {
            inQuotes = true;
            quoteChar = char;
        } else if (char === ' ' || char === '\t') {
            if (current) {
                tokens.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }
    
    if (current) {
        tokens.push(current);
    }
    
    return tokens;
}

/**
 * Parse arguments into typed parameters based on command definition
 */
function parseParams(cmd, args) {
    const params = {};
    const paramDefs = cmd.params || [];
    
    let argIndex = 0;
    
    for (const def of paramDefs) {
        if (argIndex >= args.length) {
            if (def.required) {
                throw new CommandError(`Missing required parameter: ${def.name}`);
            }
            params[def.name] = def.default;
            continue;
        }
        
        const value = parseValue(args[argIndex], def.type);
        params[def.name] = value;
        argIndex++;
    }
    
    // Collect remaining args if command accepts rest
    if (argIndex < args.length) {
        params._rest = args.slice(argIndex);
    }
    
    return params;
}

/**
 * Parse a string value into a typed value
 */
function parseValue(str, type) {
    switch (type) {
        case 'number':
            const num = parseFloat(str);
            if (isNaN(num)) throw new CommandError(`Invalid number: ${str}`);
            return num;
            
        case 'int':
            const int = parseInt(str, 10);
            if (isNaN(int)) throw new CommandError(`Invalid integer: ${str}`);
            return int;
            
        case 'bool':
        case 'boolean':
            return str === 'true' || str === '1' || str === 'yes' || str === 'on';
            
        case 'point':
        case 'vector':
            // Parse "x,y,z" or "x y z"
            const parts = str.includes(',') ? str.split(',') : str.split(/\s+/);
            return {
                x: parseFloat(parts[0]) || 0,
                y: parseFloat(parts[1]) || 0,
                z: parseFloat(parts[2]) || 0
            };
            
        case 'string':
        default:
            return str;
    }
}

/**
 * Suggest similar commands for typos
 */
function suggestCommand(name) {
    const threshold = 3;
    let best = null;
    let bestDist = Infinity;
    
    for (const [cmdName] of commands) {
        const dist = levenshtein(name.toLowerCase(), cmdName);
        if (dist < bestDist && dist <= threshold) {
            bestDist = dist;
            best = cmdName;
        }
    }
    
    return best ? `Did you mean '${best}'?` : null;
}

/**
 * Simple Levenshtein distance for suggestions
 */
function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[b.length][a.length];
}

/**
 * Get all registered commands
 */
export function listCommands(category = null) {
    const result = [];
    const seen = new Set();
    
    for (const [_name, cmd] of commands) {
        if (seen.has(cmd.name)) continue;
        if (category && cmd.category !== category) continue;
        
        seen.add(cmd.name);
        result.push({
            name: cmd.name,
            aliases: cmd.aliases,
            description: cmd.description,
            params: cmd.params,
            category: cmd.category
        });
    }
    
    return result.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get command history
 */
export function getHistory(limit = 100) {
    return commandHistory.slice(-limit);
}

/**
 * Clear command history
 */
export function clearHistory() {
    commandHistory.length = 0;
}

/**
 * Subscribe to command events
 */
export function on(event, callback) {
    if (listeners[event]) {
        listeners[event].push(callback);
    }
    return () => off(event, callback);
}

/**
 * Unsubscribe from command events
 */
export function off(event, callback) {
    if (listeners[event]) {
        const idx = listeners[event].indexOf(callback);
        if (idx >= 0) listeners[event].splice(idx, 1);
    }
}

/**
 * Emit a command event
 */
function emit(event, data) {
    if (listeners[event]) {
        for (const callback of listeners[event]) {
            try {
                callback(data);
            } catch (e) {
                console.error(`Command event listener error:`, e);
            }
        }
    }
}

/**
 * Custom error class for command errors
 */
export class CommandError extends Error {
    constructor(message, suggestion = null) {
        super(message);
        this.name = 'CommandError';
        this.suggestion = suggestion;
    }
}

/**
 * Get autocomplete suggestions for partial input
 */
export function autocomplete(partial) {
    const lower = partial.toLowerCase();
    const suggestions = [];
    const seen = new Set();
    
    for (const [name, cmd] of commands) {
        if (seen.has(cmd.name)) continue;
        
        if (name.startsWith(lower) || cmd.aliases.some(a => a.startsWith(lower))) {
            seen.add(cmd.name);
            suggestions.push({
                name: cmd.name,
                description: cmd.description,
                signature: formatSignature(cmd)
            });
        }
    }
    
    return suggestions.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Format command signature for display
 */
function formatSignature(cmd) {
    const params = cmd.params.map(p => {
        const name = p.required ? `<${p.name}>` : `[${p.name}]`;
        return name;
    }).join(' ');
    
    return `${cmd.name} ${params}`.trim();
}

/**
 * Generate help text for a command
 */
export function help(commandName) {
    const cmd = commands.get(commandName?.toLowerCase());
    if (!cmd) {
        return listCommands().map(c => `${c.name} - ${c.description}`).join('\n');
    }
    
    let text = `${cmd.name.toUpperCase()}\n`;
    text += `${cmd.description}\n\n`;
    text += `Usage: ${formatSignature(cmd)}\n`;
    
    if (cmd.aliases.length > 0) {
        text += `Aliases: ${cmd.aliases.join(', ')}\n`;
    }
    
    if (cmd.params.length > 0) {
        text += `\nParameters:\n`;
        for (const p of cmd.params) {
            const req = p.required ? '(required)' : `(default: ${p.default})`;
            text += `  ${p.name} [${p.type}] - ${p.description || ''} ${req}\n`;
        }
    }
    
    return text;
}

export default {
    registerCommand,
    execute,
    listCommands,
    getHistory,
    clearHistory,
    autocomplete,
    help,
    on,
    off,
    CommandError
};
