import * as THREE from 'three';

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
        this.labels = []; // Array of label meshes

        this.initStructure();
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
                    // If room is sector 0,1. Wall at 1 is between 0 and 1.
                    // i=1 -> s=1. Correct.
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
        const isGif = data.imageUrl && data.imageUrl.toLowerCase().endsWith('.gif');
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
            // Plane normal is +Z. We want it facing along the radius vector.
            // At angle 0 (+X? or +Z?), normal should point that way.
            // If angle is 0, pos is (0,0,R). Normal should be (0,0,1). +Z.
            // Plane default normal is +Z. So rot=0 works for angle=0?
            // Wait, standard cylinder `startTheta=0` starts at +X in standard math, but Three.js?
            // Three.js Cylinder starts at +Z? 
            // In initStructure: `wall.position.x = sin(angle)*dist; z = cos(angle)*dist`.
            // Angle 0 -> x=0, z=dist. (+Z).
            // So Angle 0 is +Z axis.
            // Plane at Angle 0 should be at (0, 0, Apothem). Facing +Z.
            // Rotation should be 0.
            // At Angle 90 (+X), pos (Apothem, 0, 0). Facing +X. Rotation -90? (Three.JS Y-rot is counter-clockwise?)
            // `mesh.rotation.y = centerAngle`.
            // Let's try `centerAngle`.

            mesh.rotation.y = centerAngle;

            // Load GIF
            this.createGifTexture(data.imageUrl).then(gifObj => {
                if (gifObj) {
                    mesh.material.map = gifObj.texture;
                    mesh.material.needsUpdate = true;
                    if (!this.activeGifs) this.activeGifs = [];
                    // Store rendering state
                    mesh.userData.gifState = {
                        reader: gifObj.reader,
                        texture: gifObj.texture,
                        ctx: gifObj.ctx,
                        pixels: gifObj.pixels,
                        frame: 0,
                        accumTime: 0
                    };
                    this.activeGifs.push(mesh);
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
            let map = null;

            if (data.imageUrl) {
                const loader = new THREE.TextureLoader();
                map = loader.load(data.imageUrl);
                color = 0xffffff;
            }

            const mat = new THREE.MeshLambertMaterial({
                color: color,
                map: map,
                side: THREE.DoubleSide
            });

            mesh = new THREE.Mesh(geom, mat);
            mesh.position.y = (y * this.floorHeight) + (roomHeight / 2);

            if (data.imageUrl) this.fixUVs(geom);
        }

        mesh.userData = { isRoom: true, room: room, buildingId: this.id };

        if (data.bannerText) {
            this.createBanner(data.bannerText, room);
        }

        this.group.add(mesh);
        this.rooms.set(room.id, mesh);

        // Update structural visibility (Hide internal walls/floors)
        this.updateStructureVisibility();
    }

    rebuildEmptyLabels() {
        // 1. Clear existing labels
        for (const mesh of this.labels) {
            this.group.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (mesh.material.map) mesh.material.map.dispose();
                mesh.material.dispose();
            }
        }
        this.labels = [];

        // 2. Map Occupied Slots
        this.occupied = new Set();
        for (const roomMesh of this.rooms.values()) {
            const r = roomMesh.userData.room;
            for (let h = 0; h < r.height; h++) {
                const f = r.y + h;
                for (let w = 0; w < r.width; w++) {
                    const s = (r.x + w) % this.sectorCount;
                    this.occupied.add(`${s}-${f}`);
                }
            }
        }

        // 3. Create Labels for Empty Slots
        const thetaPerSector = (2 * Math.PI) / this.sectorCount;

        for (let f = 0; f < this.floorCount; f++) {
            for (let s = 0; s < this.sectorCount; s++) {
                if (this.occupied.has(`${s}-${f}`)) continue;

                const text = `${f},${s}`;
                const tex = this.createLabelTexture(text);

                const startTheta = (s / this.sectorCount) * 2 * Math.PI;

                const geom = new THREE.CylinderGeometry(
                    this.radius + 0.05,
                    this.radius + 0.05,
                    this.floorHeight * 0.8,
                    4, 1, true,
                    startTheta, thetaPerSector
                );
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
                const posY = (f * this.floorHeight) + (this.floorHeight / 2);
                mesh.position.y = posY;

                mesh.raycast = () => { };

                this.group.add(mesh);
                this.labels.push(mesh);
            }
        }
    }

    checkCollision(x, y, w, h) {
        if (!this.occupied) return false;

        for (let i = 0; i < w; i++) {
            const s = (x + i) % this.sectorCount;
            for (let j = 0; j < h; j++) {
                const f = y + j;
                if (this.occupied.has(`${s}-${f}`)) return true;
            }
        }
        return false;
    }

    fixUVs(geometry) {
        const uvs = geometry.attributes.uv;
        const count = uvs.count;

        // Calculate min/max theta to normalize u
        let minU = 1, maxU = 0;
        for (let i = 0; i < count; i++) {
            const u = uvs.getX(i);
            if (u < minU) minU = u;
            if (u > maxU) maxU = u;
        }

        for (let i = 0; i < count; i++) {
            const u = uvs.getX(i);
            // Remap minU..maxU to 0..1
            const newU = (u - minU) / (maxU - minU);
            uvs.setX(i, newU);
        }
        uvs.needsUpdate = true;
    }

    clearRooms() {
        for (const mesh of this.rooms.values()) {
            this.group.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
            if (mesh.material.map) mesh.material.map.dispose();
        }
        this.rooms.clear();

        // Clear Labels
        for (const mesh of this.labels) {
            this.group.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (mesh.material.map) mesh.material.map.dispose();
                mesh.material.dispose();
            }
        }
        this.labels = [];

        // Clear Banners
        if (this.banners) {
            for (const mesh of this.banners) {
                this.group.remove(mesh);
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) {
                    if (mesh.material.map) mesh.material.map.dispose();
                    mesh.material.dispose();
                }
            }
        }
        this.banners = [];
        this.activeGifs = [];

        // Reset structural visibility
        this.updateStructureVisibility();
    }

    createBanner(bannerText, roomGeoParams) {
        if (!this.banners) this.banners = [];

        const { x, width, height } = roomGeoParams;
        const thetaPerSector = (2 * Math.PI) / this.sectorCount;
        const roomThetaLength = width * thetaPerSector;
        const startTheta = (x / this.sectorCount) * 2 * Math.PI;

        // Banner geometry - Bottom 1/4 of room
        const roomHeightUnits = height * this.floorHeight;
        const bannerHeight = roomHeightUnits * 0.25;
        const radius = this.radius + 0.55; // Slightly in front of room

        const geom = new THREE.CylinderGeometry(
            radius, radius,
            bannerHeight,
            Math.max(4, width * 2),
            1, true,
            startTheta, roomThetaLength
        );
        this.fixUVs(geom);

        // Texture with text
        const ctxPre = document.createElement('canvas').getContext('2d');
        ctxPre.font = 'bold 80px sans-serif';
        const textMetrics = ctxPre.measureText(bannerText + "   ");
        const textWidth = textMetrics.width;

        const meshNominalWidth = 512 * width;
        const canvasWidth = Math.max(meshNominalWidth, textWidth + 100);

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = 128; // height is fixed resolution-wise
        const ctx = canvas.getContext('2d');

        // Background - Transparent or semi-transparent
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Text
        ctx.font = 'bold 80px sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        ctx.fillText(bannerText + "   ", 0, canvas.height / 2);

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        // Scale repeat to show correct portion
        tex.repeat.set(meshNominalWidth / canvasWidth, 1);

        const mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geom, mat);

        // Position Y: Bottom 1/4
        const f = roomGeoParams.y;
        const posY = (f * this.floorHeight) + (bannerHeight / 2) + 0.1; // +0.1 padding from floor
        mesh.position.y = posY;

        // Store for update
        mesh.userData.isBanner = true;
        mesh.userData.angle = startTheta + (roomThetaLength / 2); // Center angle for occlusion

        this.group.add(mesh);
        this.banners.push(mesh);
    }

    createGifTexture(url) {
        return new Promise((resolve) => {
            fetch(url)
                .then(res => res.arrayBuffer())
                .then(buffer => {
                    const array = new Uint8Array(buffer);
                    let GifReader = window.GifReader || (window.omggif ? window.omggif.GifReader : null);

                    if (!GifReader) {
                        console.error("omggif not found");
                        resolve(null);
                        return;
                    }

                    const reader = new GifReader(array);
                    const width = reader.width;
                    const height = reader.height;

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    const pixels = ctx.createImageData(width, height);

                    // Decode frame 0
                    reader.decodeAndBlitFrameRGBA(0, pixels.data);
                    ctx.putImageData(pixels, 0, 0);

                    const tex = new THREE.CanvasTexture(canvas);
                    tex.colorSpace = THREE.SRGBColorSpace;
                    tex.minFilter = THREE.LinearFilter;

                    resolve({
                        reader,
                        texture: tex,
                        ctx,
                        pixels,
                        frame: 0,
                        accumTime: 0
                    });
                })
                .catch(err => {
                    console.error("Failed to load GIF", err);
                    resolve(null);
                });
        });
    }

    update(delta, camera) {
        let needsRender = false;

        // 1. Update Banners
        if (this.banners && this.banners.length > 0) {
            for (const mesh of this.banners) {
                let isVisible = true;
                if (camera) {
                    const bannerAngle = mesh.userData.angle;
                    const totalAngle = bannerAngle + this.group.rotation.y;
                    const camPosLocal = camera.position.clone().sub(this.group.position);
                    const camAngle = Math.atan2(camPosLocal.x, camPosLocal.z);
                    let diff = Math.abs(totalAngle - camAngle);
                    diff = diff % (2 * Math.PI);
                    if (diff > Math.PI) diff = 2 * Math.PI - diff;
                    if (diff > Math.PI / 2 + 0.2) isVisible = false;
                }

                if (isVisible) {
                    if (mesh.material.map) {
                        mesh.material.map.offset.x += 0.16 * delta;
                    }
                    needsRender = true;
                }
            }
        }

        // 2. Update GIFs
        if (this.activeGifs && this.activeGifs.length > 0) {
            for (const mesh of this.activeGifs) {
                const state = mesh.userData.gifState;
                if (!state) continue;

                let isVisible = true;
                if (camera) {
                    const gifAngle = mesh.rotation.y; // Centered angle set during creation
                    const totalAngle = gifAngle + this.group.rotation.y;

                    const camPosLocal = camera.position.clone().sub(this.group.position);
                    const camAngle = Math.atan2(camPosLocal.x, camPosLocal.z);
                    let diff = Math.abs(totalAngle - camAngle);
                    diff = diff % (2 * Math.PI);
                    if (diff > Math.PI) diff = 2 * Math.PI - diff;

                    if (diff > Math.PI / 2 + 0.3) isVisible = false;
                }

                if (isVisible) {
                    state.accumTime += delta;
                    const frameInfo = state.reader.frameInfo(state.frame);
                    const delay = (frameInfo.delay || 10) * 0.01;

                    if (state.accumTime >= delay) {
                        state.accumTime -= delay;
                        state.frame = (state.frame + 1) % state.reader.numFrames();

                        state.reader.decodeAndBlitFrameRGBA(state.frame, state.pixels.data);
                        state.ctx.putImageData(state.pixels, 0, 0);
                        state.texture.needsUpdate = true;
                    }
                    needsRender = true;
                }
            }
        }

        return needsRender;
    }
}
