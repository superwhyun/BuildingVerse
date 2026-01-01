import * as THREE from 'three';

export class BuildingLabel {
    constructor(building) {
        this.building = building;
        this.labels = []; // Array of label meshes
    }

    createLabelTexture(text) {
        const canvas = document.createElement('canvas');
        canvas.width = 128; // Reduced detail
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = 'bold 30px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; // Faint white
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        return new THREE.CanvasTexture(canvas);
    }

    rebuildEmptyLabels() {
        // 1. Clear existing labels
        this.clearLabels();

        // 2. Map Occupied Slots
        const occupied = new Set();
        for (const roomMesh of this.building.rooms.values()) {
            const r = roomMesh.userData.room;
            for (let h = 0; h < r.height; h++) {
                const f = r.y + h;
                for (let w = 0; w < r.width; w++) {
                    const s = (r.x + w) % this.building.sectorCount;
                    occupied.add(`${s}-${f}`);
                }
            }
        }
        this.building.occupied = occupied; // Update building's occupied set for collision checks

        // 3. Create Labels for Empty Slots
        const thetaPerSector = (2 * Math.PI) / this.building.sectorCount;

        for (let f = 0; f < this.building.floorCount; f++) {
            for (let s = 0; s < this.building.sectorCount; s++) {
                if (occupied.has(`${s}-${f}`)) continue;

                const text = `${f},${s}`;
                const tex = this.createLabelTexture(text);

                const startTheta = (s / this.building.sectorCount) * 2 * Math.PI;

                const geom = new THREE.CylinderGeometry(
                    this.building.radius + 0.05,
                    this.building.radius + 0.05,
                    this.building.floorHeight * 0.8,
                    4, 1, true,
                    startTheta, thetaPerSector
                );

                // We need to fix UVs. Since fixUVs was in Building, we assume it might be available or we duplicate/move it.
                // It's better to having it in a shared utility or pass it. 
                // For now, I'll copy the logic or call a method if I move it to a util.
                // I will duplicate `fixUVs` here or import it if I make a util. 
                // Let's implement it here directly to be self-contained for now.
                this.fixUVs(geom);

                const mat = new THREE.MeshBasicMaterial({
                    map: tex,
                    transparent: true,
                    opacity: 0.6,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending
                });

                const mesh = new THREE.Mesh(geom, mat);
                const posY = (f * this.building.floorHeight) + (this.building.floorHeight / 2);
                mesh.position.y = posY;

                mesh.raycast = () => { };

                this.building.group.add(mesh);
                this.labels.push(mesh);
            }
        }
    }

    clearLabels() {
        for (const mesh of this.labels) {
            this.building.group.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (mesh.material.map) mesh.material.map.dispose();
                mesh.material.dispose();
            }
        }
        this.labels = [];
    }

    fixUVs(geometry) {
        const uvs = geometry.attributes.uv;
        const count = uvs.count;

        let minU = 1, maxU = 0;
        for (let i = 0; i < count; i++) {
            const u = uvs.getX(i);
            if (u < minU) minU = u;
            if (u > maxU) maxU = u;
        }

        for (let i = 0; i < count; i++) {
            const u = uvs.getX(i);
            const newU = (u - minU) / (maxU - minU);
            uvs.setX(i, newU);
        }
        uvs.needsUpdate = true;
    }
}
