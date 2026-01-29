/**
 * Ameri-CAD CAD SYSTEM - Command History Manager
 * Implements Command Pattern for undo/redo functionality
 * 
 * Named Undo Steps: Each command has a descriptive name that shows in the UI
 * Examples: "Create Box", "Move", "Boolean Subtract", "Edit Width (20 → 30)"
 */

// THREE unused - kept for reference, transforms handle this
import { serializeMatrix4, deserializeMatrix4, applyMatrix4ToObject } from '../core/transforms.js';

/**
 * Capitalize first letter of a string
 * @param {string} str 
 * @returns {string}
 */
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Base Command class - all commands extend this
 * @abstract
 */
export class Command {
    constructor(name) {
        /** @type {string} Descriptive name for undo/redo UI */
        this.name = name;
        /** @type {number} */
        this.timestamp = Date.now();
    }
    
    /**
     * Execute the command
     * @abstract
     */
    execute() {
        throw new Error('execute() must be implemented');
    }
    
    /**
     * Undo the command
     * @abstract
     */
    undo() {
        throw new Error('undo() must be implemented');
    }
}

/**
 * Command for creating a primitive object
 */
export class CreatePrimitiveCommand extends Command {
    /**
     * @param {THREE.Scene} scene 
     * @param {THREE.Object3D[]} objectsArray Reference to System.objects
     * @param {THREE.Mesh} mesh The created mesh
     * @param {string} [primitiveType] Optional type name (box, sphere, etc.)
     */
    constructor(scene, objectsArray, mesh, primitiveType = null) {
        // Build descriptive name: "Create Box", "Create Sphere", etc.
        const type = primitiveType || mesh?.userData?.bodyType || 'Primitive';
        const displayName = `Create ${capitalize(type)}`;
        super(displayName);
        
        this.scene = scene;
        this.objectsArray = objectsArray;
        this.mesh = mesh;
        this.primitiveType = type;
        // Set to true since mesh is already in scene when command is created
        // (we use push() for already-executed operations, not execute())
        this.wasExecuted = true;
    }
    
    execute() {
        // Re-add mesh on redo (mesh was removed by undo)
        // Note: wasExecuted is true from constructor since mesh is already
        // in scene when command is created via push()
        this.scene.add(this.mesh);
        if (!this.objectsArray.includes(this.mesh)) {
            this.objectsArray.push(this.mesh);
        }
    }
    
    undo() {
        this.scene.remove(this.mesh);
        const idx = this.objectsArray.indexOf(this.mesh);
        if (idx > -1) {
            this.objectsArray.splice(idx, 1);
        }
    }
}

/**
 * Command for deleting an object
 */
export class DeleteCommand extends Command {
    /**
     * @param {THREE.Scene} scene 
     * @param {THREE.Object3D[]} objectsArray Reference to System.objects
     * @param {THREE.Object3D} object The object being deleted
     */
    constructor(scene, objectsArray, object) {
        // Build descriptive name: "Delete BODY_001" or "Delete Box"
        const objectName = object?.userData?.name || object?.name || 'Object';
        super(`Delete ${objectName}`);
        
        this.scene = scene;
        this.objectsArray = objectsArray;
        this.object = object;
        this.index = objectsArray.indexOf(object);
        this.objectName = objectName;
    }
    
    execute() {
        this.scene.remove(this.object);
        const idx = this.objectsArray.indexOf(this.object);
        if (idx > -1) {
            this.objectsArray.splice(idx, 1);
        }
    }
    
    undo() {
        this.scene.add(this.object);
        // Restore at original index if possible
        if (this.index >= 0 && this.index <= this.objectsArray.length) {
            this.objectsArray.splice(this.index, 0, this.object);
        } else {
            this.objectsArray.push(this.object);
        }
    }
}

/**
 * Command for transforming an object (move/rotate/scale)
 */
export class TransformCommand extends Command {
    /**
     * @param {THREE.Object3D} object 
     * @param {THREE.Matrix4} startMatrix Matrix before transform
     * @param {THREE.Matrix4} endMatrix Matrix after transform
     * @param {string} [transformType] Transform type: 'translate', 'rotate', 'scale'
     */
    constructor(object, startMatrix, endMatrix, transformType = null) {
        // Build descriptive name: "Move", "Rotate", "Scale"
        const typeNames = {
            'translate': 'Move',
            'move': 'Move',
            'rotate': 'Rotate',
            'scale': 'Scale'
        };
        const displayName = typeNames[transformType?.toLowerCase()] || 'Transform';
        super(displayName);
        
        this.object = object;
        this.transformType = transformType;
        this.startMatrixArray = serializeMatrix4(startMatrix);
        this.endMatrixArray = serializeMatrix4(endMatrix);
    }
    
    execute() {
        const endMatrix = deserializeMatrix4(this.endMatrixArray);
        applyMatrix4ToObject(this.object, endMatrix);
    }
    
    undo() {
        const startMatrix = deserializeMatrix4(this.startMatrixArray);
        applyMatrix4ToObject(this.object, startMatrix);
    }
}

/**
 * Command for boolean operations (union/subtract/intersect)
 */
export class BooleanCommand extends Command {
    /**
     * @param {THREE.Scene} scene 
     * @param {THREE.Object3D[]} objectsArray Reference to System.objects
     * @param {string} operation Boolean operation type: 'union', 'subtract', 'intersect'
     * @param {THREE.Mesh} resultMesh The resulting mesh after boolean
     * @param {THREE.Mesh[]} sourceMeshes The original meshes (for undo)
     */
    constructor(scene, objectsArray, operation, resultMesh, sourceMeshes) {
        // Build descriptive name: "Union", "Subtract", "Intersect"
        const operationNames = {
            'union': 'Union',
            'add': 'Union',
            'join': 'Union',
            'fuse': 'Union',
            'subtract': 'Subtract',
            'cut': 'Subtract',
            'difference': 'Subtract',
            'intersect': 'Intersect',
            'common': 'Intersect'
        };
        const displayName = `Boolean ${operationNames[operation?.toLowerCase()] || capitalize(operation)}`;
        super(displayName);
        
        this.scene = scene;
        this.objectsArray = objectsArray;
        this.operation = operation;
        this.resultMesh = resultMesh;
        this.sourceMeshes = sourceMeshes || [];
        this.sourceIndices = sourceMeshes.map(m => objectsArray.indexOf(m));
    }
    
    execute() {
        // Remove source meshes, add result
        for (const mesh of this.sourceMeshes) {
            this.scene.remove(mesh);
            const idx = this.objectsArray.indexOf(mesh);
            if (idx > -1) this.objectsArray.splice(idx, 1);
        }
        this.scene.add(this.resultMesh);
        if (!this.objectsArray.includes(this.resultMesh)) {
            this.objectsArray.push(this.resultMesh);
        }
    }
    
    undo() {
        // Remove result, restore source meshes
        this.scene.remove(this.resultMesh);
        const idx = this.objectsArray.indexOf(this.resultMesh);
        if (idx > -1) this.objectsArray.splice(idx, 1);
        
        // Restore source meshes at original indices
        for (let i = 0; i < this.sourceMeshes.length; i++) {
            this.scene.add(this.sourceMeshes[i]);
            const originalIdx = this.sourceIndices[i];
            if (originalIdx >= 0 && originalIdx <= this.objectsArray.length) {
                this.objectsArray.splice(originalIdx, 0, this.sourceMeshes[i]);
            } else {
                this.objectsArray.push(this.sourceMeshes[i]);
            }
        }
    }
}

/**
 * Command for editing a parameter value
 */
export class EditParamCommand extends Command {
    /**
     * @param {Object} feature The feature being edited
     * @param {string} paramName The parameter name being changed
     * @param {*} oldValue The value before the edit
     * @param {*} newValue The value after the edit
     * @param {Function} applyFn Function to apply the change: (feature, paramName, value) => void
     */
    constructor(feature, paramName, oldValue, newValue, applyFn) {
        // Build descriptive name: "Edit Width (20 → 30)"
        const displayName = `Edit ${capitalize(paramName)} (${oldValue} → ${newValue})`;
        super(displayName);
        
        this.feature = feature;
        this.paramName = paramName;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.applyFn = applyFn;
    }
    
    execute() {
        if (this.applyFn) {
            this.applyFn(this.feature, this.paramName, this.newValue);
        } else if (this.feature.params) {
            this.feature.params[this.paramName] = this.newValue;
        }
    }
    
    undo() {
        if (this.applyFn) {
            this.applyFn(this.feature, this.paramName, this.oldValue);
        } else if (this.feature.params) {
            this.feature.params[this.paramName] = this.oldValue;
        }
    }
}

/**
 * Command for batch parameter edits (multiple params at once)
 */
export class EditParamsCommand extends Command {
    /**
     * @param {Object} feature The feature being edited
     * @param {Object} oldParams The parameters before edit
     * @param {Object} newParams The parameters after edit
     * @param {Function} applyFn Function to apply the change: (feature, params) => void
     */
    constructor(feature, oldParams, newParams, applyFn) {
        // Build descriptive name showing changed params
        const changes = [];
        for (const key of Object.keys(newParams)) {
            if (oldParams[key] !== newParams[key]) {
                changes.push(`${capitalize(key)} (${oldParams[key]} → ${newParams[key]})`);
            }
        }
        const displayName = changes.length > 0 
            ? `Edit ${changes[0]}${changes.length > 1 ? ` +${changes.length - 1}` : ''}`
            : 'Edit Parameters';
        super(displayName);
        
        this.feature = feature;
        this.oldParams = { ...oldParams };
        this.newParams = { ...newParams };
        this.applyFn = applyFn;
    }
    
    execute() {
        if (this.applyFn) {
            this.applyFn(this.feature, this.newParams);
        } else if (this.feature.params) {
            Object.assign(this.feature.params, this.newParams);
        }
    }
    
    undo() {
        if (this.applyFn) {
            this.applyFn(this.feature, this.oldParams);
        } else if (this.feature.params) {
            Object.assign(this.feature.params, this.oldParams);
        }
    }
}

/**
 * CommandManager - Manages undo/redo stacks
 */
export class CommandManager {
    constructor(maxHistory = 50) {
        /** @type {Command[]} */
        this.undoStack = [];
        
        /** @type {Command[]} */
        this.redoStack = [];
        
        /** @type {number} */
        this.maxHistory = maxHistory;
        
        /** @type {((canUndo: boolean, canRedo: boolean) => void)[]} */
        this.onStateChangeCallbacks = [];
    }
    
    /**
     * Register a callback for state changes
     * @param {(canUndo: boolean, canRedo: boolean) => void} callback 
     */
    onStateChange(callback) {
        this.onStateChangeCallbacks.push(callback);
    }
    
    /**
     * Notify callbacks of state change
     * @private
     */
    _notifyStateChange() {
        const canUndo = this.canUndo();
        const canRedo = this.canRedo();
        this.onStateChangeCallbacks.forEach(cb => cb(canUndo, canRedo));
    }
    
    /**
     * Execute a command and add to history
     * @param {Command} command 
     */
    execute(command) {
        command.execute();
        this.undoStack.push(command);
        
        // Clear redo stack on new action
        this.redoStack = [];
        
        // Enforce max history
        while (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        
        this._notifyStateChange();
    }
    
    /**
     * Add a command to history without executing it
     * (for commands that have already been executed)
     * @param {Command} command 
     */
    push(command) {
        this.undoStack.push(command);
        this.redoStack = [];
        
        while (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        
        this._notifyStateChange();
    }
    
    /**
     * Undo the last command
     * @returns {Command | null} The undone command or null
     */
    undo() {
        if (!this.canUndo()) return null;
        
        const command = this.undoStack.pop();
        command.undo();
        this.redoStack.push(command);
        
        this._notifyStateChange();
        return command;
    }
    
    /**
     * Redo the last undone command
     * @returns {Command | null} The redone command or null
     */
    redo() {
        if (!this.canRedo()) return null;
        
        const command = this.redoStack.pop();
        command.execute();
        this.undoStack.push(command);
        
        this._notifyStateChange();
        return command;
    }
    
    /**
     * Check if undo is available
     * @returns {boolean}
     */
    canUndo() {
        return this.undoStack.length > 0;
    }
    
    /**
     * Check if redo is available
     * @returns {boolean}
     */
    canRedo() {
        return this.redoStack.length > 0;
    }
    
    /**
     * Clear all history
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this._notifyStateChange();
    }
    
    /**
     * Get history summary for debugging
     * @returns {object}
     */
    getHistorySummary() {
        return {
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length,
            undoCommands: this.undoStack.map(c => c.name),
            redoCommands: this.redoStack.map(c => c.name)
        };
    }
    
    /**
     * Get the name of the next action that would be undone
     * @returns {string|null} Command name or null if nothing to undo
     */
    getUndoName() {
        if (this.undoStack.length === 0) return null;
        return this.undoStack[this.undoStack.length - 1].name;
    }
    
    /**
     * Get the name of the next action that would be redone
     * @returns {string|null} Command name or null if nothing to redo
     */
    getRedoName() {
        if (this.redoStack.length === 0) return null;
        return this.redoStack[this.redoStack.length - 1].name;
    }
    
    /**
     * Get full undo history for display in history panel
     * @param {number} limit Max items to return
     * @returns {Array<{name: string, timestamp: number, index: number}>}
     */
    getUndoHistory(limit = 50) {
        const history = [];
        const startIdx = Math.max(0, this.undoStack.length - limit);
        
        for (let i = this.undoStack.length - 1; i >= startIdx; i--) {
            const cmd = this.undoStack[i];
            history.push({
                name: cmd.name,
                timestamp: cmd.timestamp,
                index: i
            });
        }
        
        return history;
    }
    
    /**
     * Undo to a specific point in history
     * @param {number} targetIndex Index in undoStack to undo to (exclusive)
     * @returns {Command[]} Array of undone commands
     */
    undoTo(targetIndex) {
        const undone = [];
        while (this.undoStack.length > targetIndex && this.canUndo()) {
            const cmd = this.undo();
            if (cmd) undone.push(cmd);
        }
        return undone;
    }
}

// Export singleton instance
export const commandManager = new CommandManager();
