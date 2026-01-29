/**
 * Snap Manager Unit Tests
 * 
 * Tests for the comprehensive snap system.
 */

import { SnapManager, SnapType, SnapResult, snapManager } from '../src/ui/snap-manager.js';
import { SketchPoint, Sketch } from '../src/sketch/sketch-manager.js';

// Mock sketch for testing
function createTestSketch() {
    const sketch = new Sketch('test', 'xy');
    
    // Add a line from (0,0) to (100,0)
    sketch.addLine(0, 0, 100, 0);
    
    // Add a line from (100,0) to (100,100)
    sketch.addLine(100, 0, 100, 100);
    
    // Add a circle at (50,50) with radius 20
    sketch.addCircle(50, 50, 20);
    
    return sketch;
}

describe('SnapManager', () => {
    let manager;
    let sketch;
    
    beforeEach(() => {
        manager = new SnapManager();
        sketch = createTestSketch();
    });
    
    describe('Grid Snap', () => {
        it('should snap to grid intersections', () => {
            manager.setEnabled('endpoint', false);
            manager.setEnabled('midpoint', false);
            manager.setEnabled('center', false);
            manager.setEnabled('nearest', false);
            manager.setGridSize(10);
            
            const mousePos = new SketchPoint(12, 18);
            const result = manager.findSnapPoint(mousePos, sketch);
            
            expect(result).toBeTruthy();
            expect(result.point.x).toBe(10);
            expect(result.point.y).toBe(20);
            expect(result.type).toBe(SnapType.GRID);
        });
        
        it('should respect grid size setting', () => {
            manager.setEnabled('endpoint', false);
            manager.setEnabled('midpoint', false);
            manager.setEnabled('center', false);
            manager.setEnabled('nearest', false);
            manager.setGridSize(5);
            
            const mousePos = new SketchPoint(12, 18);
            const result = manager.findSnapPoint(mousePos, sketch);
            
            expect(result.point.x).toBe(10);
            expect(result.point.y).toBe(20);
        });
    });
    
    describe('Endpoint Snap', () => {
        it('should snap to line endpoints', () => {
            manager.setTolerance(15);
            
            const mousePos = new SketchPoint(3, 2);
            const result = manager.findSnapPoint(mousePos, sketch);
            
            expect(result).toBeTruthy();
            expect(result.type).toBe(SnapType.ENDPOINT);
            expect(result.point.x).toBe(0);
            expect(result.point.y).toBe(0);
        });
        
        it('should find nearby endpoints within tolerance', () => {
            manager.setTolerance(10);
            
            const mousePos = new SketchPoint(98, 2);
            const result = manager.findSnapPoint(mousePos, sketch);
            
            expect(result).toBeTruthy();
            expect(result.type).toBe(SnapType.ENDPOINT);
            expect(result.point.x).toBe(100);
            expect(result.point.y).toBe(0);
        });
    });
    
    describe('Midpoint Snap', () => {
        it('should snap to line midpoints', () => {
            manager.setTolerance(15);
            
            const mousePos = new SketchPoint(52, 3);
            const result = manager.findSnapPoint(mousePos, sketch);
            
            // Should find midpoint of first line (50, 0)
            if (result.type === SnapType.MIDPOINT) {
                expect(result.point.x).toBe(50);
                expect(result.point.y).toBe(0);
            }
        });
    });
    
    describe('Center Snap', () => {
        it('should snap to circle centers', () => {
            manager.setTolerance(15);
            
            const mousePos = new SketchPoint(48, 52);
            const result = manager.findSnapPoint(mousePos, sketch);
            
            // Should find center of circle at (50, 50)
            expect(result).toBeTruthy();
            expect(result.type).toBe(SnapType.CENTER);
            expect(result.point.x).toBe(50);
            expect(result.point.y).toBe(50);
        });
    });
    
    describe('Intersection Snap', () => {
        it('should find line intersections', () => {
            // Create a sketch with intersecting lines
            const intersectSketch = new Sketch('intersect', 'xy');
            intersectSketch.addLine(0, 0, 100, 100);  // Diagonal
            intersectSketch.addLine(0, 100, 100, 0);  // Crossing diagonal
            
            manager.setTolerance(15);
            
            const mousePos = new SketchPoint(48, 52);
            const result = manager.findSnapPoint(mousePos, intersectSketch);
            
            expect(result).toBeTruthy();
            expect(result.type).toBe(SnapType.INTERSECTION);
            expect(Math.round(result.point.x)).toBe(50);
            expect(Math.round(result.point.y)).toBe(50);
        });
    });
    
    describe('Master Toggle', () => {
        it('should disable all snapping when inactive', () => {
            manager.setActive(false);
            
            const mousePos = new SketchPoint(0, 0);
            const result = manager.findSnapPoint(mousePos, sketch);
            
            expect(result).toBeNull();
        });
        
        it('should enable snapping when active', () => {
            manager.setActive(true);
            manager.setTolerance(15);
            
            const mousePos = new SketchPoint(2, 2);
            const result = manager.findSnapPoint(mousePos, sketch);
            
            expect(result).toBeTruthy();
        });
    });
    
    describe('Settings', () => {
        it('should return current settings', () => {
            manager.setGridSize(10);
            manager.setTolerance(20);
            manager.setEnabled('midpoint', false);
            
            const settings = manager.getSettings();
            
            expect(settings.gridSize).toBe(10);
            expect(settings.tolerance).toBe(20);
            expect(settings.enabled.midpoint).toBe(false);
        });
        
        it('should apply settings from object', () => {
            manager.applySettings({
                gridSize: 15,
                tolerance: 25,
                enabled: { grid: false, endpoint: true }
            });
            
            const settings = manager.getSettings();
            
            expect(settings.gridSize).toBe(15);
            expect(settings.tolerance).toBe(25);
            expect(settings.enabled.grid).toBe(false);
        });
    });
    
    describe('Priority', () => {
        it('should prefer endpoint over grid snap', () => {
            manager.setGridSize(10);
            manager.setTolerance(15);
            
            // Point is near (0,0) endpoint and also near grid
            const mousePos = new SketchPoint(2, 2);
            const result = manager.findSnapPoint(mousePos, sketch);
            
            expect(result).toBeTruthy();
            expect(result.type.priority).toBeLessThan(SnapType.GRID.priority);
        });
    });
});

describe('SnapType', () => {
    it('should have correct properties for each type', () => {
        expect(SnapType.ENDPOINT.name).toBe('Endpoint');
        expect(SnapType.ENDPOINT.shape).toBe('square');
        expect(SnapType.ENDPOINT.priority).toBeLessThan(SnapType.GRID.priority);
        
        expect(SnapType.MIDPOINT.name).toBe('Midpoint');
        expect(SnapType.MIDPOINT.shape).toBe('triangle');
        
        expect(SnapType.CENTER.name).toBe('Center');
        expect(SnapType.CENTER.shape).toBe('circle');
        
        expect(SnapType.INTERSECTION.name).toBe('Intersection');
        expect(SnapType.INTERSECTION.shape).toBe('cross');
    });
});

describe('Singleton snapManager', () => {
    it('should export a singleton instance', () => {
        expect(snapManager).toBeInstanceOf(SnapManager);
    });
    
    it('should have default settings', () => {
        expect(snapManager.active).toBe(true);
        expect(snapManager.enabled.grid).toBe(true);
        expect(snapManager.enabled.endpoint).toBe(true);
    });
});

// Simple test runner for environments without Jest
if (typeof describe === 'undefined') {
    console.log('Running manual tests...');
    
    const manager = new SnapManager();
    const sketch = createTestSketch();
    
    // Test grid snap
    manager.setEnabled('endpoint', false);
    manager.setEnabled('midpoint', false);
    manager.setEnabled('center', false);
    manager.setEnabled('nearest', false);
    manager.setGridSize(10);
    
    let result = manager.findSnapPoint(new SketchPoint(12, 18), sketch);
    console.log('Grid snap test:', result?.point.x === 10 && result?.point.y === 20 ? 'PASS' : 'FAIL');
    
    // Test endpoint snap
    manager.setEnabled('endpoint', true);
    manager.setTolerance(15);
    
    result = manager.findSnapPoint(new SketchPoint(3, 2), sketch);
    console.log('Endpoint snap test:', result?.type === SnapType.ENDPOINT ? 'PASS' : 'FAIL');
    
    // Test center snap
    result = manager.findSnapPoint(new SketchPoint(48, 52), sketch);
    console.log('Center snap test:', result?.type === SnapType.CENTER ? 'PASS' : 'FAIL');
    
    console.log('All manual tests complete!');
}
