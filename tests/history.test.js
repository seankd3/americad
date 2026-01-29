/**
 * AMERICA-D History (Undo/Redo) Tests
 * Tests for command history and crash recovery
 */

// Mock history system for testing
class CommandHistory {
    constructor(maxCommands = 50) {
        this.history = [];
        this.redoStack = [];
        this.maxCommands = maxCommands;
    }
    
    execute(command) {
        // Execute the command
        if (command.execute) {
            command.execute();
        }
        
        // Add to history
        this.history.push(command);
        
        // Clear redo stack
        this.redoStack = [];
        
        // Trim history if needed
        if (this.history.length > this.maxCommands) {
            this.history.shift();
        }
        
        return command;
    }
    
    undo() {
        if (this.history.length === 0) return null;
        
        const command = this.history.pop();
        if (command.undo) {
            command.undo();
        }
        this.redoStack.push(command);
        
        return command;
    }
    
    redo() {
        if (this.redoStack.length === 0) return null;
        
        const command = this.redoStack.pop();
        if (command.execute) {
            command.execute();
        }
        this.history.push(command);
        
        return command;
    }
    
    clear() {
        this.history = [];
        this.redoStack = [];
    }
    
    canUndo() {
        return this.history.length > 0;
    }
    
    canRedo() {
        return this.redoStack.length > 0;
    }
    
    getHistory() {
        return [...this.history];
    }
    
    serialize() {
        return JSON.stringify(this.history.map(cmd => ({
            type: cmd.type,
            data: cmd.data,
            timestamp: cmd.timestamp
        })));
    }
}

// Command factory
class CreatePrimitiveCommand {
    constructor(type, options, scene) {
        this.type = 'CREATE_PRIMITIVE';
        this.primitiveType = type;
        this.options = options;
        this.scene = scene;
        this.mesh = null;
        this.timestamp = Date.now();
        this.data = { primitiveType: type, options };
    }
    
    execute() {
        let geometry;
        switch (this.primitiveType) {
            case 'box':
                const size = this.options.size || [1, 1, 1];
                geometry = new THREE.BoxGeometry(...size);
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(this.options.radius || 1, 32, 16);
                break;
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(
                    this.options.radius || 1,
                    this.options.radius || 1,
                    this.options.height || 2,
                    32
                );
                break;
            default:
                geometry = new THREE.BoxGeometry(1, 1, 1);
        }
        
        const material = new THREE.MeshStandardMaterial({ color: 0x808080 });
        this.mesh = new THREE.Mesh(geometry, material);
        
        if (this.options.position) {
            this.mesh.position.set(...this.options.position);
        }
        
        if (this.scene) {
            this.scene.add(this.mesh);
        }
        
        return this.mesh;
    }
    
    undo() {
        if (this.mesh && this.scene) {
            this.scene.remove(this.mesh);
        }
    }
}

class TransformCommand {
    constructor(mesh, property, oldValue, newValue) {
        this.type = 'TRANSFORM';
        this.mesh = mesh;
        this.property = property;
        this.oldValue = oldValue.clone ? oldValue.clone() : { ...oldValue };
        this.newValue = newValue.clone ? newValue.clone() : { ...newValue };
        this.timestamp = Date.now();
        this.data = { property, oldValue: this.oldValue, newValue: this.newValue };
    }
    
    execute() {
        if (this.mesh && this.mesh[this.property]) {
            if (this.mesh[this.property].copy) {
                this.mesh[this.property].copy(this.newValue);
            } else {
                this.mesh[this.property] = this.newValue;
            }
        }
    }
    
    undo() {
        if (this.mesh && this.mesh[this.property]) {
            if (this.mesh[this.property].copy) {
                this.mesh[this.property].copy(this.oldValue);
            } else {
                this.mesh[this.property] = this.oldValue;
            }
        }
    }
}

class DeleteCommand {
    constructor(mesh, scene) {
        this.type = 'DELETE';
        this.mesh = mesh;
        this.scene = scene;
        this.timestamp = Date.now();
        this.data = { meshId: mesh.uuid };
    }
    
    execute() {
        if (this.mesh && this.scene) {
            this.scene.remove(this.mesh);
        }
    }
    
    undo() {
        if (this.mesh && this.scene) {
            this.scene.add(this.mesh);
        }
    }
}

// Export for tests
window.CommandHistory = CommandHistory;
window.CreatePrimitiveCommand = CreatePrimitiveCommand;
window.TransformCommand = TransformCommand;
window.DeleteCommand = DeleteCommand;


describe('CommandHistory', function() {
    let history;
    
    beforeEach(function() {
        history = new CommandHistory();
    });
    
    describe('Basic Operations', function() {
        
        it('should start empty', function() {
            expect(history.canUndo()).to.be.false;
            expect(history.canRedo()).to.be.false;
            expect(history.getHistory()).to.have.length(0);
        });
        
        it('should execute and store commands', function() {
            const command = {
                type: 'TEST',
                execute: () => {},
                undo: () => {}
            };
            
            history.execute(command);
            
            expect(history.canUndo()).to.be.true;
            expect(history.getHistory()).to.have.length(1);
        });
        
        it('should undo commands', function() {
            let value = 0;
            const command = {
                type: 'INCREMENT',
                execute: () => { value++; },
                undo: () => { value--; }
            };
            
            history.execute(command);
            expect(value).to.equal(1);
            
            history.undo();
            expect(value).to.equal(0);
        });
        
        it('should redo commands', function() {
            let value = 0;
            const command = {
                type: 'INCREMENT',
                execute: () => { value++; },
                undo: () => { value--; }
            };
            
            history.execute(command);
            history.undo();
            expect(value).to.equal(0);
            
            history.redo();
            expect(value).to.equal(1);
        });
        
        it('should clear redo stack on new command', function() {
            const cmd1 = { type: 'A', execute: () => {}, undo: () => {} };
            const cmd2 = { type: 'B', execute: () => {}, undo: () => {} };
            
            history.execute(cmd1);
            history.undo();
            expect(history.canRedo()).to.be.true;
            
            history.execute(cmd2);
            expect(history.canRedo()).to.be.false;
        });
    });
    
    describe('History Limits', function() {
        
        it('should limit history to maxCommands', function() {
            const limitedHistory = new CommandHistory(5);
            
            for (let i = 0; i < 10; i++) {
                limitedHistory.execute({
                    type: 'TEST',
                    index: i,
                    execute: () => {},
                    undo: () => {}
                });
            }
            
            expect(limitedHistory.getHistory()).to.have.length(5);
        });
        
        it('should keep most recent commands when trimming', function() {
            const limitedHistory = new CommandHistory(3);
            
            for (let i = 0; i < 5; i++) {
                limitedHistory.execute({
                    type: 'TEST',
                    index: i,
                    execute: () => {},
                    undo: () => {}
                });
            }
            
            const stored = limitedHistory.getHistory();
            expect(stored[0].index).to.equal(2);
            expect(stored[1].index).to.equal(3);
            expect(stored[2].index).to.equal(4);
        });
    });
    
    describe('Serialization', function() {
        
        it('should serialize history to JSON', function() {
            history.execute({
                type: 'CREATE',
                data: { shape: 'box' },
                timestamp: 12345,
                execute: () => {},
                undo: () => {}
            });
            
            const json = history.serialize();
            const parsed = JSON.parse(json);
            
            expect(parsed).to.have.length(1);
            expect(parsed[0].type).to.equal('CREATE');
            expect(parsed[0].data.shape).to.equal('box');
        });
    });
});

describe('CreatePrimitiveCommand', function() {
    let scene;
    
    beforeEach(function() {
        scene = new THREE.Scene();
    });
    
    it('should create box primitive', function() {
        const cmd = new CreatePrimitiveCommand('box', { size: [2, 3, 4] }, scene);
        const mesh = cmd.execute();
        
        expect(mesh).to.exist;
        expect(scene.children).to.include(mesh);
        
        mesh.geometry.computeBoundingBox();
        const size = new THREE.Vector3();
        mesh.geometry.boundingBox.getSize(size);
        
        expect(size.x).to.equal(2);
        expect(size.y).to.equal(3);
        expect(size.z).to.equal(4);
    });
    
    it('should undo creation by removing from scene', function() {
        const cmd = new CreatePrimitiveCommand('box', {}, scene);
        cmd.execute();
        
        expect(scene.children).to.have.length(1);
        
        cmd.undo();
        
        expect(scene.children).to.have.length(0);
    });
    
    it('should apply position from options', function() {
        const cmd = new CreatePrimitiveCommand('sphere', {
            radius: 1,
            position: [10, 20, 30]
        }, scene);
        
        const mesh = cmd.execute();
        
        expect(mesh.position.x).to.equal(10);
        expect(mesh.position.y).to.equal(20);
        expect(mesh.position.z).to.equal(30);
    });
    
    it('should store command metadata', function() {
        const cmd = new CreatePrimitiveCommand('cylinder', { radius: 5, height: 10 }, scene);
        
        expect(cmd.type).to.equal('CREATE_PRIMITIVE');
        expect(cmd.data.primitiveType).to.equal('cylinder');
        expect(cmd.timestamp).to.be.a('number');
    });
});

describe('TransformCommand', function() {
    let mesh;
    
    beforeEach(function() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        mesh = new THREE.Mesh(geometry);
    });
    
    it('should transform position', function() {
        const oldPos = mesh.position.clone();
        const newPos = new THREE.Vector3(5, 10, 15);
        
        const cmd = new TransformCommand(mesh, 'position', oldPos, newPos);
        cmd.execute();
        
        expect(mesh.position.x).to.equal(5);
        expect(mesh.position.y).to.equal(10);
        expect(mesh.position.z).to.equal(15);
    });
    
    it('should undo position change', function() {
        mesh.position.set(0, 0, 0);
        const oldPos = mesh.position.clone();
        const newPos = new THREE.Vector3(100, 200, 300);
        
        const cmd = new TransformCommand(mesh, 'position', oldPos, newPos);
        cmd.execute();
        cmd.undo();
        
        expect(mesh.position.x).to.equal(0);
        expect(mesh.position.y).to.equal(0);
        expect(mesh.position.z).to.equal(0);
    });
    
    it('should transform scale', function() {
        const oldScale = mesh.scale.clone();
        const newScale = new THREE.Vector3(2, 3, 4);
        
        const cmd = new TransformCommand(mesh, 'scale', oldScale, newScale);
        cmd.execute();
        
        expect(mesh.scale.x).to.equal(2);
        expect(mesh.scale.y).to.equal(3);
        expect(mesh.scale.z).to.equal(4);
    });
});

describe('DeleteCommand', function() {
    let scene, mesh;
    
    beforeEach(function() {
        scene = new THREE.Scene();
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        mesh = new THREE.Mesh(geometry);
        scene.add(mesh);
    });
    
    it('should remove mesh from scene', function() {
        expect(scene.children).to.include(mesh);
        
        const cmd = new DeleteCommand(mesh, scene);
        cmd.execute();
        
        expect(scene.children).to.not.include(mesh);
    });
    
    it('should restore mesh on undo', function() {
        const cmd = new DeleteCommand(mesh, scene);
        cmd.execute();
        cmd.undo();
        
        expect(scene.children).to.include(mesh);
    });
});

describe('Undo/Redo Integration', function() {
    let history, scene;
    
    beforeEach(function() {
        history = new CommandHistory();
        scene = new THREE.Scene();
    });
    
    it('should handle complex undo/redo sequence', function() {
        // Create a box
        const createCmd = new CreatePrimitiveCommand('box', { size: [1, 1, 1] }, scene);
        history.execute(createCmd);
        const mesh = createCmd.mesh;
        
        expect(scene.children).to.have.length(1);
        
        // Move it
        const moveCmd = new TransformCommand(
            mesh, 'position',
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(10, 0, 0)
        );
        history.execute(moveCmd);
        
        expect(mesh.position.x).to.equal(10);
        
        // Scale it
        const scaleCmd = new TransformCommand(
            mesh, 'scale',
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(2, 2, 2)
        );
        history.execute(scaleCmd);
        
        expect(mesh.scale.x).to.equal(2);
        
        // Undo scale
        history.undo();
        expect(mesh.scale.x).to.equal(1);
        
        // Undo move
        history.undo();
        expect(mesh.position.x).to.equal(0);
        
        // Redo move
        history.redo();
        expect(mesh.position.x).to.equal(10);
        
        // Undo move again
        history.undo();
        
        // Undo create
        history.undo();
        expect(scene.children).to.have.length(0);
        
        // Redo create
        history.redo();
        expect(scene.children).to.have.length(1);
    });
    
    it('should track multiple objects independently', function() {
        const cmd1 = new CreatePrimitiveCommand('box', { position: [0, 0, 0] }, scene);
        const cmd2 = new CreatePrimitiveCommand('sphere', { position: [10, 0, 0] }, scene);
        
        history.execute(cmd1);
        history.execute(cmd2);
        
        expect(scene.children).to.have.length(2);
        
        history.undo();
        expect(scene.children).to.have.length(1);
        expect(scene.children[0]).to.equal(cmd1.mesh);
        
        history.undo();
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
    });
    
    afterEach(function() {
        if (typeof window !== 'undefined' && window._realLocalStorage) {
            Object.defineProperty(window, 'localStorage', {
                value: window._realLocalStorage,
                writable: true
            });
        }
    });
    
    it('should save commands to localStorage', function() {
        const CrashGuard = {
            KEY: 'americad_crash_recovery',
            MAX_COMMANDS: 50,
            commands: [],
            
            saveCommand(cmd) {
                this.commands.push({
                    type: cmd.type,
                    data: cmd.data,
                    timestamp: cmd.timestamp || Date.now()
                });
                
                if (this.commands.length > this.MAX_COMMANDS) {
                    this.commands.shift();
                }
                
                localStorage.setItem(this.KEY, JSON.stringify(this.commands));
            },
            
            load() {
                const data = localStorage.getItem(this.KEY);
                return data ? JSON.parse(data) : [];
            },
            
            clear() {
                this.commands = [];
                localStorage.removeItem(this.KEY);
            },
            
            hasRecoveryData() {
                return localStorage.getItem(this.KEY) !== null;
            }
        };
        
        CrashGuard.saveCommand({ type: 'CREATE', data: { shape: 'box' }, timestamp: 1000 });
        CrashGuard.saveCommand({ type: 'MOVE', data: { x: 10 }, timestamp: 2000 });
        
        const loaded = CrashGuard.load();
        
        expect(loaded).to.have.length(2);
        expect(loaded[0].type).to.equal('CREATE');
        expect(loaded[1].type).to.equal('MOVE');
    });
    
    it('should limit stored commands to MAX_COMMANDS', function() {
        const CrashGuard = {
            KEY: 'americad_crash_recovery',
            MAX_COMMANDS: 5,
            commands: [],
            
            saveCommand(cmd) {
                this.commands.push({
                    type: cmd.type,
                    data: cmd.data,
                    timestamp: cmd.timestamp || Date.now()
                });
                
                if (this.commands.length > this.MAX_COMMANDS) {
                    this.commands.shift();
                }
                
                localStorage.setItem(this.KEY, JSON.stringify(this.commands));
            },
            
            load() {
                const data = localStorage.getItem(this.KEY);
                return data ? JSON.parse(data) : [];
            }
        };
        
        for (let i = 0; i < 10; i++) {
            CrashGuard.saveCommand({ type: 'CMD', data: { index: i }, timestamp: i });
        }
        
        const loaded = CrashGuard.load();
        
        expect(loaded).to.have.length(5);
        expect(loaded[0].data.index).to.equal(5);
        expect(loaded[4].data.index).to.equal(9);
    });
    
    it('should detect recovery data on load', function() {
        const CrashGuard = {
            KEY: 'americad_crash_recovery',
            
            hasRecoveryData() {
                return localStorage.getItem(this.KEY) !== null;
            }
        };
        
        expect(CrashGuard.hasRecoveryData()).to.be.false;
        
        localStorage.setItem('americad_crash_recovery', '[{"type":"TEST"}]');
        
        expect(CrashGuard.hasRecoveryData()).to.be.true;
    });
    
    it('should clear recovery data', function() {
        const CrashGuard = {
            KEY: 'americad_crash_recovery',
            commands: [],
            
            clear() {
                this.commands = [];
                localStorage.removeItem(this.KEY);
            },
            
            hasRecoveryData() {
                return localStorage.getItem(this.KEY) !== null;
            }
        };
        
        localStorage.setItem('americad_crash_recovery', '[{"type":"TEST"}]');
        expect(CrashGuard.hasRecoveryData()).to.be.true;
        
        CrashGuard.clear();
        expect(CrashGuard.hasRecoveryData()).to.be.false;
    });
});
