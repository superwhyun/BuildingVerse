import * as THREE from 'three';
import { BuildingLabel } from './modules/BuildingLabel.js';
import { BuildingTexture } from './modules/BuildingTexture.js';

export class Building {
    constructor(data, scene) {
        this.id = data.id;
        this.data = data;
        this.scene = scene;

        this.group = new THREE.Group();
        this.group.position.set(data.x || 0, 0, data.z || 0);
        this.scene.add(this.group);

        // Parameters
        this.radius = data.radius;
        this.floorCount = data.floorCount;
        this.sectorCount = data.sectorCount;
        this.floorHeight = data.floorHeight;

        this.rooms = new Map(); // id -> Mesh
        this.occupied = new Set(); // "sector-floor" strings

        // Modules
        this.labelManager = new BuildingLabel(this);
        this.textureManager = new BuildingTexture(this);

        this.initStructure();
    }

    initStructure() {
        // 0. Hit Target (Invisible Outer Cylinder)
        const hitGeometry = new THREE.CylinderGeometry(
            this.radius,
            this.radius,
            this.floorCount * this.floorHeight,
            this.sectorCount,
            1,
            true // open ended
        );
        const hitMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.mesh = new THREE.Mesh(hitGeometry, hitMaterial);
        this.mesh.position.y = (this.floorCount * this.floorHeight) / 2;
        this.mesh.userData = { isBuildingBody: true };
        this.group.add(this.mesh);

        // 1. Inner Core (Elevator Shaft)
        const coreGeometry = new THREE.CylinderGeometry(
            this.radius * 0.4,
            this.radius * 0.4,
            this.floorCount * this.floorHeight,
            32
        );
        const coreMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const coreAnalysis = new THREE.Mesh(coreGeometry, coreMaterial);
        coreAnalysis.position.y = (this.floorCount * this.floorHeight) / 2;
        this.group.add(coreAnalysis);

        // 2. Fragmented Floors (InstancedMesh)
        const thetaPerSector = (2 * Math.PI) / this.sectorCount;
        const wedgeGeometry = new THREE.CylinderGeometry(
            this.radius,
            this.radius,
            0.5, // Thickness
            16, // Smoother curve
            1,
            false,
            0, thetaPerSector
        );
        const slabMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });

        // Total instances: (floorCount + 1) * sectorCount
        const totalFloors = (this.floorCount + 1) * this.sectorCount;
        this.floorMesh = new THREE.InstancedMesh(wedgeGeometry, slabMaterial, totalFloors);
        this.floorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const dummy = new THREE.Object3D();
        let idx = 0;

        for (let f = 0; f <= this.floorCount; f++) {
            for (let s = 0; s < this.sectorCount; s++) {
                dummy.position.set(0, f * this.floorHeight, 0);
                dummy.rotation.set(0, s * thetaPerSector, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                this.floorMesh.setMatrixAt(idx++, dummy.matrix);
            }
        }
        this.group.add(this.floorMesh);

        // 3. Fragmented Walls (InstancedMesh)
        const wallLength = this.radius * 0.6;
        const wallHeight = this.floorHeight;

        const wallGeometry = new THREE.BoxGeometry(0.2, wallHeight, wallLength);
        const wallMaterial = new THREE.MeshPhongMaterial({ color: 0x555555 });

        const totalWalls = this.floorCount * this.sectorCount;
        this.wallMesh = new THREE.InstancedMesh(wallGeometry, wallMaterial, totalWalls);
        this.wallMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        idx = 0;
        const dist = this.radius * 0.7;

        for (let f = 0; f < this.floorCount; f++) {
            for (let s = 0; s < this.sectorCount; s++) {
                const angle = (s / this.sectorCount) * Math.PI * 2;

                dummy.position.x = Math.sin(angle) * dist;
                dummy.position.z = Math.cos(angle) * dist;
                dummy.position.y = (f * this.floorHeight) + (wallHeight / 2);

                dummy.rotation.set(0, angle, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                this.wallMesh.setMatrixAt(idx++, dummy.matrix);
            }
        }
        this.group.add(this.wallMesh);
    }

    updateStructureVisibility() {
        if (!this.floorMesh || !this.wallMesh) return;

        const dummy = new THREE.Object3D();

        const hiddenFloors = new Set();
        const hiddenWalls = new Set();

        for (const roomMesh of this.rooms.values()) {
            const r = roomMesh.userData.room;
            const { x, y, width, height } = r;

            // Internal Floors (Horizontal dividers)
            for (let f = y + 1; f < y + height; f++) {
                for (let i = 0; i < width; i++) {
                    const s = (x + i) % this.sectorCount;
                    hiddenFloors.add(`${f},${s}`);
                }
            }

            // Internal Walls (Vertical dividers)
            for (let f = y; f < y + height; f++) {
                for (let i = 1; i < width; i++) {
                    const s = (x + i) % this.sectorCount; // Wall at start of sector s (which is right of s-1)
                    hiddenWalls.add(`${f},${s}`);
                }
            }
        }

        // Apply Floors
        let idx = 0;
        const thetaPerSector = (2 * Math.PI) / this.sectorCount;

        for (let f = 0; f <= this.floorCount; f++) {
            for (let s = 0; s < this.sectorCount; s++) {
                const isHidden = hiddenFloors.has(`${f},${s}`);
                const scale = isHidden ? 0 : 1;

                dummy.position.set(0, f * this.floorHeight, 0);
                dummy.rotation.set(0, s * thetaPerSector, 0);
                dummy.scale.set(scale, scale, scale);
                dummy.updateMatrix();
                this.floorMesh.setMatrixAt(idx++, dummy.matrix);
            }
        }
        this.floorMesh.instanceMatrix.needsUpdate = true;

        // Apply Walls
        idx = 0;
        const wallHeight = this.floorHeight;
        const dist = this.radius * 0.7;

        for (let f = 0; f < this.floorCount; f++) {
            for (let s = 0; s < this.sectorCount; s++) {
                const isHidden = hiddenWalls.has(`${f},${s}`);
                const scale = isHidden ? 0 : 1;

                const angle = (s / this.sectorCount) * Math.PI * 2;

                dummy.position.x = Math.sin(angle) * dist;
                dummy.position.z = Math.cos(angle) * dist;
                dummy.position.y = (f * this.floorHeight) + (wallHeight / 2);

                dummy.rotation.set(0, angle, 0);
                dummy.scale.set(scale, scale, scale);
                dummy.updateMatrix();
                this.wallMesh.setMatrixAt(idx++, dummy.matrix);
            }
        }
        this.wallMesh.instanceMatrix.needsUpdate = true;
    }

    addRoom(room) {
        if (this.rooms.has(room.id)) {
            const oldMesh = this.rooms.get(room.id);
            this.group.remove(oldMesh);
        }

        const { x, y, width, height, data } = room;

        const thetaPerSector = (2 * Math.PI) / this.sectorCount;
        const roomThetaLength = width * thetaPerSector;
        const roomHeight = height * this.floorHeight;
        const startTheta = (x / this.sectorCount) * 2 * Math.PI;

        // Check for GIF
        const isPending = room.status === 'pending';
        const isGif = !isPending && data.imageUrl && data.imageUrl.toLowerCase().endsWith('.gif');
        let mesh;

        if (isGif) {
            // Recessed Plane (Chord)
            const chordWidth = 2 * this.radius * Math.sin(roomThetaLength / 2);
            const apothem = this.radius * Math.cos(roomThetaLength / 2); // Distance to chord
            const centerAngle = startTheta + (roomThetaLength / 2);

            // Plane geometry
            const geom = new THREE.PlaneGeometry(chordWidth, roomHeight - 0.5);

            // Material
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                side: THREE.DoubleSide
            });

            mesh = new THREE.Mesh(geom, mat);

            // Position and Rotate
            mesh.position.x = Math.sin(centerAngle) * apothem;
            mesh.position.z = Math.cos(centerAngle) * apothem;
            mesh.position.y = (y * this.floorHeight) + (roomHeight / 2);
            mesh.rotation.y = -centerAngle - Math.PI / 2; // Face outward? 

            // Adjust rotation logic if needed, seemed to work in original code as centerAngle
            mesh.rotation.y = centerAngle;

            // Load GIF using TextureManager
            this.textureManager.createGifTexture(data.imageUrl).then(gifObj => {
                if (gifObj) {
                    mesh.material.map = gifObj.texture;
                    mesh.material.needsUpdate = true;
                    if (!this.textureManager.activeGifs) this.textureManager.activeGifs = [];
                    // Store rendering state
                    mesh.userData.gifState = {
                        reader: gifObj.reader,
                        texture: gifObj.texture,
                        ctx: gifObj.ctx,
                        pixels: gifObj.pixels,
                        frame: 0,
                        accumTime: 0
                    };
                    this.textureManager.activeGifs.push(mesh);
                }
            });

        } else {
            // Curved Cylinder Panel (Existing Logic)
            const panelRadius = this.radius + 0.5;
            const geom = new THREE.CylinderGeometry(
                panelRadius, panelRadius,
                roomHeight - 0.5,
                Math.max(4, width * 2),
                1, true,
                startTheta, roomThetaLength
            );

            let color = 0xadd8e6;
            if (room.status === 'pending') {
                color = 0xffa500; // Orange for pending
            }

            // Create material immediately so we can reference it in error callback
            const mat = new THREE.MeshLambertMaterial({
                color: color,
                side: THREE.DoubleSide
            });

            if (room.status === 'pending') {
                mat.transparent = true;
                mat.opacity = 0.7;
            }

            if (!isPending && data.imageUrl) {
                mat.color.setHex(0xffffff);
                const loader = new THREE.TextureLoader();
                mat.map = loader.load(
                    data.imageUrl,
                    undefined, // onLoad
                    undefined, // onProgress
                    (err) => {
                        // On Error (e.g., CORS, 404)
                        console.error("Failed to load static image", data.imageUrl, err);
                        const errObj = this.textureManager.createErrorTexture("CORS ERR");
                        mat.map = errObj.texture;
                        mat.needsUpdate = true;
                    }
                );
                // Fix UVs since we have a texture
                this.textureManager.fixUVs(geom);
            }

            mesh = new THREE.Mesh(geom, mat);
            mesh.position.y = (y * this.floorHeight) + (roomHeight / 2);

            // if (data.imageUrl) this.textureManager.fixUVs(geom); // Moved upstream
        }

        mesh.userData = { isRoom: true, room: room, buildingId: this.id };

        if (isPending) {
            // Show "Reserved" instead of user text
            this.textureManager.createBanner("예약 중 (Reserved)", room);
        } else if (data.bannerText) {
            this.textureManager.createBanner(data.bannerText, room);
        }

        this.group.add(mesh);
        this.rooms.set(room.id, mesh);

        // Update structural visibility (Hide internal walls/floors)
        // Update structural visibility (Hide internal walls/floors)
        this.updateStructureVisibility();

        // Mark as occupied
        for (let i = 0; i < width; i++) {
            const s = (x + i) % this.sectorCount;
            for (let j = 0; j < height; j++) {
                const f = y + j;
                this.occupied.add(`${s}-${f}`);
            }
        }
    }

    rebuildEmptyLabels() {
        this.labelManager.rebuildEmptyLabels();
    }

    checkCollision(x, y, w, h, ignoreRoomId = null) {
        // Collect occupied cells to ignore
        const ignoreSet = new Set();
        if (ignoreRoomId && this.rooms.has(ignoreRoomId)) {
            const r = this.rooms.get(ignoreRoomId).userData.room;
            for (let i = 0; i < r.width; i++) {
                const s = (r.x + i) % this.sectorCount;
                for (let j = 0; j < r.height; j++) {
                    const f = r.y + j;
                    ignoreSet.add(`${s}-${f}`);
                }
            }
        }

        for (let i = 0; i < w; i++) {
            const s = (x + i) % this.sectorCount;
            for (let j = 0; j < h; j++) {
                const f = y + j;
                const key = `${s}-${f}`;
                if (this.occupied.has(key) && !ignoreSet.has(key)) return true;
            }
        }
        return false;
    }

    clearRooms() {
        for (const mesh of this.rooms.values()) {
            this.group.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
            if (mesh.material.map) mesh.material.map.dispose();
        }
        this.rooms.clear();
        this.occupied.clear();

        this.labelManager.clearLabels();
        this.textureManager.clearTextures();

        // Reset structural visibility
        this.updateStructureVisibility();
    }

    update(delta, camera) {
        return this.textureManager.update(delta, camera);
    }
}
