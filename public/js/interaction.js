import * as THREE from 'three';
import { UIManager } from './modules/UIManager.js';
import { HighlightManager } from './modules/HighlightManager.js';
import { AdminManager } from './modules/AdminManager.js';

export class Interaction {
    constructor(sceneManager, worldManager) {
        this.sceneManager = sceneManager;
        this.worldManager = worldManager;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Modules
        this.uiManager = new UIManager(worldManager);
        this.adminManager = new AdminManager(this.uiManager);
        this.highlightManager = new HighlightManager(sceneManager, worldManager);

        // Hover state
        this.lastEventX = 0;
        this.lastEventY = 0;

        // Drag state
        this.isDragging = false;
        this.dragStart = null;
        this.dragCurrent = null;
        this.dragBuildingId = null;

        // Event Listeners
        window.addEventListener('click', (e) => this.onClick(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    }

    // --- Helpers ---

    getGridPos(intersect, building) {
        const point = intersect.point.clone();
        building.group.worldToLocal(point);
        let angle = Math.atan2(point.x, point.z);
        if (angle < 0) angle += 2 * Math.PI;

        const sectorIndex = Math.floor((angle / (2 * Math.PI)) * building.sectorCount);
        const floorIndex = Math.floor(point.y / building.floorHeight);

        // Clamp
        const sIdx = Math.max(0, Math.min(sectorIndex, building.sectorCount - 1));
        const fIdx = Math.max(0, Math.min(floorIndex, building.floorCount - 1));

        return { x: sIdx, y: fIdx };
    }

    updateMouse(event) {
        this.lastEventX = event.clientX;
        this.lastEventY = event.clientY;
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    }

    // --- Events ---

    onMouseDown(event) {
        if (event.target.closest('#ui-layer') || event.target.closest('#room-modal')) return;

        this.updateMouse(event);
        this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);

        const activeBuilding = this.worldManager.buildings.get(this.worldManager.activeBuildingId);
        if (!activeBuilding) return;

        // 1. Check intersection with Rooms (Prevent drag starting on an existing room)
        // If clicking a room, we let onClick handle it (interact/edit).
        const roomMeshes = Array.from(activeBuilding.rooms.values());
        const intersectsRooms = this.raycaster.intersectObjects(roomMeshes);

        if (intersectsRooms.length > 0) {
            this.isDragging = false;
            return;
        }

        // 2. Check intersection with Empty Slot
        const intersectsBody = this.raycaster.intersectObject(activeBuilding.mesh);
        if (intersectsBody.length > 0) {
            this.isDragging = true;
            this.dragStart = this.getGridPos(intersectsBody[0], activeBuilding);
            this.dragCurrent = this.dragStart;
            this.dragBuildingId = activeBuilding.id;
        }
    }

    onMouseMove(event) {
        if (!this.uiManager.modal.classList.contains('hidden')) return;

        this.updateMouse(event);
        this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);

        const activeBuilding = this.worldManager.buildings.get(this.worldManager.activeBuildingId);
        if (!activeBuilding) return;

        if (this.isDragging && this.dragStart) {
            // --- Dragging Logic ---
            const intersectsBody = this.raycaster.intersectObject(activeBuilding.mesh);
            if (intersectsBody.length > 0) {
                const currentPos = this.getGridPos(intersectsBody[0], activeBuilding);
                this.dragCurrent = currentPos;

                // Calculate range with Wrapping
                const sectorCount = activeBuilding.sectorCount;
                const sx = this.dragStart.x;
                const cx = currentPos.x;

                let x, w;
                if (Math.abs(sx - cx) > sectorCount / 2) {
                    // Wrap case
                    x = Math.max(sx, cx);
                    w = sectorCount - Math.abs(sx - cx) + 1;
                } else {
                    // Linear case
                    x = Math.min(sx, cx);
                    w = Math.max(sx, cx) - x + 1;
                }

                const y = Math.min(this.dragStart.y, currentPos.y);
                const h = Math.max(this.dragStart.y, currentPos.y) - y + 1;

                const isColliding = activeBuilding.checkCollision(x, y, w, h);
                const color = isColliding ? 0xff0000 : 0xffff00;
                this.highlightManager.highlightRange(activeBuilding, x, y, w, h, color);
            }
            return; // Don't do hover logic while dragging
        }

        // --- Hover Logic ---
        const roomMeshes = Array.from(activeBuilding.rooms.values());
        const intersects = this.raycaster.intersectObjects(roomMeshes);

        if (intersects.length > 0) {
            const object = intersects[0].object;
            this.highlightManager.clearHighlight();
            if (this.highlightManager.hoveredObject !== object) {
                this.highlightManager.resetHover();
                this.highlightManager.startHoverEffect(object);
            } else {
                this.highlightManager.updateTooltipPosition(object);
            }
        } else {
            this.highlightManager.resetHover();

            // Empty Slot Hover (Single)
            const intersectsBody = this.raycaster.intersectObject(activeBuilding.mesh);
            if (intersectsBody.length > 0) {
                const pos = this.getGridPos(intersectsBody[0], activeBuilding);
                this.highlightManager.highlightRange(activeBuilding, pos.x, pos.y, 1, 1);
            } else {
                this.highlightManager.clearHighlight();
            }
        }
    }

    onMouseUp(event) {
        if (!this.isDragging) return;
        this.isDragging = false;

        // Block subsequent click event
        this.blockClick = true;
        setTimeout(() => this.blockClick = false, 100);

        if (this.dragStart && this.dragCurrent) {
            const activeBuilding = this.worldManager.buildings.get(this.dragBuildingId);
            if (activeBuilding) {
                const sectorCount = activeBuilding.sectorCount;
                const sx = this.dragStart.x;
                const cx = this.dragCurrent.x;

                let x, w;
                if (Math.abs(sx - cx) > sectorCount / 2) {
                    // Wrap case
                    x = Math.max(sx, cx);
                    w = sectorCount - Math.abs(sx - cx) + 1;
                } else {
                    // Linear case
                    x = Math.min(sx, cx);
                    w = Math.max(sx, cx) - x + 1;
                }

                const y = Math.min(this.dragStart.y, this.dragCurrent.y);
                const h = Math.max(this.dragStart.y, this.dragCurrent.y) - y + 1;

                // Open creation modal with selected range if valid
                if (!activeBuilding.checkCollision(x, y, w, h)) {
                    this.uiManager.showModalForNew(this.dragBuildingId, x, y, w, h);
                } else {
                    this.highlightManager.clearHighlight();
                }
            }
        }

        this.dragStart = null;
        this.dragCurrent = null;
    }

    onClick(event) {
        if (this.blockClick) {
            return;
        }

        // Only handle ROOM clicks (Edit Mode). Empty slot clicks are handled by MouseDown/Up (Drag)
        if (event.target.closest('#ui-layer') || event.target.closest('#room-modal')) return;

        // We use fresh coords for click
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);

        const activeBuilding = this.worldManager.buildings.get(this.worldManager.activeBuildingId);
        if (!activeBuilding) {
            return;
        }

        const roomMeshes = Array.from(activeBuilding.rooms.values());

        const intersectsRooms = this.raycaster.intersectObjects(roomMeshes);

        if (intersectsRooms.length > 0) {
            const hit = intersectsRooms[0];
            const roomData = hit.object.userData.room;
            this.uiManager.showModalForRoom(roomData);
        } else {
            // Click missed all rooms
        }
    }

    update(delta) {
        this.highlightManager.update(delta);
    }
}
