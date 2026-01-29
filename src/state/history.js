/**
 * Ameri-CAD CAD SYSTEM - Command History Manager
 * Implements Command Pattern for undo/redo functionality
 */

import * as THREE from 'three';
import { serializeMatrix4, deserializeMatrix4, applyMatrix4ToObject } from '../core/transforms.js';

/**
 * Base Command class - all commands extend this
 * @abstract
 */
export class Command {
    constructor(name) {
        /** @type {string} */
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
     */
    constructor(scene, objectsArray, mesh) {
        super('Create Primitive');
        this.scene = scene;
        this.objectsArray = objectsArray;
        this.mesh = mesh;
        this.wasExecuted = false;
    }
    
    execute() {
        if (!this.wasExecuted) {
            // First execution - mesh already in scene
            this.wasExecuted = true;
            return;
        }
        // Re-add on redo
        this.scene.add(this.mesh);
        this.objectsArray.push(this.mesh);
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
        super('Delete');
        this.scene = scene;
        this.objectsArray = objectsArray;
        this.object = object;
        this.index = objectsArray.indexOf(object);
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
     */
    constructor(object, startMatrix, endMatrix) {
        super('Transform');
        this.object = object;
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
}

// Export singleton instance
export const commandManager = new CommandManager();
