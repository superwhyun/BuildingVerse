import * as THREE from 'three';

export class Interaction {
    constructor(sceneManager, worldManager) {
        this.sceneManager = sceneManager;
        this.worldManager = worldManager;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.modal = document.getElementById('room-modal');
        this.form = document.getElementById('room-form');
        this.setupModal();

        // Hover state
        this.hoveredObject = null;
        this.currentHighlightKey = null;
        this.highlightMesh = null;
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
        if (!this.modal.classList.contains('hidden')) return;

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
                this.highlightRange(activeBuilding, x, y, w, h, color);
            }
            return; // Don't do hover logic while dragging
        }

        // --- Hover Logic ---
        const roomMeshes = Array.from(activeBuilding.rooms.values());
        const intersects = this.raycaster.intersectObjects(roomMeshes);

        if (intersects.length > 0) {
            const object = intersects[0].object;
            this.clearHighlight();
            if (this.hoveredObject !== object) {
                this.resetHover();
                this.hoveredObject = object;
                this.startHoverEffect(object);
            } else {
                this.updateTooltipPosition(object);
            }
        } else {
            this.resetHover();

            // Empty Slot Hover (Single)
            const intersectsBody = this.raycaster.intersectObject(activeBuilding.mesh);
            if (intersectsBody.length > 0) {
                const pos = this.getGridPos(intersectsBody[0], activeBuilding);
                this.highlightRange(activeBuilding, pos.x, pos.y, 1, 1);
            } else {
                this.clearHighlight();
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
                    this.showModalForNew(this.dragBuildingId, x, y, w, h);
                } else {
                    this.clearHighlight();
                }
            }
        }

        this.dragStart = null;
        this.dragCurrent = null;
    }

    onClick(event) {
        if (this.blockClick) return;

        // Only handle ROOM clicks (Edit Mode). Empty slot clicks are handled by MouseDown/Up (Drag)
        if (event.target.closest('#ui-layer') || event.target.closest('#room-modal')) return;

        // We use fresh coords for click
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);

        const activeBuilding = this.worldManager.buildings.get(this.worldManager.activeBuildingId);
        if (!activeBuilding) return;

        const roomMeshes = Array.from(activeBuilding.rooms.values());
        const intersectsRooms = this.raycaster.intersectObjects(roomMeshes);

        if (intersectsRooms.length > 0) {
            const hit = intersectsRooms[0];
            const roomData = hit.object.userData.room;
            this.showModalForRoom(roomData);
        }
    }

    // --- Visualization ---

    highlightRange(building, startX, startY, width, height, color = 0xffff00) {
        const key = `${building.id}-${startX}-${startY}-${width}-${height}-${color.toString(16)}`;
        if (this.currentHighlightKey === key) return;

        this.clearHighlight();
        this.currentHighlightKey = key;

        // Calculate Geometry params
        const thetaPerSector = (2 * Math.PI) / building.sectorCount;
        const startTheta = (startX / building.sectorCount) * 2 * Math.PI;
        const thetaLength = width * thetaPerSector;

        // Highlight covers the range of sectors. 
        // Height covers range of floors.
        const highlightHeight = height * building.floorHeight;

        const panelRadius = building.radius + 0.2;

        // Create base cylinder segment
        const segmentGeom = new THREE.CylinderGeometry(
            panelRadius, panelRadius,
            highlightHeight - 0.2, // gap
            Math.max(4, width * 2), // segments
            1, true,
            startTheta, thetaLength
        );

        // Edges
        const edges = new THREE.EdgesGeometry(segmentGeom, 15);
        const highlightMat = new THREE.LineBasicMaterial({
            color: color,
            linewidth: 2
        });

        this.highlightMesh = new THREE.LineSegments(edges, highlightMat);

        // Position Y: Center of the vertical range
        // bottomY = startY * H
        const centerY = (startY * building.floorHeight) + (highlightHeight / 2);

        this.highlightMesh.position.y = centerY;

        building.group.add(this.highlightMesh);
        document.body.style.cursor = 'crosshair';

        segmentGeom.dispose();
        this.sceneManager.requestRender();
    }

    clearHighlight() {
        if (this.highlightMesh) {
            if (this.highlightMesh.parent) {
                this.highlightMesh.parent.remove(this.highlightMesh);
            }
            if (this.highlightMesh.geometry) this.highlightMesh.geometry.dispose();
            if (this.highlightMesh.material) this.highlightMesh.material.dispose();
            this.highlightMesh = null;
            document.body.style.cursor = 'default';
            this.sceneManager.requestRender();
        }
        this.currentHighlightKey = null;
    }

    startHoverEffect(object) {
        if (!this.animatedMeshes) this.animatedMeshes = new Set();

        // Store original props if first time
        if (!object.userData.originalPos) {
            object.userData.originalPos = object.position.clone();
        }

        // Calculate Target Logic
        const building = this.worldManager.buildings.get(object.userData.buildingId);
        if (building) {
            const room = object.userData.room;
            const angle = ((room.x + room.width / 2) / building.sectorCount) * 2 * Math.PI;

            // Direction Vector from center
            const dirX = Math.sin(angle);
            const dirZ = Math.cos(angle);

            const R = building.radius;
            const popAmount = 0.5; // Visual pop distance

            let shift;

            if (object.geometry.type === 'PlaneGeometry') {
                // GIF (Plane): Simply move outward by popAmount
                // Because it is flat, we don't need to compensate for curvature expansion
                shift = popAmount;
            } else {
                // Standard Room (Cylinder): Compensate for scale expansion
                const targetVisualR = R + popAmount;
                const geometricR = R * 1.2;
                shift = targetVisualR - geometricR;
            }

            // Target Position (Original + Shift)
            // Original is (0, y, 0).
            const orig = object.userData.originalPos;
            object.userData.targetPos = new THREE.Vector3(
                orig.x + dirX * shift,
                orig.y,
                orig.z + dirZ * shift
            );
        } else {
            object.userData.targetPos = object.position.clone();
        }

        object.userData.targetScale = 1.2;
        this.animatedMeshes.add(object);

        document.body.style.cursor = 'pointer';

        const title = object.userData.room.data.title;
        if (title) {
            const tooltip = document.getElementById('tooltip');
            tooltip.textContent = title;
            tooltip.classList.remove('hidden');
            this.updateTooltipPosition(object);
        }
        this.sceneManager.requestRender();
    }

    updateTooltipPosition(object) {
        const vector = new THREE.Vector3();
        object.getWorldPosition(vector);
        vector.y += 0.5;
        vector.project(this.sceneManager.camera);

        const x = (vector.x * .5 + .5) * window.innerWidth;
        const y = (-(vector.y * .5) + .5) * window.innerHeight;

        const tooltip = document.getElementById('tooltip');
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
    }

    resetHover() {
        if (this.hoveredObject) {
            if (!this.animatedMeshes) this.animatedMeshes = new Set();

            this.hoveredObject.userData.targetScale = 1.0;
            if (this.hoveredObject.userData.originalPos) {
                this.hoveredObject.userData.targetPos = this.hoveredObject.userData.originalPos.clone();
            }

            this.animatedMeshes.add(this.hoveredObject);

            this.hoveredObject = null;
            document.body.style.cursor = 'default';
            document.getElementById('tooltip').classList.add('hidden');
            this.sceneManager.requestRender();
        }
    }

    update(delta) {
        if (!this.animatedMeshes || this.animatedMeshes.size === 0) return;

        const lerpSpeed = 8.0;
        const tolerance = 0.005;

        for (const mesh of this.animatedMeshes) {
            // Scale
            const targetScale = mesh.userData.targetScale || 1.0;
            const currentScale = mesh.scale.x;
            const newScale = THREE.MathUtils.lerp(currentScale, targetScale, lerpSpeed * delta);
            mesh.scale.set(newScale, newScale, newScale);

            // Position interpolation
            let posDone = true;
            if (mesh.userData.targetPos) {
                mesh.position.lerp(mesh.userData.targetPos, lerpSpeed * delta);
                if (mesh.position.distanceTo(mesh.userData.targetPos) > tolerance) {
                    posDone = false;
                }
            }

            const scaleDone = Math.abs(newScale - targetScale) < tolerance;

            if (scaleDone && posDone) {
                mesh.scale.set(targetScale, targetScale, targetScale);
                if (mesh.userData.targetPos) {
                    mesh.position.copy(mesh.userData.targetPos);
                }
                this.animatedMeshes.delete(mesh);
            }
        }
        this.sceneManager.requestRender();
    }

    // --- Modal Logic ---

    setupModal() {
        document.getElementById('btn-cancel').addEventListener('click', () => this.hideModal());

        document.getElementById('btn-delete').addEventListener('click', (e) => {
            e.preventDefault();
            this.deleteCurrentRoom();
        });

        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveRoom();
        });
    }

    showModalForNew(buildingId, x, y, w = 1, h = 1) {
        this.currentRoomId = null;
        this.pendingGridPos = { buildingId, x, y };

        document.getElementById('room-width').value = w;
        document.getElementById('room-height').value = h;
        document.getElementById('room-title').value = '';
        document.getElementById('room-image').value = '';
        document.getElementById('room-url').value = '';
        document.getElementById('room-banner').value = '';

        document.getElementById('btn-delete').style.display = 'none';
        this.modal.classList.remove('hidden');
    }

    showModalForRoom(room) {
        this.currentRoomId = room.id;
        this.pendingGridPos = { buildingId: room.buildingId, x: room.x, y: room.y };

        document.getElementById('room-width').value = room.width;
        document.getElementById('room-height').value = room.height;
        document.getElementById('room-title').value = room.data.title || '';
        document.getElementById('room-image').value = room.data.imageUrl || '';
        document.getElementById('room-url').value = room.data.url || '';
        document.getElementById('room-banner').value = room.data.bannerText || '';

        document.getElementById('btn-delete').style.display = 'inline-block';
        this.modal.classList.remove('hidden');
    }

    hideModal() {
        this.modal.classList.add('hidden');
    }

    async saveRoom() {
        const width = parseInt(document.getElementById('room-width').value);
        const height = parseInt(document.getElementById('room-height').value);
        const title = document.getElementById('room-title').value;
        const imageUrl = document.getElementById('room-image').value;
        const url = document.getElementById('room-url').value;
        const bannerText = document.getElementById('room-banner').value;

        const roomData = { width, height, data: { title, imageUrl, url, bannerText } };

        if (this.currentRoomId) {
            await fetch(`/api/rooms/${this.currentRoomId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(roomData)
            });
        } else {
            Object.assign(roomData, this.pendingGridPos);
            await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(roomData)
            });
        }

        this.hideModal();
        this.worldManager.loadRooms(this.pendingGridPos.buildingId);
    }

    async deleteCurrentRoom() {
        if (!this.currentRoomId) return;
        if (confirm("Are you sure you want to delete this room?")) {
            await fetch(`/api/rooms/${this.currentRoomId}`, { method: 'DELETE' });
            this.hideModal();
            this.worldManager.loadRooms(this.pendingGridPos.buildingId);
        }
    }
}
