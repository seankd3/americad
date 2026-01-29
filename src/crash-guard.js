/**
 * Ameri-CAD Crash Guard
 * Auto-save and recovery system using localStorage
 *
 * Saves the last 50 commands to enable recovery after crashes
 */

export const CrashGuard = {
  KEY: 'americad_crash_recovery',
  STATE_KEY: 'americad_session_state',
  MAX_COMMANDS: 50,
  AUTOSAVE_INTERVAL: 5000, // 5 seconds

  commands: [],
  intervalId: null,
  lastSaveTime: 0,

  /**
   * Initialize the crash guard
   * Call this on app startup
   */
  init() {
    // Load any existing commands
    this.loadFromStorage();

    // Start autosave interval
    this.startAutosave();

    // Save on page unload
    window.addEventListener('beforeunload', () => {
      this.saveToStorage();
      this.saveSessionState('unloading');
    });

    // Save on visibility change (tab hidden)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.saveToStorage();
      }
    });

    console.log('[CrashGuard] Initialized');
    return this;
  },

  /**
   * Record a command for potential recovery
   */
  recordCommand(command) {
    const record = {
      type: command.type,
      data: command.data || {},
      timestamp: Date.now(),
      id: this.generateId(),
    };

    this.commands.push(record);

    // Trim to max commands
    if (this.commands.length > this.MAX_COMMANDS) {
      this.commands = this.commands.slice(-this.MAX_COMMANDS);
    }

    // Immediate save for important operations
    if (this.shouldImmediateSave(command.type)) {
      this.saveToStorage();
    }

    return record;
  },

  /**
   * Check if command type warrants immediate save
   */
  shouldImmediateSave(type) {
    const criticalTypes = ['CREATE_PRIMITIVE', 'DELETE', 'IMPORT', 'BOOLEAN_OP'];
    return criticalTypes.includes(type);
  },

  /**
   * Save commands to localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem(
        this.KEY,
        JSON.stringify({
          commands: this.commands,
          savedAt: Date.now(),
          version: '2.0.1-LA',
        })
      );
      this.lastSaveTime = Date.now();
    } catch (e) {
      console.error('[CrashGuard] Failed to save:', e);
    }
  },

  /**
   * Load commands from localStorage
   */
  loadFromStorage() {
    try {
      const data = localStorage.getItem(this.KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.commands = parsed.commands || [];
        return parsed;
      }
    } catch (e) {
      console.error('[CrashGuard] Failed to load:', e);
    }
    return null;
  },

  /**
   * Save session state for crash detection
   */
  saveSessionState(state) {
    try {
      localStorage.setItem(
        this.STATE_KEY,
        JSON.stringify({
          state: state,
          timestamp: Date.now(),
          url: window.location.href,
        })
      );
    } catch (e) {
      console.error('[CrashGuard] Failed to save state:', e);
    }
  },

  /**
   * Check if there's recovery data from a previous crash
   */
  hasRecoveryData() {
    try {
      const data = localStorage.getItem(this.KEY);
      if (!data) return false;

      const parsed = JSON.parse(data);

      // Check if data is recent (within last hour)
      const age = Date.now() - (parsed.savedAt || 0);
      const ONE_HOUR = 60 * 60 * 1000;

      return parsed.commands && parsed.commands.length > 0 && age < ONE_HOUR;
    } catch {
      return false;
    }
  },

  /**
   * Check if last session ended abnormally (crash detection)
   */
  detectCrash() {
    try {
      const stateData = localStorage.getItem(this.STATE_KEY);
      if (!stateData) return false;

      const state = JSON.parse(stateData);

      // If last state wasn't 'unloading', it was a crash
      return state.state !== 'unloading' && state.state !== 'clean';
    } catch {
      return false;
    }
  },

  /**
   * Get recovery data for replay
   */
  getRecoveryData() {
    const data = this.loadFromStorage();
    return data ? data.commands : [];
  },

  /**
   * Get recovery summary for user prompt
   */
  getRecoverySummary() {
    const commands = this.getRecoveryData();
    if (commands.length === 0) return null;

    const types = {};
    commands.forEach(cmd => {
      types[cmd.type] = (types[cmd.type] || 0) + 1;
    });

    const oldest = commands[0];
    const newest = commands[commands.length - 1];

    return {
      commandCount: commands.length,
      types: types,
      timeRange: {
        start: new Date(oldest.timestamp).toLocaleString(),
        end: new Date(newest.timestamp).toLocaleString(),
      },
      ageMinutes: Math.round((Date.now() - newest.timestamp) / 60000),
    };
  },

  /**
   * Clear recovery data after successful recovery or user decline
   */
  clear() {
    this.commands = [];
    try {
      localStorage.removeItem(this.KEY);
      localStorage.removeItem(this.STATE_KEY);
    } catch (e) {
      console.error('[CrashGuard] Failed to clear:', e);
    }
  },

  /**
   * Mark session as clean (no crash)
   */
  markClean() {
    this.saveSessionState('clean');
  },

  /**
   * Start autosave interval
   */
  startAutosave() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(() => {
      if (this.commands.length > 0) {
        this.saveToStorage();
      }
      this.saveSessionState('running');
    }, this.AUTOSAVE_INTERVAL);
  },

  /**
   * Stop autosave interval
   */
  stopAutosave() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  },

  /**
   * Generate unique command ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  },

  /**
   * Show recovery prompt to user
   * Returns promise that resolves to true (recover) or false (discard)
   */
  async promptRecovery() {
    const summary = this.getRecoverySummary();
    if (!summary) return false;

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'crash-recovery-modal';
    modal.innerHTML = `
            <div class="crash-recovery-content">
                <div class="crash-recovery-header">
                    <span class="crash-icon">⚠</span>
                    <h2>RECOVER PREVIOUS SESSION?</h2>
                </div>
                <div class="crash-recovery-body">
                    <p>Ameri-CAD detected unsaved work from a previous session.</p>
                    <div class="crash-recovery-stats">
                        <div class="stat">
                            <span class="stat-value">${summary.commandCount}</span>
                            <span class="stat-label">COMMANDS</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">${summary.ageMinutes}</span>
                            <span class="stat-label">MIN AGO</span>
                        </div>
                    </div>
                    <p class="crash-recovery-time">
                        Last saved: ${summary.timeRange.end}
                    </p>
                </div>
                <div class="crash-recovery-footer">
                    <button class="btn btn-secondary" data-action="discard">DISCARD</button>
                    <button class="btn btn-primary" data-action="recover">RECOVER</button>
                </div>
            </div>
        `;

    // Add styles if not present
    if (!document.getElementById('crash-recovery-styles')) {
      const style = document.createElement('style');
      style.id = 'crash-recovery-styles';
      style.textContent = `
                .crash-recovery-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }
                .crash-recovery-content {
                    background: #1a1a1f;
                    border: 1px solid #e8b13f;
                    border-radius: 4px;
                    padding: 24px;
                    max-width: 400px;
                    text-align: center;
                }
                .crash-recovery-header {
                    margin-bottom: 16px;
                }
                .crash-icon {
                    font-size: 48px;
                    color: #e8b13f;
                }
                .crash-recovery-header h2 {
                    color: #e8b13f;
                    font-size: 16px;
                    margin: 12px 0 0;
                    letter-spacing: 1px;
                }
                .crash-recovery-body {
                    color: #a0a0a5;
                    font-size: 12px;
                    margin-bottom: 20px;
                }
                .crash-recovery-stats {
                    display: flex;
                    justify-content: center;
                    gap: 40px;
                    margin: 16px 0;
                }
                .stat {
                    display: flex;
                    flex-direction: column;
                }
                .stat-value {
                    font-size: 28px;
                    color: #e0e0e5;
                    font-weight: bold;
                }
                .stat-label {
                    font-size: 10px;
                    color: #6a6a70;
                    letter-spacing: 1px;
                }
                .crash-recovery-time {
                    font-size: 11px;
                    color: #6a6a70;
                }
                .crash-recovery-footer {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                }
                .crash-recovery-footer .btn {
                    padding: 8px 24px;
                    border: 1px solid #35353a;
                    background: transparent;
                    color: #a0a0a5;
                    font-family: monospace;
                    font-size: 11px;
                    cursor: pointer;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .crash-recovery-footer .btn-primary {
                    background: #e8b13f;
                    border-color: #e8b13f;
                    color: #0a0a0b;
                }
                .crash-recovery-footer .btn:hover {
                    opacity: 0.8;
                }
            `;
      document.head.appendChild(style);
    }

    document.body.appendChild(modal);

    return new Promise(resolve => {
      modal.querySelector('[data-action="recover"]').addEventListener('click', () => {
        modal.remove();
        resolve(true);
      });

      modal.querySelector('[data-action="discard"]').addEventListener('click', () => {
        modal.remove();
        this.clear();
        resolve(false);
      });
    });
  },
};

// Auto-initialize when imported
if (typeof window !== 'undefined') {
  window.CrashGuard = CrashGuard;
}

export default CrashGuard;
