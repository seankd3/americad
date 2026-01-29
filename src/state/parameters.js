/**
 * Ameri-CAD Parametric Expressions System
 *
 * Allows parameters to reference other parameters with mathematical expressions.
 * Similar to Fusion 360's parametric modeling capability.
 *
 * Examples:
 *   width = 100
 *   height = width / 2        → 50
 *   depth = width + 10        → 110
 *   radius = min(width, height) / 4
 */

/**
 * Token types for the expression lexer
 */
const TokenType = {
  NUMBER: 'NUMBER',
  IDENTIFIER: 'IDENTIFIER',
  OPERATOR: 'OPERATOR',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  COMMA: 'COMMA',
  EOF: 'EOF',
};

/**
 * Supported operators with precedence (higher = binds tighter)
 */
const OPERATORS = {
  '+': { precedence: 1, associativity: 'left' },
  '-': { precedence: 1, associativity: 'left' },
  '*': { precedence: 2, associativity: 'left' },
  '/': { precedence: 2, associativity: 'left' },
  '%': { precedence: 2, associativity: 'left' },
  '^': { precedence: 3, associativity: 'right' },
};

/**
 * Built-in functions
 */
const FUNCTIONS = {
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  sqrt: x => Math.sqrt(x),
  abs: x => Math.abs(x),
  sin: x => Math.sin(x),
  cos: x => Math.cos(x),
  tan: x => Math.tan(x),
  asin: x => Math.asin(x),
  acos: x => Math.acos(x),
  atan: x => Math.atan(x),
  atan2: (y, x) => Math.atan2(y, x),
  floor: x => Math.floor(x),
  ceil: x => Math.ceil(x),
  round: x => Math.round(x),
  pow: (x, y) => Math.pow(x, y),
  log: x => Math.log(x),
  log10: x => Math.log10(x),
  exp: x => Math.exp(x),
  // Degrees ↔ Radians helpers
  rad: deg => (deg * Math.PI) / 180,
  deg: rad => (rad * 180) / Math.PI,
};

/**
 * Built-in constants
 */
const CONSTANTS = {
  PI: Math.PI,
  E: Math.E,
  TAU: Math.PI * 2,
};

/**
 * Tokenizer - converts expression string to tokens
 */
class Lexer {
  constructor(input) {
    this.input = input;
    this.pos = 0;
  }

  peek() {
    return this.input[this.pos];
  }

  advance() {
    return this.input[this.pos++];
  }

  skipWhitespace() {
    while (this.pos < this.input.length && /\s/.test(this.peek())) {
      this.advance();
    }
  }

  readNumber() {
    let num = '';
    let hasDecimal = false;

    // Handle negative numbers
    if (this.peek() === '-') {
      num += this.advance();
    }

    while (this.pos < this.input.length) {
      const ch = this.peek();
      if (/\d/.test(ch)) {
        num += this.advance();
      } else if (ch === '.' && !hasDecimal) {
        hasDecimal = true;
        num += this.advance();
      } else if (ch === 'e' || ch === 'E') {
        // Scientific notation
        num += this.advance();
        if (this.peek() === '+' || this.peek() === '-') {
          num += this.advance();
        }
      } else {
        break;
      }
    }

    return { type: TokenType.NUMBER, value: parseFloat(num) };
  }

  readIdentifier() {
    let id = '';
    while (this.pos < this.input.length && /[a-zA-Z_0-9]/.test(this.peek())) {
      id += this.advance();
    }
    return { type: TokenType.IDENTIFIER, value: id };
  }

  nextToken() {
    this.skipWhitespace();

    if (this.pos >= this.input.length) {
      return { type: TokenType.EOF };
    }

    const ch = this.peek();

    // Numbers (including negative)
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(this.input[this.pos + 1]))) {
      return this.readNumber();
    }

    // Identifiers (variable names and functions)
    if (/[a-zA-Z_]/.test(ch)) {
      return this.readIdentifier();
    }

    // Operators
    if (OPERATORS[ch]) {
      this.advance();
      return { type: TokenType.OPERATOR, value: ch };
    }

    // Parentheses
    if (ch === '(') {
      this.advance();
      return { type: TokenType.LPAREN };
    }
    if (ch === ')') {
      this.advance();
      return { type: TokenType.RPAREN };
    }

    // Comma (for function arguments)
    if (ch === ',') {
      this.advance();
      return { type: TokenType.COMMA };
    }

    throw new Error(`Unexpected character: '${ch}' at position ${this.pos}`);
  }

  tokenize() {
    const tokens = [];
    let token;
    while ((token = this.nextToken()).type !== TokenType.EOF) {
      tokens.push(token);
    }
    return tokens;
  }
}

/**
 * AST Node types
 */
class NumberNode {
  constructor(value) {
    this.type = 'number';
    this.value = value;
  }
}

class IdentifierNode {
  constructor(name) {
    this.type = 'identifier';
    this.name = name;
  }
}

class BinaryOpNode {
  constructor(op, left, right) {
    this.type = 'binary';
    this.op = op;
    this.left = left;
    this.right = right;
  }
}

class UnaryOpNode {
  constructor(op, operand) {
    this.type = 'unary';
    this.op = op;
    this.operand = operand;
  }
}

class FunctionCallNode {
  constructor(name, args) {
    this.type = 'function';
    this.name = name;
    this.args = args;
  }
}

/**
 * Parser - converts tokens to AST using Pratt parsing (precedence climbing)
 */
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() {
    return this.tokens[this.pos] || { type: TokenType.EOF };
  }

  advance() {
    return this.tokens[this.pos++];
  }

  expect(type) {
    const token = this.advance();
    if (token.type !== type) {
      throw new Error(`Expected ${type}, got ${token.type}`);
    }
    return token;
  }

  parse() {
    const ast = this.parseExpression(0);
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token: ${this.peek().value || this.peek().type}`);
    }
    return ast;
  }

  parseExpression(minPrecedence) {
    let left = this.parsePrimary();

    while (true) {
      const token = this.peek();

      if (token.type !== TokenType.OPERATOR) break;

      const opInfo = OPERATORS[token.value];
      if (!opInfo || opInfo.precedence < minPrecedence) break;

      this.advance(); // consume operator

      // For right-associative operators, use same precedence; for left, use +1
      const nextMinPrec =
        opInfo.associativity === 'right' ? opInfo.precedence : opInfo.precedence + 1;

      const right = this.parseExpression(nextMinPrec);
      left = new BinaryOpNode(token.value, left, right);
    }

    return left;
  }

  parsePrimary() {
    const token = this.peek();

    // Unary minus
    if (token.type === TokenType.OPERATOR && token.value === '-') {
      this.advance();
      const operand = this.parsePrimary();
      return new UnaryOpNode('-', operand);
    }

    // Unary plus (just ignore it)
    if (token.type === TokenType.OPERATOR && token.value === '+') {
      this.advance();
      return this.parsePrimary();
    }

    // Number literal
    if (token.type === TokenType.NUMBER) {
      this.advance();
      return new NumberNode(token.value);
    }

    // Identifier (variable or function call)
    if (token.type === TokenType.IDENTIFIER) {
      this.advance();
      const name = token.value;

      // Check if it's a function call
      if (this.peek().type === TokenType.LPAREN) {
        return this.parseFunctionCall(name);
      }

      return new IdentifierNode(name);
    }

    // Parenthesized expression
    if (token.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.parseExpression(0);
      this.expect(TokenType.RPAREN);
      return expr;
    }

    throw new Error(`Unexpected token: ${token.value || token.type}`);
  }

  parseFunctionCall(name) {
    this.expect(TokenType.LPAREN);

    const args = [];

    if (this.peek().type !== TokenType.RPAREN) {
      args.push(this.parseExpression(0));

      while (this.peek().type === TokenType.COMMA) {
        this.advance(); // consume comma
        args.push(this.parseExpression(0));
      }
    }

    this.expect(TokenType.RPAREN);

    return new FunctionCallNode(name, args);
  }
}

/**
 * Extract variable dependencies from an AST
 */
function extractDependencies(ast, dependencies = new Set()) {
  if (!ast) return dependencies;

  switch (ast.type) {
    case 'identifier':
      // Skip built-in constants
      if (!CONSTANTS.hasOwnProperty(ast.name)) {
        dependencies.add(ast.name);
      }
      break;
    case 'binary':
      extractDependencies(ast.left, dependencies);
      extractDependencies(ast.right, dependencies);
      break;
    case 'unary':
      extractDependencies(ast.operand, dependencies);
      break;
    case 'function':
      for (const arg of ast.args) {
        extractDependencies(arg, dependencies);
      }
      break;
  }

  return dependencies;
}

/**
 * Evaluate an AST with a given variable resolver
 */
function evaluateAST(ast, resolve) {
  switch (ast.type) {
    case 'number':
      return ast.value;

    case 'identifier':
      // Check built-in constants first
      if (CONSTANTS.hasOwnProperty(ast.name)) {
        return CONSTANTS[ast.name];
      }
      return resolve(ast.name);

    case 'binary': {
      const left = evaluateAST(ast.left, resolve);
      const right = evaluateAST(ast.right, resolve);

      switch (ast.op) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          if (right === 0) throw new Error('Division by zero');
          return left / right;
        case '%':
          return left % right;
        case '^':
          return Math.pow(left, right);
        default:
          throw new Error(`Unknown operator: ${ast.op}`);
      }
    }

    case 'unary': {
      const operand = evaluateAST(ast.operand, resolve);
      switch (ast.op) {
        case '-':
          return -operand;
        case '+':
          return operand;
        default:
          throw new Error(`Unknown unary operator: ${ast.op}`);
      }
    }

    case 'function': {
      const fn = FUNCTIONS[ast.name];
      if (!fn) throw new Error(`Unknown function: ${ast.name}`);

      const args = ast.args.map(arg => evaluateAST(arg, resolve));
      return fn(...args);
    }

    default:
      throw new Error(`Unknown AST node type: ${ast.type}`);
  }
}

/**
 * Parameter Store - manages named parameters with expression support
 */
export class ParameterStore {
  constructor() {
    // name → { expression: string, ast: AST, dependencies: Set<string>, cachedValue: number|null }
    this.params = new Map();

    // Evaluation cache - invalidated when dependencies change
    this.evaluationStack = new Set(); // For circular dependency detection

    // Event callbacks
    this.onChange = null;
  }

  /**
   * Set a parameter with an expression
   * @param {string} name - Parameter name
   * @param {string|number} expression - Expression string or numeric value
   */
  set(name, expression) {
    // Validate name
    if (!name || typeof name !== 'string') {
      throw new Error('Parameter name must be a non-empty string');
    }
    if (!/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(name)) {
      throw new Error(`Invalid parameter name: '${name}'. Use letters, numbers, and underscores.`);
    }
    if (CONSTANTS.hasOwnProperty(name)) {
      throw new Error(`Cannot use reserved constant name: '${name}'`);
    }
    if (FUNCTIONS.hasOwnProperty(name)) {
      throw new Error(`Cannot use reserved function name: '${name}'`);
    }

    // Convert number to string
    const exprStr = typeof expression === 'number' ? String(expression) : String(expression).trim();

    // Parse expression
    const lexer = new Lexer(exprStr);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    // Extract dependencies
    const dependencies = extractDependencies(ast);

    // Check for self-reference
    if (dependencies.has(name)) {
      throw new Error(`Circular dependency: '${name}' cannot reference itself`);
    }

    // Store parameter
    this.params.set(name, {
      expression: exprStr,
      ast,
      dependencies,
      cachedValue: null,
    });

    // Invalidate cache for this param and dependents
    this.invalidateCache(name);

    // Trigger change callback
    if (this.onChange) {
      this.onChange(name, this.get(name));
    }

    return this;
  }

  /**
   * Get the evaluated value of a parameter
   * @param {string} name - Parameter name
   * @returns {number} Evaluated value
   */
  get(name) {
    const param = this.params.get(name);
    if (!param) {
      throw new Error(`Unknown parameter: '${name}'`);
    }

    // Return cached value if available
    if (param.cachedValue !== null) {
      return param.cachedValue;
    }

    // Check for circular dependency
    if (this.evaluationStack.has(name)) {
      const cycle = [...this.evaluationStack, name].join(' → ');
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    // Add to evaluation stack
    this.evaluationStack.add(name);

    try {
      // Evaluate the expression
      const value = evaluateAST(param.ast, varName => this.get(varName));

      // Cache the result
      param.cachedValue = value;

      return value;
    } finally {
      // Remove from evaluation stack
      this.evaluationStack.delete(name);
    }
  }

  /**
   * Get the raw expression string for a parameter
   * @param {string} name - Parameter name
   * @returns {string} Expression string
   */
  getExpression(name) {
    const param = this.params.get(name);
    if (!param) {
      throw new Error(`Unknown parameter: '${name}'`);
    }
    return param.expression;
  }

  /**
   * Evaluate an arbitrary expression (without storing)
   * @param {string} expression - Expression string
   * @returns {number} Evaluated value
   */
  evaluate(expression) {
    const exprStr = String(expression).trim();

    // Fast path for pure numbers
    const numMatch = exprStr.match(/^-?\d+\.?\d*$/);
    if (numMatch) {
      return parseFloat(exprStr);
    }

    const lexer = new Lexer(exprStr);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    return evaluateAST(ast, varName => this.get(varName));
  }

  /**
   * Check if a parameter exists
   * @param {string} name - Parameter name
   * @returns {boolean}
   */
  has(name) {
    return this.params.has(name);
  }

  /**
   * Delete a parameter
   * @param {string} name - Parameter name
   */
  delete(name) {
    if (!this.params.has(name)) return false;

    // Check if any other params depend on this one
    const dependents = this.getDependents(name);
    if (dependents.length > 0) {
      throw new Error(
        `Cannot delete '${name}': other parameters depend on it (${dependents.join(', ')})`
      );
    }

    this.params.delete(name);

    if (this.onChange) {
      this.onChange(name, undefined);
    }

    return true;
  }

  /**
   * Rename a parameter
   * @param {string} oldName - Current name
   * @param {string} newName - New name
   */
  rename(oldName, newName) {
    if (!this.params.has(oldName)) {
      throw new Error(`Unknown parameter: '${oldName}'`);
    }
    if (this.params.has(newName)) {
      throw new Error(`Parameter '${newName}' already exists`);
    }

    // Get the old parameter
    const param = this.params.get(oldName);

    // Update references in all dependent parameters
    const dependents = this.getDependents(oldName);
    for (const depName of dependents) {
      const dep = this.params.get(depName);
      if (dep) {
        // Replace oldName with newName in the expression
        const newExpr = this.replaceIdentifier(dep.expression, oldName, newName);
        // Re-parse and store
        this.set(depName, newExpr);
      }
    }

    // Delete old and create new
    this.params.delete(oldName);
    this.params.set(newName, param);

    return this;
  }

  /**
   * Replace an identifier in an expression string
   */
  replaceIdentifier(expression, oldName, newName) {
    // Use regex to replace whole word only
    const regex = new RegExp(`\\b${oldName}\\b`, 'g');
    return expression.replace(regex, newName);
  }

  /**
   * Get the direct dependencies of a parameter (what it references)
   * @param {string} name - Parameter name
   * @returns {string[]} Array of parameter names this depends on
   */
  getDependencies(name) {
    const param = this.params.get(name);
    if (!param) return [];
    return Array.from(param.dependencies);
  }

  /**
   * Get all parameters that depend on a given parameter
   * @param {string} name - Parameter name
   * @returns {string[]} Array of parameter names that depend on this
   */
  getDependents(name) {
    const dependents = [];

    for (const [paramName, param] of this.params) {
      if (param.dependencies.has(name)) {
        dependents.push(paramName);
      }
    }

    return dependents;
  }

  /**
   * Get all transitive dependents (including indirect)
   * @param {string} name - Parameter name
   * @returns {string[]} Array of all parameter names affected by changes to this
   */
  getAllDependents(name) {
    const all = new Set();
    const queue = [name];

    while (queue.length > 0) {
      const current = queue.shift();
      const deps = this.getDependents(current);

      for (const dep of deps) {
        if (!all.has(dep)) {
          all.add(dep);
          queue.push(dep);
        }
      }
    }

    return Array.from(all);
  }

  /**
   * Invalidate cached value for a parameter and all its dependents
   * @param {string} name - Parameter name
   */
  invalidateCache(name) {
    const param = this.params.get(name);
    if (param) {
      param.cachedValue = null;
    }

    // Invalidate all dependents recursively
    for (const depName of this.getAllDependents(name)) {
      const dep = this.params.get(depName);
      if (dep) {
        dep.cachedValue = null;
      }
    }
  }

  /**
   * Check for circular dependencies starting from a parameter
   * @param {string} name - Parameter name to check
   * @returns {{ circular: boolean, cycle?: string[] }}
   */
  checkCircular(name) {
    const visited = new Set();
    const path = [];

    const dfs = current => {
      if (path.includes(current)) {
        // Found cycle
        const cycleStart = path.indexOf(current);
        return { circular: true, cycle: [...path.slice(cycleStart), current] };
      }

      if (visited.has(current)) {
        return { circular: false };
      }

      visited.add(current);
      path.push(current);

      const param = this.params.get(current);
      if (param) {
        for (const dep of param.dependencies) {
          if (this.params.has(dep)) {
            const result = dfs(dep);
            if (result.circular) return result;
          }
        }
      }

      path.pop();
      return { circular: false };
    };

    return dfs(name);
  }

  /**
   * Get all parameters in dependency order (leaves first)
   * @returns {string[]} Parameter names in topological order
   */
  getTopologicalOrder() {
    const visited = new Set();
    const order = [];

    const visit = name => {
      if (visited.has(name)) return;
      visited.add(name);

      const param = this.params.get(name);
      if (param) {
        for (const dep of param.dependencies) {
          if (this.params.has(dep)) {
            visit(dep);
          }
        }
      }

      order.push(name);
    };

    for (const name of this.params.keys()) {
      visit(name);
    }

    return order;
  }

  /**
   * Get all parameters as an array
   * @returns {Array<{ name: string, expression: string, value: number, dependencies: string[] }>}
   */
  getAll() {
    const result = [];

    for (const [name, param] of this.params) {
      let value;
      let error = null;

      try {
        value = this.get(name);
      } catch (e) {
        value = NaN;
        error = e.message;
      }

      result.push({
        name,
        expression: param.expression,
        value,
        dependencies: Array.from(param.dependencies),
        error,
      });
    }

    return result;
  }

  /**
   * Clear all parameters
   */
  clear() {
    this.params.clear();
    this.evaluationStack.clear();
  }

  /**
   * Serialize parameters to JSON
   * @returns {Object}
   */
  toJSON() {
    const params = {};
    for (const [name, param] of this.params) {
      params[name] = param.expression;
    }
    return params;
  }

  /**
   * Load parameters from JSON
   * @param {Object} json - Object mapping names to expressions
   */
  fromJSON(json) {
    this.clear();

    // First pass: add all params
    for (const [name, expression] of Object.entries(json)) {
      this.set(name, expression);
    }

    return this;
  }

  /**
   * Get the list of available functions
   * @returns {string[]}
   */
  static getFunctions() {
    return Object.keys(FUNCTIONS);
  }

  /**
   * Get the list of available constants
   * @returns {Object}
   */
  static getConstants() {
    return { ...CONSTANTS };
  }
}

/**
 * Create a global parameter store instance
 */
export const parameters = new ParameterStore();

/**
 * Helper to evaluate a feature parameter that might be an expression
 * @param {any} value - Raw parameter value (number or expression string)
 * @param {ParameterStore} [store] - Parameter store to use (defaults to global)
 * @returns {number} Evaluated numeric value
 */
export function evaluateParam(value, store = parameters) {
  // Already a number
  if (typeof value === 'number') {
    return value;
  }

  // Expression string
  if (typeof value === 'string') {
    return store.evaluate(value);
  }

  // Fallback
  return Number(value) || 0;
}

/**
 * Get dependencies for a parameter value
 * @param {any} value - Parameter value to check
 * @returns {string[]} Array of parameter names referenced
 */
export function getParamDependencies(value) {
  if (typeof value !== 'string') {
    return [];
  }

  try {
    const lexer = new Lexer(value);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    return Array.from(extractDependencies(ast));
  } catch {
    return [];
  }
}

export default ParameterStore;
