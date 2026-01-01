import * as THREE from 'three';

export class HighlightManager {
    constructor(sceneManager, worldManager) {
        this.sceneManager = sceneManager;
        this.worldManager = worldManager;

        this.currentHighlightKey = null;
        this.highlightMesh = null;
        this.hoveredObject = null;
        this.animatedMeshes = new Set();
    }

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
                shift = popAmount;
            } else {
                // Standard Room (Cylinder): Compensate for scale expansion
                const targetVisualR = R + popAmount;
                const geometricR = R * 1.2;
                shift = targetVisualR - geometricR;
            }

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
        this.hoveredObject = object;

        document.body.style.cursor = 'pointer';

        const title = object.userData.room.data.title;
        if (title) {
            const tooltip = document.getElementById('tooltip');
            if (tooltip) {
                tooltip.textContent = title;
                tooltip.classList.remove('hidden');
                this.updateTooltipPosition(object);
            }
        }
        this.sceneManager.requestRender();
    }

    resetHover() {
        if (this.hoveredObject) {
            this.hoveredObject.userData.targetScale = 1.0;
            if (this.hoveredObject.userData.originalPos) {
                this.hoveredObject.userData.targetPos = this.hoveredObject.userData.originalPos.clone();
            }

            this.animatedMeshes.add(this.hoveredObject);

            this.hoveredObject = null;
            document.body.style.cursor = 'default';
            const tooltip = document.getElementById('tooltip');
            if (tooltip) tooltip.classList.add('hidden');
            this.sceneManager.requestRender();
        }
    }

    updateTooltipPosition(object) {
        const tooltip = document.getElementById('tooltip');
        if (!tooltip || tooltip.classList.contains('hidden')) return;

        const vector = new THREE.Vector3();
        object.getWorldPosition(vector);
        vector.y += 0.5;
        vector.project(this.sceneManager.camera);

        const x = (vector.x * .5 + .5) * window.innerWidth;
        const y = (-(vector.y * .5) + .5) * window.innerHeight;

        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
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
}
