/**
 * Ameri-CAD Measure Tool
 * 
 * Interactive measurement tool for CAD geometry.
 * - Point to point distance
 * - Point to edge distance
 * - Edge to edge minimum distance
 * - Angle between edges
 * 
 * CAD-style dimension visualization with extension lines and arrows.
 */

import * as THREE from 'three';
import { updateMouseCoords } from '../core/transforms.js';

export const MeasureMode = {
    NONE: 'none',
    DISTANCE: 'distance',
    ANGLE: 'angle'
};

/**
 * A single measurement annotation
 */
export class Measurement {
    constructor(type, data) {
        this.id = `measure_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.type = type; // 'distance' or 'angle'
        this.data = data;
        this.visible = true;
        this.group = null; // Three.js group for visualization
    }
}

/**
 * MeasureTool - Interactive measurement tool
 */
export class MeasureTool {
    constructor(options = {}) {
        this.scene = options.scene;
        this.camera = options.camera;
        this.renderer = options.renderer;
        this.evaluator = options.evaluator;
        
        // State
        this.active = false;
        this.mode = MeasureMode.DISTANCE;
        this.measurements = new Map();
        
        // Current pick state
        this.picks = [];
        this.previewGroup = null;
        
        // Raycaster for picking
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Line = { threshold: 0.1 };
        
        // Materials for visualization
        this.materials = {
            line: new THREE.LineBasicMaterial({ 
                color: 0x00ff88, 
                linewidth: 2,
                depthTest: false,
                transparent: true
            }),
            linePreview: new THREE.LineDashedMaterial({
                color: 0x00ffff,
                dashSize: 0.3,
                gapSize: 0.15,
                depthTest: false,
                transparent: true
            }),
            extension: new THREE.LineBasicMaterial({ 
                color: 0x00ff88, 
                linewidth: 1,
                depthTest: false,
                transparent: true,
                opacity: 0.7
            }),
            point: new THREE.PointsMaterial({
                color: 0xff4444,
                size: 8,
                sizeAttenuation: false,
                depthTest: false
            }),
            arrow: new THREE.MeshBasicMaterial({
                color: 0x00ff88,
                depthTest: false,
                transparent: true
            }),
            angleArc: new THREE.LineBasicMaterial({
                color: 0xffaa00,
                linewidth: 2,
                depthTest: false,
                transparent: true
            })
        };
        
        // Measurement display group (always rendered on top)
        this.displayGroup = new THREE.Group();
        this.displayGroup.name = 'Measurements';
        this.displayGroup.renderOrder = 999;
        
        // Callbacks
        this.onModeChange = options.onModeChange || (() => {});
        this.onMeasurementComplete = options.onMeasurementComplete || (() => {});
        this.onStatusUpdate = options.onStatusUpdate || (() => {});
        
        // Bind event handlers
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        
        // Units configuration
        this.units = options.units || 'mm';
        this.precision = options.precision ?? 2;
        
        // Initialize
        this._createStatusUI();
    }
    
    /**
     * Initialize the tool with the scene
     */
    init(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        // Add display group to scene
        if (!this.scene.getObjectByName('Measurements')) {
            this.scene.add(this.displayGroup);
        }
    }
    
    /**
     * Activate measure mode
     */
    activate(mode = MeasureMode.DISTANCE) {
        if (this.active && this.mode === mode) return;
        
        this.active = true;
        this.mode = mode;
        this.picks = [];
        this._clearPreview();
        
        // Add event listeners
        const canvas = this.renderer?.domElement;
        if (canvas) {
            canvas.addEventListener('mousemove', this._onMouseMove);
            canvas.addEventListener('mousedown', this._onMouseDown);
            document.addEventListener('keydown', this._onKeyDown);
            canvas.style.cursor = 'crosshair';
        }
        
        this._updateStatus();
        this.onModeChange(this.mode);
        
        console.log(`[MeasureTool] Activated in ${mode} mode`);
    }
    
    /**
     * Deactivate measure mode
     */
    deactivate() {
        if (!this.active) return;
        
        this.active = false;
        this.picks = [];
        this._clearPreview();
        
        // Remove event listeners
        const canvas = this.renderer?.domElement;
        if (canvas) {
            canvas.removeEventListener('mousemove', this._onMouseMove);
            canvas.removeEventListener('mousedown', this._onMouseDown);
            document.removeEventListener('keydown', this._onKeyDown);
            canvas.style.cursor = '';
        }
        
        this._updateStatus('');
        this.onModeChange(MeasureMode.NONE);
        
        console.log('[MeasureTool] Deactivated');
    }
    
    /**
     * Toggle measure mode
     */
    toggle(mode = MeasureMode.DISTANCE) {
        if (this.active && this.mode === mode) {
            this.deactivate();
        } else {
            this.activate(mode);
        }
    }
    
    /**
     * Set measure mode
     */
    setMode(mode) {
        if (this.active) {
            this.mode = mode;
            this.picks = [];
            this._clearPreview();
            this._updateStatus();
            this.onModeChange(mode);
        }
    }
    
    /**
     * Clear all measurements
     */
    clearAll() {
        for (const [id, measurement] of this.measurements) {
            if (measurement.group) {
                this.displayGroup.remove(measurement.group);
                this._disposeGroup(measurement.group);
            }
        }
        this.measurements.clear();
        this.picks = [];
        this._clearPreview();
        console.log('[MeasureTool] All measurements cleared');
        return 'Cleared all measurements';
    }
    
    /**
     * Clear a specific measurement
     */
    clearMeasurement(id) {
        const measurement = this.measurements.get(id);
        if (measurement) {
            if (measurement.group) {
                this.displayGroup.remove(measurement.group);
                this._disposeGroup(measurement.group);
            }
            this.measurements.delete(id);
            return true;
        }
        return false;
    }
    
    /**
     * Get all measurements
     */
    getMeasurements() {
        return Array.from(this.measurements.values());
    }
    
    // ==================== Event Handlers ====================
    
    _onMouseMove(event) {
        if (!this.active || !this.camera || !this.renderer) return;
        
        const mouse = updateMouseCoords(event, this.renderer.domElement);
        const pickResult = this._performPick(mouse);
        
        // Update preview
        if (this.picks.length > 0 && pickResult) {
            this._updatePreview(pickResult.point);
        }
        
        // Update cursor based on what's under it
        const canvas = this.renderer.domElement;
        if (pickResult) {
            canvas.style.cursor = 'crosshair';
        } else {
            canvas.style.cursor = 'crosshair';
        }
    }
    
    _onMouseDown(event) {
        if (!this.active || event.button !== 0) return; // Left click only
        
        const mouse = updateMouseCoords(event, this.renderer.domElement);
        const pickResult = this._performPick(mouse);
        
        if (!pickResult) return;
        
        this.picks.push(pickResult);
        
        // Check if we have enough picks
        if (this.mode === MeasureMode.DISTANCE && this.picks.length === 2) {
            this._completeMeasurement();
        } else if (this.mode === MeasureMode.ANGLE && this.picks.length === 2) {
            // For angle, we need two edges
            this._completeMeasurement();
        } else {
            this._updateStatus();
            this._showPickMarker(pickResult.point);
        }
    }
    
    _onKeyDown(event) {
        if (event.key === 'Escape') {
            if (this.picks.length > 0) {
                // Cancel current measurement
                this.picks = [];
                this._clearPreview();
                this._updateStatus();
            } else {
                // Deactivate tool
                this.deactivate();
            }
        } else if (event.key === 'd' || event.key === 'D') {
            this.setMode(MeasureMode.DISTANCE);
        } else if (event.key === 'a' || event.key === 'A') {
            this.setMode(MeasureMode.ANGLE);
        }
    }
    
    // ==================== Picking ====================
    
    _performPick(mouse) {
        this.raycaster.setFromCamera(mouse, this.camera);
        
        // Get all meshes from the evaluator
        const meshes = [];
        if (this.evaluator) {
            for (const [, mesh] of this.evaluator.meshes) {
                if (mesh.visible) {
                    meshes.push(mesh);
                }
            }
        }
        
        if (meshes.length === 0) {
            // Fall back to ground plane
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const target = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(plane, target)) {
                return {
                    point: target,
                    type: 'ground',
                    object: null,
                    face: null,
                    faceIndex: null
                };
            }
            return null;
        }
        
        const intersects = this.raycaster.intersectObjects(meshes, false);
        
        if (intersects.length > 0) {
            const hit = intersects[0];
            return {
                point: hit.point.clone(),
                type: 'geometry',
                object: hit.object,
                face: hit.face,
                faceIndex: hit.faceIndex,
                featureId: hit.object.userData?.featureId
            };
        }
        
        // Fall back to ground plane
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(plane, target)) {
            return {
                point: target,
                type: 'ground',
                object: null,
                face: null,
                faceIndex: null
            };
        }
        
        return null;
    }
    
    // ==================== Measurement Completion ====================
    
    _completeMeasurement() {
        if (this.mode === MeasureMode.DISTANCE && this.picks.length >= 2) {
            const p1 = this.picks[0].point;
            const p2 = this.picks[1].point;
            const distance = p1.distanceTo(p2);
            
            const measurement = new Measurement('distance', {
                point1: p1.clone(),
                point2: p2.clone(),
                distance: distance,
                picks: [...this.picks]
            });
            
            // Create visualization
            measurement.group = this._createDistanceVisualization(p1, p2, distance);
            this.displayGroup.add(measurement.group);
            
            // Store measurement
            this.measurements.set(measurement.id, measurement);
            
            // Format output
            const formatted = this._formatDistance(distance);
            console.log(`[MeasureTool] Distance: ${formatted}`);
            
            this.onMeasurementComplete({
                type: 'distance',
                value: distance,
                formatted: formatted,
                measurement: measurement
            });
            
            // Reset picks
            this.picks = [];
            this._clearPreview();
            this._updateStatus();
            
            return formatted;
            
        } else if (this.mode === MeasureMode.ANGLE && this.picks.length >= 2) {
            // For angle measurement, we need face normals or edges
            const pick1 = this.picks[0];
            const pick2 = this.picks[1];
            
            let angle = 0;
            let normal1, normal2;
            
            // Try to get face normals
            if (pick1.face && pick2.face) {
                normal1 = pick1.face.normal.clone();
                normal2 = pick2.face.normal.clone();
                
                // Transform normals to world space if needed
                if (pick1.object) {
                    normal1.applyMatrix3(new THREE.Matrix3().getNormalMatrix(pick1.object.matrixWorld));
                }
                if (pick2.object) {
                    normal2.applyMatrix3(new THREE.Matrix3().getNormalMatrix(pick2.object.matrixWorld));
                }
                
                angle = Math.acos(Math.min(1, Math.max(-1, normal1.dot(normal2))));
            } else {
                // Fall back to measuring angle between direction vectors from origin
                const dir1 = pick1.point.clone().normalize();
                const dir2 = pick2.point.clone().normalize();
                angle = Math.acos(Math.min(1, Math.max(-1, dir1.dot(dir2))));
            }
            
            const angleDegrees = THREE.MathUtils.radToDeg(angle);
            
            const measurement = new Measurement('angle', {
                point1: pick1.point.clone(),
                point2: pick2.point.clone(),
                normal1: normal1,
                normal2: normal2,
                angle: angleDegrees,
                picks: [...this.picks]
            });
            
            // Create visualization
            measurement.group = this._createAngleVisualization(pick1, pick2, angleDegrees);
            this.displayGroup.add(measurement.group);
            
            // Store measurement
            this.measurements.set(measurement.id, measurement);
            
            // Format output
            const formatted = this._formatAngle(angleDegrees);
            console.log(`[MeasureTool] Angle: ${formatted}`);
            
            this.onMeasurementComplete({
                type: 'angle',
                value: angleDegrees,
                formatted: formatted,
                measurement: measurement
            });
            
            // Reset picks
            this.picks = [];
            this._clearPreview();
            this._updateStatus();
            
            return formatted;
        }
        
        return null;
    }
    
    // ==================== Visualization ====================
    
    _createDistanceVisualization(p1, p2, distance) {
        const group = new THREE.Group();
        group.name = 'DistanceMeasurement';
        group.renderOrder = 999;
        
        // Calculate offset for dimension line
        const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
        const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        
        // Get perpendicular direction (prefer screen-up direction)
        const up = new THREE.Vector3(0, 1, 0);
        let offset = new THREE.Vector3().crossVectors(direction, up);
        if (offset.lengthSq() < 0.001) {
            offset.crossVectors(direction, new THREE.Vector3(1, 0, 0));
        }
        offset.normalize().multiplyScalar(1.5); // Offset distance
        
        // Extension line endpoints
        const ext1Start = p1.clone();
        const ext1End = p1.clone().add(offset);
        const ext2Start = p2.clone();
        const ext2End = p2.clone().add(offset);
        
        // Create extension lines
        const extGeom1 = new THREE.BufferGeometry().setFromPoints([ext1Start, ext1End]);
        const extLine1 = new THREE.Line(extGeom1, this.materials.extension);
        group.add(extLine1);
        
        const extGeom2 = new THREE.BufferGeometry().setFromPoints([ext2Start, ext2End]);
        const extLine2 = new THREE.Line(extGeom2, this.materials.extension);
        group.add(extLine2);
        
        // Create dimension line
        const dimGeom = new THREE.BufferGeometry().setFromPoints([ext1End, ext2End]);
        const dimLine = new THREE.Line(dimGeom, this.materials.line);
        group.add(dimLine);
        
        // Create arrows at ends
        const arrowSize = Math.min(0.3, distance * 0.1);
        const arrow1 = this._createArrow(ext1End, direction, arrowSize);
        const arrow2 = this._createArrow(ext2End, direction.clone().negate(), arrowSize);
        group.add(arrow1);
        group.add(arrow2);
        
        // Create pick markers
        const marker1 = this._createPickMarkerGeometry(p1);
        const marker2 = this._createPickMarkerGeometry(p2);
        group.add(marker1);
        group.add(marker2);
        
        // Create text label (using sprite for now - could use HTML overlay later)
        const label = this._createTextLabel(this._formatDistance(distance), midpoint.clone().add(offset).add(offset.clone().normalize().multiplyScalar(0.3)));
        group.add(label);
        
        return group;
    }
    
    _createAngleVisualization(pick1, pick2, angleDegrees) {
        const group = new THREE.Group();
        group.name = 'AngleMeasurement';
        group.renderOrder = 999;
        
        const p1 = pick1.point;
        const p2 = pick2.point;
        const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        
        // Create arc to show angle
        if (pick1.face && pick2.face) {
            const normal1 = pick1.face.normal.clone();
            const normal2 = pick2.face.normal.clone();
            
            if (pick1.object) {
                normal1.applyMatrix3(new THREE.Matrix3().getNormalMatrix(pick1.object.matrixWorld));
            }
            if (pick2.object) {
                normal2.applyMatrix3(new THREE.Matrix3().getNormalMatrix(pick2.object.matrixWorld));
            }
            
            // Draw normal indicators
            const normalLen = 2;
            const normGeom1 = new THREE.BufferGeometry().setFromPoints([
                p1, p1.clone().add(normal1.multiplyScalar(normalLen))
            ]);
            const normLine1 = new THREE.Line(normGeom1, this.materials.angleArc);
            group.add(normLine1);
            
            const normGeom2 = new THREE.BufferGeometry().setFromPoints([
                p2, p2.clone().add(normal2.multiplyScalar(normalLen))
            ]);
            const normLine2 = new THREE.Line(normGeom2, this.materials.angleArc);
            group.add(normLine2);
        }
        
        // Create pick markers
        const marker1 = this._createPickMarkerGeometry(p1);
        const marker2 = this._createPickMarkerGeometry(p2);
        group.add(marker1);
        group.add(marker2);
        
        // Connection line
        const connGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const connLine = new THREE.Line(connGeom, this.materials.linePreview);
        connLine.computeLineDistances();
        group.add(connLine);
        
        // Create text label
        const label = this._createTextLabel(this._formatAngle(angleDegrees), midpoint.clone().add(new THREE.Vector3(0, 1, 0)));
        group.add(label);
        
        return group;
    }
    
    _createArrow(position, direction, size) {
        const group = new THREE.Group();
        
        // Simple cone arrow
        const coneGeom = new THREE.ConeGeometry(size * 0.3, size, 8);
        const cone = new THREE.Mesh(coneGeom, this.materials.arrow);
        
        // Rotate to point in direction
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        cone.quaternion.copy(quaternion);
        
        cone.position.copy(position);
        group.add(cone);
        
        return group;
    }
    
    _createPickMarkerGeometry(position) {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute([position.x, position.y, position.z], 3));
        const points = new THREE.Points(geom, this.materials.point);
        return points;
    }
    
    _createTextLabel(text, position) {
        // Create canvas for text
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        // Style
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        
        // Create texture and sprite
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture, 
            depthTest: false,
            transparent: true
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(position);
        sprite.scale.set(4, 1, 1); // Adjust for aspect ratio
        sprite.renderOrder = 1000;
        
        return sprite;
    }
    
    // ==================== Preview ====================
    
    _showPickMarker(position) {
        if (!this.previewGroup) {
            this.previewGroup = new THREE.Group();
            this.previewGroup.name = 'MeasurePreview';
            this.displayGroup.add(this.previewGroup);
        }
        
        const marker = this._createPickMarkerGeometry(position);
        this.previewGroup.add(marker);
    }
    
    _updatePreview(currentPoint) {
        if (!this.previewGroup) {
            this.previewGroup = new THREE.Group();
            this.previewGroup.name = 'MeasurePreview';
            this.displayGroup.add(this.previewGroup);
        }
        
        // Remove old preview line
        const oldLine = this.previewGroup.getObjectByName('previewLine');
        if (oldLine) {
            this.previewGroup.remove(oldLine);
            oldLine.geometry?.dispose();
        }
        
        if (this.picks.length > 0) {
            const p1 = this.picks[0].point;
            const geom = new THREE.BufferGeometry().setFromPoints([p1, currentPoint]);
            const line = new THREE.Line(geom, this.materials.linePreview);
            line.name = 'previewLine';
            line.computeLineDistances();
            this.previewGroup.add(line);
            
            // Show live distance in status
            const dist = p1.distanceTo(currentPoint);
            this._updateStatus(`Distance: ${this._formatDistance(dist)} (click to confirm)`);
        }
    }
    
    _clearPreview() {
        if (this.previewGroup) {
            this._disposeGroup(this.previewGroup);
            this.displayGroup.remove(this.previewGroup);
            this.previewGroup = null;
        }
    }
    
    // ==================== Formatting ====================
    
    _formatDistance(distance) {
        const value = distance.toFixed(this.precision);
        return `${value} ${this.units}`;
    }
    
    _formatAngle(angle) {
        return `${angle.toFixed(1)}°`;
    }
    
    // ==================== Status UI ====================
    
    _createStatusUI() {
        // Status will be shown in the command line or a dedicated status bar
        this.statusElement = null;
    }
    
    _updateStatus(message = null) {
        let status = message;
        
        if (!status && this.active) {
            if (this.mode === MeasureMode.DISTANCE) {
                if (this.picks.length === 0) {
                    status = 'MEASURE: Click first point';
                } else {
                    status = 'MEASURE: Click second point';
                }
            } else if (this.mode === MeasureMode.ANGLE) {
                if (this.picks.length === 0) {
                    status = 'MEASURE ANGLE: Click first face';
                } else {
                    status = 'MEASURE ANGLE: Click second face';
                }
            }
        }
        
        this.onStatusUpdate(status || '');
    }
    
    // ==================== Cleanup ====================
    
    _disposeGroup(group) {
        group.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (obj.material.map) obj.material.map.dispose();
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
        group.clear();
    }
    
    dispose() {
        this.deactivate();
        this.clearAll();
        
        // Dispose materials
        Object.values(this.materials).forEach(m => m.dispose());
        
        // Remove from scene
        if (this.displayGroup.parent) {
            this.displayGroup.parent.remove(this.displayGroup);
        }
    }
}

export default MeasureTool;
