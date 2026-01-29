/**
 * Ameri-CAD History (Undo/Redo) Tests
 * Tests for command history from src/state/history.js
 * and crash recovery from src/crash-guard.js
 */

import {
    Command,
    CommandManager,
    CreatePrimitiveCommand,
    DeleteCommand,
    TransformCommand,
    commandManager
} from '../src/state/history.js';

import { CrashGuard } from '../src/crash-guard.js';

// Export for runner compatibility
window.CommandManager = CommandManager;
window.Command = Command;
window.CreatePrimitiveCommand = CreatePrimitiveCommand;
window.DeleteCommand = DeleteCommand;
window.TransformCommand = TransformCommand;

describe('Command (base class)', function() {
    
    it('should require name in constructor', function() {
        const cmd = new Command('Test Command');
        expect(cmd.name).to.equal('Test Command');
    });
    
    it('should have timestamp', function() {
        const before = Date.now();
        const cmd = new Command('Test');
        const after = Date.now();
        
        expect(cmd.timestamp).to.be.at.least(before);
        expect(cmd.timestamp).to.be.at.most(after);
    });
    
    it('should throw on execute() if not implemented', function() {
        const cmd = new Command('Test');
        expect(() => cmd.execute()).to.throw('execute() must be implemented');
    });
    
    it('should throw on undo() if not implemented', function() {
        const cmd = new Command('Test');
        expect(() => cmd.undo()).to.throw('undo() must be implemented');
    });
});

describe('CommandManager', function() {
    let manager;
    
    beforeEach(function() {
        manager = new CommandManager();
    });
    
    describe('Basic Operations', function() {
        
        it('should start empty', function() {
            expect(manager.canUndo()).to.be.false;
            expect(manager.canRedo()).to.be.false;
        });
        
        it('should execute and store commands', function() {
            let executed = false;
            const command = {
                name: 'Test',
                execute: () => { executed = true; },
                undo: () => {}
            };
            
            manager.execute(command);
            
            expect(executed).to.be.true;
            expect(manager.canUndo()).to.be.true;
        });
        
        it('should undo commands', function() {
            let value = 0;
            const command = {
                name: 'Increment',
                execute: () => { value++; },
                undo: () => { value--; }
            };
            
            manager.execute(command);
            expect(value).to.equal(1);
            
            manager.undo();
            expect(value).to.equal(0);
        });
        
        it('should redo commands', function() {
            let value = 0;
            const command = {
                name: 'Increment',
                execute: () => { value++; },
                undo: () => { value--; }
            };
            
            manager.execute(command);
            manager.undo();
            expect(value).to.equal(0);
            
            manager.redo();
            expect(value).to.equal(1);
        });
        
        it('should clear redo stack on new command', function() {
            const cmd1 = { name: 'A', execute: () => {}, undo: () => {} };
            const cmd2 = { name: 'B', execute: () => {}, undo: () => {} };
            
            manager.execute(cmd1);
            manager.undo();
            expect(manager.canRedo()).to.be.true;
            
            manager.execute(cmd2);
            expect(manager.canRedo()).to.be.false;
        });
        
        it('should return null when undoing empty stack', function() {
            const result = manager.undo();
            expect(result).to.be.null;
        });
        
        it('should return null when redoing empty stack', function() {
            const result = manager.redo();
            expect(result).to.be.null;
        });
    });
    
    describe('push() vs execute()', function() {
        
        it('should add command without executing via push()', function() {
            let executed = false;
            const command = {
                name: 'Test',
                execute: () => { executed = true; },
                undo: () => {}
            };
            
            manager.push(command);
            
            expect(executed).to.be.false;
            expect(manager.canUndo()).to.be.true;
        });
    });
    
    describe('History Limits', function() {
        
        it('should limit history to maxHistory', function() {
            const limitedManager = new CommandManager(5);
            
            for (let i = 0; i < 10; i++) {
                limitedManager.execute({
                    name: 'Test',
                    index: i,
                    execute: () => {},
                    undo: () => {}
                });
            }
            
            expect(limitedManager.undoStack.length).to.equal(5);
        });
        
        it('should keep most recent commands when trimming', function() {
            const limitedManager = new CommandManager(3);
            
            for (let i = 0; i < 5; i++) {
                limitedManager.execute({
                    name: 'Test',
                    index: i,
                    execute: () => {},
                    undo: () => {}
                });
            }
            
            const stored = limitedManager.undoStack;
            expect(stored[0].index).to.equal(2);
            expect(stored[1].index).to.equal(3);
            expect(stored[2].index).to.equal(4);
        });
    });
    
    describe('State Change Callbacks', function() {
        
        it('should notify on state change', function() {
            let callCount = 0;
            let lastCanUndo, lastCanRedo;
            
            manager.onStateChange((canUndo, canRedo) => {
                callCount++;
                lastCanUndo = canUndo;
                lastCanRedo = canRedo;
            });
            
            manager.execute({ name: 'Test', execute: () => {}, undo: () => {} });
            
            expect(callCount).to.equal(1);
            expect(lastCanUndo).to.be.true;
            expect(lastCanRedo).to.be.false;
        });
    });
    
    describe('clear()', function() {
        
        it('should clear all history', function() {
            manager.execute({ name: 'A', execute: () => {}, undo: () => {} });
            manager.execute({ name: 'B', execute: () => {}, undo: () => {} });
            manager.undo();
            
            expect(manager.canUndo()).to.be.true;
            expect(manager.canRedo()).to.be.true;
            
            manager.clear();
            
            expect(manager.canUndo()).to.be.false;
            expect(manager.canRedo()).to.be.false;
        });
    });
    
    describe('getHistorySummary()', function() {
        
        it('should return history summary', function() {
            manager.execute({ name: 'Create', execute: () => {}, undo: () => {} });
            manager.execute({ name: 'Transform', execute: () => {}, undo: () => {} });
            manager.undo();
            
            const summary = manager.getHistorySummary();
            
            expect(summary.undoCount).to.equal(1);
            expect(summary.redoCount).to.equal(1);
            expect(summary.undoCommands).to.include('Create');
            expect(summary.redoCommands).to.include('Transform');
        });
    });
});

describe('CreatePrimitiveCommand', function() {
    let scene, objectsArray;
    
    beforeEach(function() {
        scene = new THREE.Scene();
        objectsArray = [];
    });
    
    it('should not re-add mesh on first execute (already in scene)', function() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const mesh = new THREE.Mesh(geometry);
        scene.add(mesh);
        objectsArray.push(mesh);
        
        const cmd = new CreatePrimitiveCommand(scene, objectsArray, mesh);
        cmd.execute(); // First execute - should do nothing (mesh already added)
        
        expect(scene.children).to.have.length(1);
    });
    
    it('should remove mesh on undo', function() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const mesh = new THREE.Mesh(geometry);
        scene.add(mesh);
        objectsArray.push(mesh);
        
        const cmd = new CreatePrimitiveCommand(scene, objectsArray, mesh);
        cmd.execute();
        
        cmd.undo();
        
        expect(scene.children).to.have.length(0);
        expect(objectsArray).to.have.length(0);
    });
    
    it('should re-add mesh on redo', function() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const mesh = new THREE.Mesh(geometry);
        scene.add(mesh);
        objectsArray.push(mesh);
        
        const cmd = new CreatePrimitiveCommand(scene, objectsArray, mesh);
        cmd.execute();
        cmd.undo();
        cmd.execute(); // Redo
        
        expect(scene.children).to.have.length(1);
        expect(objectsArray).to.have.length(1);
    });
    
    it('should have correct name', function() {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
        const cmd = new CreatePrimitiveCommand(scene, objectsArray, mesh);
        expect(cmd.name).to.equal('Create Primitive');
    });
});

describe('DeleteCommand', function() {
    let scene, objectsArray, mesh;
    
    beforeEach(function() {
        scene = new THREE.Scene();
        objectsArray = [];
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        mesh = new THREE.Mesh(geometry);
        scene.add(mesh);
        objectsArray.push(mesh);
    });
    
    it('should remove mesh from scene', function() {
        expect(scene.children).to.include(mesh);
        
        const cmd = new DeleteCommand(scene, objectsArray, mesh);
        cmd.execute();
        
        expect(scene.children).to.not.include(mesh);
        expect(objectsArray).to.not.include(mesh);
    });
    
    it('should restore mesh on undo', function() {
        const cmd = new DeleteCommand(scene, objectsArray, mesh);
        cmd.execute();
        cmd.undo();
        
        expect(scene.children).to.include(mesh);
        expect(objectsArray).to.include(mesh);
    });
    
    it('should preserve original index on undo', function() {
        // Add more objects
        const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
        const mesh3 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
        scene.add(mesh2);
        scene.add(mesh3);
        objectsArray.push(mesh2);
        objectsArray.push(mesh3);
        
        // Delete first mesh
        const cmd = new DeleteCommand(scene, objectsArray, mesh);
        cmd.execute();
        cmd.undo();
        
        // Should be restored at index 0
        expect(objectsArray[0]).to.equal(mesh);
    });
});

describe('TransformCommand', function() {
    let mesh;
    
    beforeEach(function() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        mesh = new THREE.Mesh(geometry);
        mesh.updateMatrixWorld();
    });
    
    it('should apply end matrix on execute', function() {
        const startMatrix = mesh.matrix.clone();
        const endMatrix = new THREE.Matrix4().makeTranslation(10, 20, 30);
        
        const cmd = new TransformCommand(mesh, startMatrix, endMatrix);
        cmd.execute();
        
        expect(mesh.position.x).to.be.closeTo(10, 0.001);
        expect(mesh.position.y).to.be.closeTo(20, 0.001);
        expect(mesh.position.z).to.be.closeTo(30, 0.001);
    });
    
    it('should restore start matrix on undo', function() {
        mesh.position.set(0, 0, 0);
        mesh.updateMatrix();
        const startMatrix = mesh.matrix.clone();
        const endMatrix = new THREE.Matrix4().makeTranslation(100, 200, 300);
        
        const cmd = new TransformCommand(mesh, startMatrix, endMatrix);
        cmd.execute();
        cmd.undo();
        
        expect(mesh.position.x).to.be.closeTo(0, 0.001);
        expect(mesh.position.y).to.be.closeTo(0, 0.001);
        expect(mesh.position.z).to.be.closeTo(0, 0.001);
    });
});

describe('Undo/Redo Integration', function() {
    let manager, scene, objectsArray;
    
    beforeEach(function() {
        manager = new CommandManager();
        scene = new THREE.Scene();
        objectsArray = [];
    });
    
    it('should handle complex undo/redo sequence', function() {
        // Create a box
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const mesh = new THREE.Mesh(geometry);
        scene.add(mesh);
        objectsArray.push(mesh);
        
        const createCmd = new CreatePrimitiveCommand(scene, objectsArray, mesh);
        manager.push(createCmd); // Use push since mesh already added
        
        expect(scene.children).to.have.length(1);
        
        // Transform it
        mesh.position.set(0, 0, 0);
        mesh.updateMatrix();
        const startMatrix = mesh.matrix.clone();
        const endMatrix = new THREE.Matrix4().makeTranslation(10, 0, 0);
        
        const transformCmd = new TransformCommand(mesh, startMatrix, endMatrix);
        manager.execute(transformCmd);
        
        expect(mesh.position.x).to.be.closeTo(10, 0.001);
        
        // Undo transform
        manager.undo();
        expect(mesh.position.x).to.be.closeTo(0, 0.001);
        
        // Redo transform
        manager.redo();
        expect(mesh.position.x).to.be.closeTo(10, 0.001);
        
        // Undo transform again
        manager.undo();
        
        // Undo create
        manager.undo();
        expect(scene.children).to.have.length(0);
        
        // Redo create
        manager.redo();
        expect(scene.children).to.have.length(1);
    });
    
    it('should track multiple objects independently', function() {
        // Create first mesh
        const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
        scene.add(mesh1);
        objectsArray.push(mesh1);
        const cmd1 = new CreatePrimitiveCommand(scene, objectsArray, mesh1);
        manager.push(cmd1);
        
        // Create second mesh
        const mesh2 = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8));
        scene.add(mesh2);
        objectsArray.push(mesh2);
        const cmd2 = new CreatePrimitiveCommand(scene, objectsArray, mesh2);
        manager.push(cmd2);
        
        expect(scene.children).to.have.length(2);
        
        manager.undo(); // Undo mesh2
        expect(scene.children).to.have.length(1);
        expect(scene.children[0]).to.equal(mesh1);
        
        manager.undo(); // Undo mesh1
        expect(scene.children).to.have.length(0);
    });
});

describe('CrashGuard', function() {
    
    // Mock localStorage for testing
    let mockStorage = {};
    
    beforeEach(function() {
        mockStorage = {};
        
        // Mock localStorage
        if (typeof window !== 'undefined') {
            window._realLocalStorage = window.localStorage;
            Object.defineProperty(window, 'localStorage', {
                value: {
                    getItem: (key) => mockStorage[key] || null,
                    setItem: (key, value) => { mockStorage[key] = value; },
                    removeItem: (key) => { delete mockStorage[key]; },
                    clear: () => { mockStorage = {}; }
                },
                writable: true
            });
        }
        
        // Reset CrashGuard state
        CrashGuard.commands = [];
        CrashGuard.intervalId = null;
    });
    
    afterEach(function() {
        if (typeof window !== 'undefined' && window._realLocalStorage) {
            Object.defineProperty(window, 'localStorage', {
                value: window._realLocalStorage,
                writable: true
            });
        }
        CrashGuard.stopAutosave();
    });
    
    it('should save commands to localStorage', function() {
        CrashGuard.recordCommand({ type: 'CREATE', data: { shape: 'box' } });
        CrashGuard.recordCommand({ type: 'MOVE', data: { x: 10 } });
        CrashGuard.saveToStorage();
        
        const data = JSON.parse(mockStorage[CrashGuard.KEY]);
        
        expect(data.commands).to.have.length(2);
        expect(data.commands[0].type).to.equal('CREATE');
        expect(data.commands[1].type).to.equal('MOVE');
    });
    
    it('should limit stored commands to MAX_COMMANDS', function() {
        const originalMax = CrashGuard.MAX_COMMANDS;
        CrashGuard.MAX_COMMANDS = 5;
        
        for (let i = 0; i < 10; i++) {
            CrashGuard.recordCommand({ type: 'CMD', data: { index: i } });
        }
        
        expect(CrashGuard.commands).to.have.length(5);
        expect(CrashGuard.commands[0].data.index).to.equal(5);
        expect(CrashGuard.commands[4].data.index).to.equal(9);
        
        CrashGuard.MAX_COMMANDS = originalMax;
    });
    
    it('should detect recovery data presence', function() {
        expect(CrashGuard.hasRecoveryData()).to.be.false;
        
        CrashGuard.recordCommand({ type: 'TEST', data: {} });
        CrashGuard.saveToStorage();
        
        expect(CrashGuard.hasRecoveryData()).to.be.true;
    });
    
    it('should clear recovery data', function() {
        CrashGuard.recordCommand({ type: 'TEST', data: {} });
        CrashGuard.saveToStorage();
        expect(CrashGuard.hasRecoveryData()).to.be.true;
        
        CrashGuard.clear();
        expect(CrashGuard.hasRecoveryData()).to.be.false;
        expect(CrashGuard.commands).to.have.length(0);
    });
    
    it('should get recovery data', function() {
        CrashGuard.recordCommand({ type: 'CREATE_PRIMITIVE', data: { shape: 'box' } });
        CrashGuard.saveToStorage();
        
        const data = CrashGuard.getRecoveryData();
        expect(data).to.have.length(1);
        expect(data[0].type).to.equal('CREATE_PRIMITIVE');
    });
    
    it('should generate recovery summary', function() {
        CrashGuard.recordCommand({ type: 'CREATE_PRIMITIVE', data: {} });
        CrashGuard.recordCommand({ type: 'TRANSFORM', data: {} });
        CrashGuard.recordCommand({ type: 'CREATE_PRIMITIVE', data: {} });
        CrashGuard.saveToStorage();
        
        const summary = CrashGuard.getRecoverySummary();
        
        expect(summary.commandCount).to.equal(3);
        expect(summary.types['CREATE_PRIMITIVE']).to.equal(2);
        expect(summary.types['TRANSFORM']).to.equal(1);
    });
    
    it('should identify critical types for immediate save', function() {
        expect(CrashGuard.shouldImmediateSave('CREATE_PRIMITIVE')).to.be.true;
        expect(CrashGuard.shouldImmediateSave('DELETE')).to.be.true;
        expect(CrashGuard.shouldImmediateSave('IMPORT')).to.be.true;
        expect(CrashGuard.shouldImmediateSave('BOOLEAN_OP')).to.be.true;
        expect(CrashGuard.shouldImmediateSave('TRANSFORM')).to.be.false;
    });
    
    it('should generate unique IDs', function() {
        const id1 = CrashGuard.generateId();
        const id2 = CrashGuard.generateId();
        
        expect(id1).to.be.a('string');
        expect(id2).to.be.a('string');
        expect(id1).to.not.equal(id2);
    });
});

describe('Singleton commandManager', function() {
    
    it('should be exported and available', function() {
        expect(commandManager).to.be.instanceOf(CommandManager);
    });
    
    it('should be a singleton instance', function() {
        const before = commandManager.undoStack.length;
        commandManager.execute({ name: 'Test', execute: () => {}, undo: () => {} });
        expect(commandManager.undoStack.length).to.equal(before + 1);
        
        // Clean up
        commandManager.clear();
    });
});
