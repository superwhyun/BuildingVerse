/**
 * Interface/Abstract class for Database Repository
 * Allows switching between SQLite, MySQL, Postgres, etc.
 */
class DatabaseRepository {
    constructor() {
        if (this.constructor === DatabaseRepository) {
            throw new Error("Cannot instantiate abstract class DatabaseRepository");
        }
    }

    async connect() { throw new Error("Method 'connect' must be implemented."); }
    async close() { throw new Error("Method 'close' must be implemented."); }

    /**
     * @returns {Promise<Building[]>}
     */
    async getAllBuildings() { throw new Error("Method 'getAllBuildings' must be implemented."); }

    /**
     * @param {number} id
     * @returns {Promise<Building>}
     */
    async getBuildingById(id) { throw new Error("Method 'getBuildingById' must be implemented."); }

    /**
     * @param {Object} buildingData - { name, x, z, radius, floorCount, sectorCount, floorHeight }
     * @returns {Promise<number>} - New Building ID
     */
    async createBuilding(buildingData) { throw new Error("Method 'createBuilding' must be implemented."); }

    /**
     * @param {number} id
     * @param {Object} updates - fields to update
     */
    async updateBuilding(id, updates) { throw new Error("Method 'updateBuilding' must be implemented."); }


    /**
     * @param {number} buildingId
     * @returns {Promise<Room[]>}
     */
    async getRoomsByBuildingId(buildingId) { throw new Error("Method 'getRoomsByBuildingId' must be implemented."); }

    /**
     * @param {Object} roomData - { buildingId, x, y, width, height, data }
     * @returns {Promise<number>} - New Room ID
     */
    async createRoom(roomData) { throw new Error("Method 'createRoom' must be implemented."); }

    /**
     * @param {number} id
     * @param {Object} roomData
     */
    async updateRoom(id, roomData) { throw new Error("Method 'updateRoom' must be implemented."); }

    /**
     * @param {number} id
     */
    async deleteRoom(id) { throw new Error("Method 'deleteRoom' must be implemented."); }
}

module.exports = DatabaseRepository;
