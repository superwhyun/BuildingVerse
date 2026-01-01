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
        this.elevationSpeed = 30.0; // Units per second

        window.addEventListener('keydown', (e) => this.onKeyDown(e), false);
        window.addEventListener('keyup', (e) => this.onKeyUp(e), false);
    }

    onKeyDown(event) {
        switch (event.key.toLowerCase()) {
            case 'w': this.keys.w = true; break;
            case 'a': this.keys.a = true; break;
            case 's': this.keys.s = true; break;
            case 'd': this.keys.d = true; break;
        }
    }

    onKeyUp(event) {
        switch (event.key.toLowerCase()) {
            case 'w': this.keys.w = false; break;
            case 'a': this.keys.a = false; break;
            case 's': this.keys.s = false; break;
            case 'd': this.keys.d = false; break;
        }
    }

    update(delta) {
        const activeBuilding = this.worldManager.buildings.get(this.worldManager.activeBuildingId);
        if (!activeBuilding) return false;

        let changed = false;

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
