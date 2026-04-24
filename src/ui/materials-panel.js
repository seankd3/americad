/**
 * Materials Panel
 *
 * Renders document material usage from the active scene instead of a static
 * sample catalog.
 */

export class MaterialsPanel {
  constructor(options = {}) {
    this.container = document.getElementById('panel-materials');
    this.getObjects = options.getObjects || (() => []);
    this.getSelected = options.getSelected || (() => null);
    this.search = '';

    if (!this.container) {
      console.warn('[MaterialsPanel] Materials panel container not found');
      return;
    }

    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="data-section materials-panel">
        <div class="section-header">
          <span class="section-title">DOCUMENT MATERIALS</span>
        </div>
        <div class="section-body">
          <div class="property-row">
            <span class="property-label">FILTER</span>
            <input type="text" class="property-input" id="materials-filter" placeholder="MATERIAL...">
          </div>
          <div class="divider"></div>
          <div class="materials-summary" id="materials-summary"></div>
          <div class="materials-list" id="materials-list"></div>
        </div>
      </div>
    `;

    this.filterInput = this.container.querySelector('#materials-filter');
    this.summaryEl = this.container.querySelector('#materials-summary');
    this.listEl = this.container.querySelector('#materials-list');

    this.filterInput.addEventListener('input', event => {
      this.search = event.target.value.trim().toLowerCase();
      this.render();
    });

    this.addStyles();
    this.render();
  }

  render() {
    if (!this.container) return;

    const objects = this.getObjects().filter(object => object?.userData?.type === 'body');
    const selected = this.getSelected();
    const materialRows = this.buildRows(objects, selected);
    const visibleRows = materialRows.filter(row => row.name.toLowerCase().includes(this.search));

    this.summaryEl.textContent = `${objects.length} ${objects.length === 1 ? 'BODY' : 'BODIES'} / ${
      materialRows.length
    } ${materialRows.length === 1 ? 'MATERIAL' : 'MATERIALS'}`;

    if (objects.length === 0) {
      this.listEl.innerHTML = `
        <div class="materials-empty" id="materials-empty">
          <div class="empty-icon">◎</div>
          <div class="empty-text">NO MATERIALS IN DOCUMENT</div>
          <div class="empty-hint">Create a body to see assigned materials</div>
        </div>
      `;
      return;
    }

    if (visibleRows.length === 0) {
      this.listEl.innerHTML = `
        <div class="materials-empty" id="materials-empty">
          <div class="empty-text">NO MATCHES</div>
        </div>
      `;
      return;
    }

    this.listEl.innerHTML = visibleRows
      .map(
        row => `
          <div class="material-row" data-material="${this.escapeAttr(row.name)}">
            <div class="material-chip" style="--material-color: ${row.color}"></div>
            <div class="material-meta">
              <div class="material-name">${this.escapeHtml(row.name)}</div>
              <div class="material-detail">${row.count} ${row.count === 1 ? 'body' : 'bodies'}${
                row.selected ? ' / selected' : ''
              }</div>
            </div>
          </div>
        `
      )
      .join('');
  }

  buildRows(objects, selected) {
    const rows = new Map();

    objects.forEach(object => {
      const materialName = object.userData?.material || 'Generic';
      const current = rows.get(materialName) || {
        name: materialName,
        count: 0,
        selected: false,
        color: this.getObjectColor(object),
      };

      current.count += 1;
      current.selected ||= selected?.uuid === object.uuid;
      rows.set(materialName, current);
    });

    return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  getObjectColor(object) {
    const hex = object.material?.color?.getHexString?.();
    return hex ? `#${hex}` : '#808080';
  }

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  escapeAttr(value) {
    return this.escapeHtml(value).replace(/`/g, '&#96;');
  }

  addStyles() {
    if (document.getElementById('materials-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'materials-panel-styles';
    style.textContent = `
      .materials-summary {
        color: var(--text-secondary);
        font-size: 11px;
        letter-spacing: 0;
        margin-bottom: var(--space-2);
      }

      .materials-list {
        display: grid;
        gap: var(--space-2);
      }

      .material-row {
        align-items: center;
        background: var(--bg-300);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        display: grid;
        gap: var(--space-2);
        grid-template-columns: 18px 1fr;
        min-width: 0;
        padding: var(--space-2);
      }

      .material-chip {
        background: var(--material-color);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 50%;
        height: 14px;
        width: 14px;
      }

      .material-meta {
        min-width: 0;
      }

      .material-name {
        color: var(--text-primary);
        font-size: 12px;
        font-weight: 600;
        overflow-wrap: anywhere;
      }

      .material-detail {
        color: var(--text-secondary);
        font-size: 10px;
        margin-top: 2px;
      }

      .materials-empty {
        color: var(--text-secondary);
        display: grid;
        gap: var(--space-1);
        justify-items: center;
        padding: var(--space-4) var(--space-2);
        text-align: center;
      }

      .materials-empty .empty-icon {
        color: var(--text-muted);
        font-size: 22px;
      }

      .materials-empty .empty-text {
        color: var(--text-primary);
        font-size: 12px;
        font-weight: 600;
      }

      .materials-empty .empty-hint {
        font-size: 11px;
        line-height: 1.35;
      }
    `;

    document.head.appendChild(style);
  }
}

export function initMaterialsPanel(options = {}) {
  return new MaterialsPanel(options);
}
