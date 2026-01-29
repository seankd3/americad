/**
 * Ameri-CAD Event Store
 * Implements Event Sourcing pattern for the feature DAG
 * 
 * Architecture:
 *   Events (append-only) → Projection (DocumentModel) → Geometry Cache
 * 
 * Benefits:
 * - Full audit trail of all changes
 * - Time-travel debugging
 * - Undo/redo via event truncation
 * - Easy persistence (just save events)
 */

/**
 * Event types for the document model
 */
export const EventTypes = {
    // Feature lifecycle
    FEATURE_ADDED: 'feature_added',
    FEATURE_DELETED: 'feature_deleted',
    FEATURE_RENAMED: 'feature_renamed',
    
    // Parameter changes
    PARAM_CHANGED: 'param_changed',
    PARAMS_BATCH_CHANGED: 'params_batch_changed',
    
    // Visibility
    FEATURE_VISIBILITY_CHANGED: 'feature_visibility_changed',
    
    // Dependencies
    DEPENDENCY_ADDED: 'dependency_added',
    DEPENDENCY_REMOVED: 'dependency_removed',
    
    // Document-level
    DOCUMENT_CLEARED: 'document_cleared',
    DOCUMENT_LOADED: 'document_loaded'
};

/**
 * Create an event object with standard metadata
 * @param {string} type - Event type from EventTypes
 * @param {Object} payload - Event-specific data
 * @returns {Object} Event object
 */
export function createEvent(type, payload) {
    return {
        type,
        payload,
        version: null,      // Set by EventStore.append()
        timestamp: null     // Set by EventStore.append()
    };
}

/**
 * EventStore - Append-only log of document events
 * 
 * The DocumentModel becomes a "projection" - a materialized view
 * derived by replaying events from this store.
 */
export class EventStore {
    constructor() {
        /** @type {Array<Object>} Append-only event log */
        this.events = [];
        
        /** @type {number} Current version (increments with each event) */
        this.version = 0;
        
        /** @type {Array<Object>} Events removed during undo (for redo) */
        this.redoBuffer = [];
        
        /** @type {Map<string, Set<Function>>} Event listeners */
        this._listeners = new Map();
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Event Emitter Pattern
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * Subscribe to an event type
     * @param {string} eventName - Event name to listen for
     * @param {Function} callback - Handler function
     */
    on(eventName, callback) {
        if (!this._listeners.has(eventName)) {
            this._listeners.set(eventName, new Set());
        }
        this._listeners.get(eventName).add(callback);
    }
    
    /**
     * Unsubscribe from an event type
     * @param {string} eventName - Event name
     * @param {Function} callback - Handler to remove
     */
    off(eventName, callback) {
        const listeners = this._listeners.get(eventName);
        if (listeners) {
            listeners.delete(callback);
        }
    }
    
    /**
     * Emit an event to all listeners
     * @param {string} eventName - Event name
     * @param {...*} args - Arguments to pass to handlers
     */
    emit(eventName, ...args) {
        const listeners = this._listeners.get(eventName);
        if (listeners) {
            for (const callback of listeners) {
                try {
                    callback(...args);
                } catch (e) {
                    console.error(`EventStore listener error (${eventName}):`, e);
                }
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Core Event Operations
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * Append an event to the log
     * @param {Object} event - Event object (type + payload)
     * @returns {Object} The appended event with version/timestamp
     */
    append(event) {
        // Stamp with version and timestamp
        event.version = ++this.version;
        event.timestamp = Date.now();
        
        // Append to log
        this.events.push(event);
        
        // Clear redo buffer (new action invalidates redo history)
        this.redoBuffer = [];
        
        // Notify listeners
        this.emit('eventAppended', event);
        this.emit('changed');
        
        return event;
    }
    
    /**
     * Append multiple events atomically (as a batch)
     * @param {Array<Object>} events - Array of events
     * @returns {Array<Object>} The appended events with versions
     */
    appendBatch(events) {
        const appended = [];
        const startVersion = this.version;
        
        for (const event of events) {
            event.version = ++this.version;
            event.timestamp = Date.now();
            this.events.push(event);
            appended.push(event);
        }
        
        // Clear redo buffer
        this.redoBuffer = [];
        
        // Notify once for batch
        this.emit('batchAppended', appended, startVersion);
        this.emit('changed');
        
        return appended;
    }
    
    /**
     * Get all events from a specific version
     * @param {number} fromVersion - Starting version (exclusive)
     * @returns {Array<Object>} Events after fromVersion
     */
    getEvents(fromVersion = 0) {
        return this.events.filter(e => e.version > fromVersion);
    }
    
    /**
     * Get events in a version range
     * @param {number} fromVersion - Start version (exclusive)
     * @param {number} toVersion - End version (inclusive)
     * @returns {Array<Object>} Events in range
     */
    getEventsInRange(fromVersion, toVersion) {
        return this.events.filter(e => 
            e.version > fromVersion && e.version <= toVersion
        );
    }
    
    /**
     * Get all events for a specific feature
     * @param {string} featureId - Feature ID
     * @returns {Array<Object>} Events affecting this feature
     */
    getEventsForFeature(featureId) {
        return this.events.filter(e => 
            e.payload?.featureId === featureId ||
            e.payload?.targetId === featureId
        );
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Undo/Redo via Event Truncation
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * Truncate event log to a specific version (for undo)
     * Removed events are saved to redoBuffer
     * @param {number} version - Version to truncate to
     * @returns {Array<Object>} Removed events
     */
    truncateTo(version) {
        if (version < 0 || version > this.version) {
            throw new Error(`Invalid truncate version: ${version}`);
        }
        
        // Find events to remove
        const removed = this.events.filter(e => e.version > version);
        
        // Save to redo buffer (in order, for replay)
        this.redoBuffer = [...removed, ...this.redoBuffer];
        
        // Truncate
        this.events = this.events.filter(e => e.version <= version);
        this.version = version;
        
        // Notify
        this.emit('truncated', version, removed);
        this.emit('changed');
        
        return removed;
    }
    
    /**
     * Undo the last N events
     * @param {number} count - Number of events to undo (default 1)
     * @returns {Array<Object>} Undone events
     */
    undo(count = 1) {
        const targetVersion = Math.max(0, this.version - count);
        return this.truncateTo(targetVersion);
    }
    
    /**
     * Check if undo is available
     * @returns {boolean}
     */
    canUndo() {
        return this.version > 0;
    }
    
    /**
     * Redo events from the redo buffer
     * @param {number} count - Number of events to redo (default 1)
     * @returns {Array<Object>} Redone events
     */
    redo(count = 1) {
        if (this.redoBuffer.length === 0) {
            return [];
        }
        
        // Take events from redo buffer
        const toRedo = this.redoBuffer.splice(0, count);
        
        // Re-append them (preserving original timestamps but updating versions)
        for (const event of toRedo) {
            event.version = ++this.version;
            this.events.push(event);
        }
        
        // Notify
        this.emit('redone', toRedo);
        this.emit('changed');
        
        return toRedo;
    }
    
    /**
     * Check if redo is available
     * @returns {boolean}
     */
    canRedo() {
        return this.redoBuffer.length > 0;
    }
    
    /**
     * Get info about next undo action
     * @returns {Object|null} Last event or null
     */
    peekUndo() {
        if (this.events.length === 0) return null;
        return this.events[this.events.length - 1];
    }
    
    /**
     * Get info about next redo action
     * @returns {Object|null} Next redo event or null
     */
    peekRedo() {
        if (this.redoBuffer.length === 0) return null;
        return this.redoBuffer[0];
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Snapshots & Persistence
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * Create a snapshot of current state for persistence
     * @returns {Object} Serializable snapshot
     */
    toSnapshot() {
        return {
            version: this.version,
            events: this.events.map(e => ({...e})),
            redoBuffer: this.redoBuffer.map(e => ({...e}))
        };
    }
    
    /**
     * Restore from a snapshot
     * @param {Object} snapshot - Snapshot from toSnapshot()
     */
    fromSnapshot(snapshot) {
        this.events = snapshot.events || [];
        this.version = snapshot.version || 0;
        this.redoBuffer = snapshot.redoBuffer || [];
        
        this.emit('restored', snapshot);
        this.emit('changed');
    }
    
    /**
     * Serialize events to JSON for storage
     * @returns {string} JSON string
     */
    toJSON() {
        return JSON.stringify(this.toSnapshot());
    }
    
    /**
     * Load events from JSON
     * @param {string} json - JSON string from toJSON()
     */
    fromJSON(json) {
        const snapshot = JSON.parse(json);
        this.fromSnapshot(snapshot);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Utility Methods
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * Clear all events (document cleared)
     */
    clear() {
        this.events = [];
        this.version = 0;
        this.redoBuffer = [];
        
        this.emit('cleared');
        this.emit('changed');
    }
    
    /**
     * Get current version number
     * @returns {number}
     */
    getVersion() {
        return this.version;
    }
    
    /**
     * Get total event count
     * @returns {number}
     */
    getEventCount() {
        return this.events.length;
    }
    
    /**
     * Get redo buffer size
     * @returns {number}
     */
    getRedoCount() {
        return this.redoBuffer.length;
    }
    
    /**
     * Get summary for debugging
     * @returns {Object}
     */
    getSummary() {
        const typeCounts = {};
        for (const event of this.events) {
            typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
        }
        
        return {
            version: this.version,
            eventCount: this.events.length,
            redoCount: this.redoBuffer.length,
            typeCounts
        };
    }
}

// Global event store instance (singleton)
export const eventStore = new EventStore();
