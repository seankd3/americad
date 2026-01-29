/**
 * Ameri-CAD Parameter Commands
 *
 * CLI commands for managing parametric expressions.
 *
 * Commands:
 *   param width 50              - Define parameter with value
 *   param height width * 2      - Expression referencing other param
 *   param list                  - Show all parameters
 *   param delete width          - Remove parameter
 *   param clear                 - Clear all parameters
 *   param eval width + 10       - Evaluate expression without storing
 */

import { registerCommand } from '../core/commands.js';
import { parameters, evaluateParam } from '../state/parameters.js';

/**
 * Register parameter commands
 */
export function registerParameterCommands() {
  // PARAM - Main parameter command with subcommands
  registerCommand('param', {
    aliases: ['p', 'var', 'variable'],
    description: 'Manage parametric expressions (set, list, delete, eval)',
    category: 'parameters',
    params: [
      {
        name: 'nameOrAction',
        type: 'string',
        required: true,
        description: 'Parameter name, or action (list, delete, clear, eval)',
      },
    ],
    execute(params, context) {
      const firstArg = params.nameOrAction?.toLowerCase?.() || params.nameOrAction;
      const rest = params._rest || [];

      // Handle special actions
      switch (firstArg) {
        case 'list':
        case 'ls':
        case 'show':
          return listParameters();

        case 'clear':
        case 'reset':
          return clearParameters();

        case 'delete':
        case 'del':
        case 'rm':
        case 'remove':
          if (rest.length === 0) {
            return 'Usage: param delete <name>';
          }
          return deleteParameter(rest[0]);

        case 'eval':
        case 'evaluate':
        case 'calc':
          if (rest.length === 0) {
            return 'Usage: param eval <expression>';
          }
          return evaluateExpression(rest.join(' '));

        case 'help':
        case '?':
          return getParamHelp();

        default:
          // Setting a parameter: param <name> <expression>
          if (rest.length === 0) {
            // Just showing a single param value
            return showParameter(params.nameOrAction);
          }
          return setParameter(params.nameOrAction, rest.join(' '), context);
      }
    },
  });

  // Shorthand commands for common operations
  registerCommand('params', {
    aliases: ['variables', 'vars'],
    description: 'List all parameters (shorthand for "param list")',
    category: 'parameters',
    execute() {
      return listParameters();
    },
  });
}

/**
 * Set a parameter
 */
function setParameter(name, expression, context) {
  try {
    parameters.set(name, expression);
    const value = parameters.get(name);

    // Trigger feature regeneration if evaluator is available
    triggerRegeneration(name, context);

    return `${name} = ${formatValue(value)}  (${expression})`;
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

/**
 * Show a single parameter
 */
function showParameter(name) {
  try {
    if (!parameters.has(name)) {
      return `Parameter '${name}' not found`;
    }

    const value = parameters.get(name);
    const expr = parameters.getExpression(name);
    const deps = parameters.getDependencies(name);
    const dependents = parameters.getDependents(name);

    let result = `${name} = ${formatValue(value)}`;

    if (expr !== String(value)) {
      result += `  (${expr})`;
    }

    if (deps.length > 0) {
      result += `\n  Uses: ${deps.join(', ')}`;
    }

    if (dependents.length > 0) {
      result += `\n  Used by: ${dependents.join(', ')}`;
    }

    return result;
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

/**
 * List all parameters
 */
function listParameters() {
  const all = parameters.getAll();

  if (all.length === 0) {
    return 'No parameters defined. Use "param <name> <value>" to create one.';
  }

  // Get topological order for display
  const order = parameters.getTopologicalOrder();
  all.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

  const lines = ['PARAMETERS', '─'.repeat(50)];

  for (const param of all) {
    const valueStr = param.error ? `ERROR: ${param.error}` : formatValue(param.value);

    // Show expression only if different from value
    const exprStr = param.expression !== String(param.value) ? `  = ${param.expression}` : '';

    lines.push(`  ${param.name.padEnd(15)} ${valueStr.padStart(12)}${exprStr}`);
  }

  lines.push('─'.repeat(50));
  lines.push(`${all.length} parameter(s)`);

  return lines.join('\n');
}

/**
 * Delete a parameter
 */
function deleteParameter(name) {
  try {
    if (!parameters.has(name)) {
      return `Parameter '${name}' not found`;
    }

    parameters.delete(name);
    return `Deleted parameter '${name}'`;
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

/**
 * Clear all parameters
 */
function clearParameters() {
  const count = parameters.getAll().length;
  parameters.clear();
  return `Cleared ${count} parameter(s)`;
}

/**
 * Evaluate an expression without storing
 */
function evaluateExpression(expression) {
  try {
    const value = parameters.evaluate(expression);
    return `${expression} = ${formatValue(value)}`;
  } catch (e) {
    return `Error evaluating "${expression}": ${e.message}`;
  }
}

/**
 * Get help text for param command
 */
function getParamHelp() {
  return `PARAMETER COMMANDS

Define parametric values and expressions that can reference each other.

USAGE:
  param <name> <value|expression>    Set parameter
  param <name>                       Show parameter value
  param list                         List all parameters
  param delete <name>                Delete parameter
  param clear                        Clear all parameters
  param eval <expression>            Evaluate without storing

EXPRESSIONS:
  Basic math:      width * 2 + 10
  Functions:       sqrt(x^2 + y^2), min(a, b), max(a, b, c)
  Trig:            sin(angle), cos(rad(45)), atan2(y, x)
  Constants:       PI, E, TAU

FUNCTIONS:
  sqrt, abs, floor, ceil, round, pow, log, log10, exp
  sin, cos, tan, asin, acos, atan, atan2
  min, max, rad (deg→rad), deg (rad→deg)

EXAMPLES:
  param width 100
  param height width / 2
  param diagonal sqrt(width^2 + height^2)
  param angle rad(45)`;
}

/**
 * Format a numeric value for display
 */
function formatValue(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    return 'NaN';
  }

  if (!isFinite(value)) {
    return value > 0 ? '∞' : '-∞';
  }

  if (Number.isInteger(value)) {
    return value.toString();
  }

  // Scientific notation for very small/large numbers
  if (Math.abs(value) < 0.0001 || Math.abs(value) >= 1e7) {
    return value.toExponential(4);
  }

  // Fixed precision, remove trailing zeros
  return value.toPrecision(8).replace(/\.?0+$/, '');
}

/**
 * Trigger feature regeneration when a parameter changes
 */
function triggerRegeneration(paramName, context) {
  // Get evaluator from context
  const evaluator = context?.evaluator || context?.app?.evaluator;
  if (!evaluator) return;

  // Get document
  const doc = context?.document || context?.app?.document;
  if (!doc) return;

  // Find features that use this parameter and regenerate them
  const features = doc.getFeatures?.() || [];

  for (const feature of features) {
    if (featureUsesParameter(feature, paramName)) {
      // Re-evaluate the feature
      try {
        evaluator.evaluateFeature?.(feature.id);
      } catch {
        // Silent fail - feature will show error state
      }
    }
  }
}

/**
 * Check if a feature uses a given parameter
 */
function featureUsesParameter(feature, paramName) {
  if (!feature?.params) return false;

  // Check all parameter values
  for (const value of Object.values(feature.params)) {
    if (typeof value === 'string') {
      // Check if expression references the parameter
      const regex = new RegExp(`\\b${paramName}\\b`);
      if (regex.test(value)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Helper to evaluate a parameter value (for use in primitive commands)
 * Handles both raw numbers and expression strings
 */
export function resolveParam(value) {
  return evaluateParam(value, parameters);
}

export default { registerParameterCommands };
