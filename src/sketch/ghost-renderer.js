/**
 * Ameri-CAD Ghost Constraint Renderer
 *
 * Renders ghost constraint suggestions visually on the sketch canvas.
 * Ghost constraints appear as faint yellow markers with acceptance hints.
 */

import { GhostSymbols } from './ghost-constraints.js';
import { ConstraintTypes } from './constraints.js';

/**
 * Ghost rendering configuration
 */
export const GhostRenderConfig = {
  // Colors
  markerColor: '#ffcc00', // Yellow ghost markers
  hintColor: '#ffcc00', // Hint text color
  lineColor: 'rgba(255, 204, 0, 0.3)', // Ghost guide lines

  // Opacity
  markerOpacity: 0.6,
  hintOpacity: 0.5,
  secondaryOpacity: 0.3,

  // Sizes
  markerFont: '14px monospace',
  hintFont: '10px sans-serif',
  markerOffset: { x: 5, y: -5 }, // Offset from position

  // Animation
  pulseEnabled: true,
  pulseSpeed: 2, // Hz
};

/**
 * Get the symbol for a constraint type
 * @param {string} type - Constraint type
 * @returns {string} Symbol character
 */
export function getConstraintSymbol(type) {
  return (
    GhostSymbols[type] ||
    {
      [ConstraintTypes.HORIZONTAL]: 'H',
      [ConstraintTypes.VERTICAL]: 'V',
      [ConstraintTypes.PARALLEL]: '∥',
      [ConstraintTypes.PERPENDICULAR]: '⊥',
      [ConstraintTypes.EQUAL]: '=',
      [ConstraintTypes.COINCIDENT]: '●',
      [ConstraintTypes.TANGENT]: 'T',
      [ConstraintTypes.CONCENTRIC]: '⊕',
      [ConstraintTypes.MIDPOINT]: 'M',
      [ConstraintTypes.COLINEAR]: '—',
    }[type] ||
    '?'
  );
}

/**
 * Calculate the display position for a ghost constraint
 * @param {Object} ghost - Ghost constraint object
 * @param {Object} sketch - The sketch for coordinate conversion (optional)
 * @returns {Object} Position {x, y} in screen/canvas coordinates
 */
export function getGhostPosition(ghost, _sketch = null) {
  // If ghost has explicit position, use it
  if (ghost.position) {
    return { x: ghost.position.x, y: ghost.position.y };
  }

  // Calculate from entities
  if (ghost.entity) {
    return getEntityCenter(ghost.entity);
  }

  if (ghost.entities && ghost.entities.length > 0) {
    // For multi-entity constraints, use the last entity (the new one)
    const lastEntity = ghost.entities[ghost.entities.length - 1];
    return getEntityCenter(lastEntity);
  }

  return { x: 0, y: 0 };
}

/**
 * Get the center/midpoint of an entity
 */
function getEntityCenter(entity) {
  if (!entity) return { x: 0, y: 0 };

  // Line - return midpoint
  if (entity.start && entity.end) {
    return {
      x: (entity.start.x + entity.end.x) / 2,
      y: (entity.start.y + entity.end.y) / 2,
    };
  }

  // Circle - return center
  if (entity.center) {
    return { x: entity.center.x, y: entity.center.y };
  }

  // Point
  if ('x' in entity && 'y' in entity) {
    return { x: entity.x, y: entity.y };
  }

  return { x: 0, y: 0 };
}

/**
 * Render ghost constraints on a 2D canvas context
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} ghosts - Array of ghost constraint objects
 * @param {Object} options - Rendering options
 * @param {Function} options.worldToScreen - Function to convert world coords to screen coords
 * @param {number} options.time - Current time for animation (optional)
 */
export function renderGhostConstraints(ctx, ghosts, options = {}) {
  if (!ctx || !ghosts || ghosts.length === 0) return;

  const { worldToScreen = pos => pos, time = Date.now() / 1000 } = options;

  ctx.save();

  // Calculate pulse alpha for animation
  let pulseAlpha = 1;
  if (GhostRenderConfig.pulseEnabled) {
    pulseAlpha = 0.7 + 0.3 * Math.sin(time * Math.PI * 2 * GhostRenderConfig.pulseSpeed);
  }

  ghosts.forEach((ghost, index) => {
    const pos = getGhostPosition(ghost);
    const screenPos = worldToScreen(pos);

    // Determine opacity based on position in list
    const isTop = index === 0;
    const alpha = isTop
      ? GhostRenderConfig.markerOpacity * pulseAlpha
      : GhostRenderConfig.secondaryOpacity;

    ctx.globalAlpha = alpha;

    // Draw marker background (rounded rect)
    const symbol = getConstraintSymbol(ghost.type);
    ctx.font = GhostRenderConfig.markerFont;
    const metrics = ctx.measureText(symbol);
    const padding = 4;
    const bgWidth = metrics.width + padding * 2;
    const bgHeight = 18;

    const markerX = screenPos.x + GhostRenderConfig.markerOffset.x;
    const markerY = screenPos.y + GhostRenderConfig.markerOffset.y;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    roundRect(ctx, markerX - padding, markerY - bgHeight + 4, bgWidth, bgHeight, 3);
    ctx.fill();

    // Symbol
    ctx.fillStyle = GhostRenderConfig.markerColor;
    ctx.fillText(symbol, markerX, markerY);

    // Draw "[Tab]" hint for top ghost
    if (isTop) {
      ctx.globalAlpha = GhostRenderConfig.hintOpacity * pulseAlpha;
      ctx.font = GhostRenderConfig.hintFont;
      ctx.fillStyle = GhostRenderConfig.hintColor;
      ctx.fillText('[Tab]', markerX + bgWidth + 4, markerY);
    }

    // Draw guide line to reference entity for relationship constraints
    if (ghost.referenceEntity && ghost.entities && ghost.entities.length > 1) {
      ctx.globalAlpha = GhostRenderConfig.secondaryOpacity * 0.5;
      ctx.strokeStyle = GhostRenderConfig.lineColor;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;

      const refPos = getEntityCenter(ghost.referenceEntity);
      const refScreenPos = worldToScreen(refPos);

      ctx.beginPath();
      ctx.moveTo(screenPos.x, screenPos.y);
      ctx.lineTo(refScreenPos.x, refScreenPos.y);
      ctx.stroke();

      ctx.setLineDash([]);
    }
  });

  ctx.restore();
}

/**
 * Draw a rounded rectangle
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Render ghost constraints for Three.js (creates sprite/text objects)
 *
 * @param {THREE.Scene|THREE.Group} container - Container to add ghosts to
 * @param {Array} ghosts - Array of ghost constraint objects
 * @param {Object} options - Rendering options
 * @returns {Array} Array of created Three.js objects (for cleanup)
 */
export function createGhostSprites(_container, _ghosts, _options = {}) {
  // This is a placeholder for Three.js integration
  // The actual implementation would create sprite objects with canvas textures
  // For now, the 2D overlay approach in renderGhostConstraints is preferred
  return [];
}

/**
 * Ghost Constraint Overlay Manager
 *
 * Manages a dedicated canvas overlay for rendering ghost constraints
 * in a Three.js-based application.
 */
export class GhostOverlayManager {
  constructor(containerElement) {
    this.container = containerElement;
    this.canvas = null;
    this.ctx = null;
    this.ghosts = [];
    this.worldToScreen = pos => pos;
    this._animationId = null;
    this._enabled = true;
  }

  /**
   * Initialize the overlay canvas
   */
  init() {
    if (this.canvas) return;

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 100;
    `;
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this._resize();
    window.addEventListener('resize', this._resize.bind(this));
  }

  /**
   * Destroy the overlay
   */
  destroy() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
    }
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    window.removeEventListener('resize', this._resize.bind(this));
    this.canvas = null;
    this.ctx = null;
  }

  /**
   * Set the world-to-screen coordinate transform function
   */
  setTransform(worldToScreen) {
    this.worldToScreen = worldToScreen;
  }

  /**
   * Update the ghosts to render
   */
  setGhosts(ghosts) {
    this.ghosts = ghosts || [];
  }

  /**
   * Enable/disable rendering
   */
  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  /**
   * Clear the overlay
   */
  clear() {
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Render the current ghosts
   */
  render() {
    if (!this.ctx || !this._enabled) return;

    this.clear();

    if (this.ghosts.length === 0) return;

    renderGhostConstraints(this.ctx, this.ghosts, {
      worldToScreen: this.worldToScreen,
      time: Date.now() / 1000,
    });
  }

  /**
   * Start animation loop
   */
  startAnimation() {
    const animate = () => {
      this.render();
      this._animationId = requestAnimationFrame(animate);
    };
    animate();
  }

  /**
   * Stop animation loop
   */
  stopAnimation() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  /**
   * Resize canvas to match container
   */
  _resize() {
    if (!this.canvas || !this.container) return;

    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';

    if (this.ctx) {
      this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
  }
}

export default {
  renderGhostConstraints,
  getConstraintSymbol,
  getGhostPosition,
  GhostRenderConfig,
  GhostOverlayManager,
};
