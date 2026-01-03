export class Controls {
    constructor(camera, worldManager) {
        this.camera = camera;
        this.worldManager = worldManager;

        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false
        };

        this.rotationSpeed = 1.0; // Radians per second
        this.autoRotationSpeed = 0.15; // Slower clockwise rotation
        this.isAutoRotating = true;
        this.elevationSpeed = 30.0; // Units per second

        this.zoomSpeed = 0.5;
        this.minZoom = 150;
        this.maxZoom = 250;
        this.shouldRender = false;

        window.addEventListener('keydown', (e) => this.onKeyDown(e), false);
        window.addEventListener('keyup', (e) => this.onKeyUp(e), false);
        window.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    }

    onKeyDown(event) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

        // Stop auto-rotation on any movement key
        // if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
        //     this.isAutoRotating = false;
        // }

        switch (event.code) {
            case 'KeyW': this.keys.w = true; break;
            case 'KeyA': this.keys.a = true; break;
            case 'KeyS': this.keys.s = true; break;
            case 'KeyD': this.keys.d = true; break;
            case 'Space':
                if (!event.repeat) {
                    this.isAutoRotating = !this.isAutoRotating;
                }
                event.preventDefault();
                break;
        }
    }

    onKeyUp(event) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
        switch (event.code) {
            case 'KeyW': this.keys.w = false; break;
            case 'KeyA': this.keys.a = false; break;
            case 'KeyS': this.keys.s = false; break;
            case 'KeyD': this.keys.d = false; break;
        }
    }

    onWheel(event) {
        if (event.target.closest('#ui-layer') || event.target.closest('#room-modal')) return;
        event.preventDefault();

        // deltaY > 0: Scroll Down -> Zoom Out -> Increase Z
        // deltaY < 0: Scroll Up -> Zoom In -> Decrease Z
        const deltaZ = event.deltaY * this.zoomSpeed;

        this.camera.position.z += deltaZ;

        // Clamp
        if (this.camera.position.z < this.minZoom) this.camera.position.z = this.minZoom;
        if (this.camera.position.z > this.maxZoom) this.camera.position.z = this.maxZoom;

        this.shouldRender = true;
    }

    update(delta) {
        const activeBuilding = this.worldManager.buildings.get(this.worldManager.activeBuildingId);
        if (!activeBuilding) return false;

        let changed = this.shouldRender;
        this.shouldRender = false;

        // Rotation (A/D) - Rotate the BUILDING, not the camera
        // A: Rotate Right (Counter-Clockwise visual)
        // D: Rotate Left (Clockwise visual)
        if (this.keys.a) {
            activeBuilding.group.rotation.y += this.rotationSpeed * delta;
            changed = true;
        }
        if (this.keys.d) {
            activeBuilding.group.rotation.y -= this.rotationSpeed * delta;
            changed = true;
        }

        // Spacebar Toggle: Slow Clockwise Rotation
        // Only rotate if NO navigation keys are being pressed
        const isInteracting = this.keys.w || this.keys.a || this.keys.s || this.keys.d;
        if (this.isAutoRotating && !isInteracting) {
            activeBuilding.group.rotation.y -= this.autoRotationSpeed * delta;
            changed = true;
        }

        // Elevation (W/S) - Move Camera Y
        if (this.keys.w) {
            this.camera.position.y += this.elevationSpeed * delta;
            changed = true;
        }
        if (this.keys.s) {
            this.camera.position.y -= this.elevationSpeed * delta;
            changed = true;
        }

        return changed;
    }
}
