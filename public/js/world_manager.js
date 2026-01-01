import { Building } from './building.js';

export class WorldManager {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.buildings = new Map(); // id -> Building instance
        this.activeBuildingId = null;
    }

    async loadBuildings() {
        try {
            const res = await fetch('/api/buildings');
            const data = await res.json();

            // If no buildings, create a default one for now
            if (data.length === 0) {
                await this.createDefaultBuilding();
            } else {
                for (const bData of data) {
                    this.addBuildingToScene(bData);
                }
            }
        } catch (e) {
            console.error("Failed to load buildings", e);
        }
    }

    async createDefaultBuilding() {
        const res = await fetch('/api/buildings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: "Main Tower",
                floorCount: 20,
                sectorCount: 40,
                radius: 100 // Double the size
            })
        });
        const bData = await res.json();
        this.addBuildingToScene(bData);
    }

    addBuildingToScene(bData) {
        const building = new Building(bData, this.sceneManager.scene);
        this.buildings.set(bData.id, building);
        this.activeBuildingId = bData.id;

        // Load rooms for this building
        this.loadRooms(bData.id);
    }

    async loadRooms(buildingId) {
        const res = await fetch(`/api/buildings/${buildingId}/rooms`);
        const rooms = await res.json();

        const building = this.buildings.get(buildingId);
        if (building) {
            building.clearRooms(); // Clear existing rooms to sync with DB
            rooms.forEach(room => building.addRoom(room));

            // Rebuild labels for empty slots only
            if (building.rebuildEmptyLabels) {
                building.rebuildEmptyLabels();
            }
            this.sceneManager.requestRender();
        }
    }

    update(delta) {
        let anyChanges = false;
        for (const building of this.buildings.values()) {
            if (building.update && building.update(delta, this.sceneManager.camera)) {
                anyChanges = true;
            }
        }
        if (anyChanges) {
            this.sceneManager.requestRender();
        }
    }
}
