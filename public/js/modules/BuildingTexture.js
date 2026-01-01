import * as THREE from 'three';

export class BuildingTexture {
    constructor(building) {
        this.building = building;
        this.banners = [];
        this.activeGifs = [];
    }

    createBanner(bannerText, roomGeoParams) {
        const { x, width, height } = roomGeoParams;
        const thetaPerSector = (2 * Math.PI) / this.building.sectorCount;
        const roomThetaLength = width * thetaPerSector;
        const startTheta = (x / this.building.sectorCount) * 2 * Math.PI;

        // Banner geometry - 20% of the TOTAL room height
        const roomTotalHeight = height * this.building.floorHeight;
        const bannerHeight = roomTotalHeight * 0.2;
        const radius = this.building.radius + 0.55; // Slightly in front of room

        const geom = new THREE.CylinderGeometry(
            radius, radius,
            bannerHeight,
            Math.max(4, width * 2),
            1, true,
            startTheta, roomThetaLength
        );
        this.fixUVs(geom);

        // Calculate Text Resolution to match Physical Aspect Ratio (Avoid Distortion)
        // Horizontal: 512px per sector width
        // Vertical: Need corresponding pixels to keep 1:1 aspect ratio

        // Physical Width of 1 sector = radius * thetaPerSector
        const sectorArcLength = this.building.radius * thetaPerSector;
        const pixelsPerUnit = 512 / sectorArcLength;

        // Canvas Height needed to maintain square pixels
        const targetCanvasHeight = Math.round(bannerHeight * pixelsPerUnit);

        // Clamp min height for readability on very small rooms if needed, but scaling is preferred
        const canvasHeight = Math.max(64, targetCanvasHeight);

        // Font size proportional to canvas height (approx 70% of height)
        const fontSize = Math.floor(canvasHeight * 0.7);

        // Texture with text
        const ctxPre = document.createElement('canvas').getContext('2d');
        ctxPre.font = `bold ${fontSize}px sans-serif`;
        const textMetrics = ctxPre.measureText(bannerText + "   ");
        const textWidth = textMetrics.width;

        const meshNominalWidth = 512 * width;
        const canvasWidth = Math.max(meshNominalWidth, textWidth + canvasHeight); // Add padding relative to height

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');

        // Background - Transparent or semi-transparent
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Text
        ctx.font = `bold ${fontSize}px sans-serif`;
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

        // Position Y: Bottom 20% area centered
        // Room spans from [f * h] to [f * h + roomTotalHeight]
        // Bottom 20% center is at 0.1 of roomTotalHeight relative to bottom
        const f = roomGeoParams.y;
        const roomBottomY = f * this.building.floorHeight;
        const posY = roomBottomY + (bannerHeight / 2) + 0.1; // +0.1 padding from floor
        mesh.position.y = posY;

        // Store for update
        mesh.userData.isBanner = true;
        mesh.userData.angle = startTheta + (roomThetaLength / 2); // Center angle for occlusion

        this.building.group.add(mesh);
        this.banners.push(mesh);
    }

    createGifTexture(url) {
        return new Promise((resolve) => {
            fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.arrayBuffer();
                })
                .then(buffer => {
                    const array = new Uint8Array(buffer);
                    let GifReader = window.GifReader || (window.omggif ? window.omggif.GifReader : null);

                    if (!GifReader) {
                        console.error("omggif not found");
                        resolve(this.createErrorTexture("LIB ERR"));
                        return;
                    }

                    try {
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
                    } catch (parseErr) {
                        console.error("Failed to parse GIF", parseErr);
                        resolve(this.createErrorTexture("PARSE ERR"));
                    }
                })
                .catch(err => {
                    console.error("Failed to load GIF", err);
                    // Assume CORS or Network error
                    resolve(this.createErrorTexture("CORS ERR"));
                });
        });
    }

    createErrorTexture(text) {
        const width = 256;
        const height = 256;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Black background
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);

        // Red text
        ctx.font = 'bold 40px sans-serif';
        ctx.fillStyle = 'red';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, width / 2, height / 2);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;

        // Return structure compatible with GIF object but static
        return {
            reader: null, // No reader
            texture: tex,
            ctx: ctx,
            pixels: null,
            frame: 0,
            accumTime: 0
        };
    }

    update(delta, camera) {
        let needsRender = false;

        // 1. Update Banners
        if (this.banners && this.banners.length > 0) {
            for (const mesh of this.banners) {
                let isVisible = true;
                if (camera) {
                    const bannerAngle = mesh.userData.angle;
                    const totalAngle = bannerAngle + this.building.group.rotation.y;
                    const camPosLocal = camera.position.clone().sub(this.building.group.position);
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
                    const totalAngle = gifAngle + this.building.group.rotation.y;

                    const camPosLocal = camera.position.clone().sub(this.building.group.position);
                    const camAngle = Math.atan2(camPosLocal.x, camPosLocal.z);
                    let diff = Math.abs(totalAngle - camAngle);
                    diff = diff % (2 * Math.PI);
                    if (diff > Math.PI) diff = 2 * Math.PI - diff;

                    if (diff > Math.PI / 2 + 0.3) isVisible = false;
                }

                if (isVisible) {
                    // Static textures (like error images) have no reader, so skip animation
                    if (!state.reader) continue;

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

    clearTextures() {
        // Clear Banners
        for (const mesh of this.banners) {
            this.building.group.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (mesh.material.map) mesh.material.map.dispose();
                mesh.material.dispose();
            }
        }
        this.banners = [];
        this.activeGifs = [];
    }

    // Duplicate fixUVs here as well or make it a static util. 
    // Implementing directly for now.
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
