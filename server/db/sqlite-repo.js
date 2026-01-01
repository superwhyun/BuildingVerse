const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const DatabaseRepository = require('./database');

class SqliteRepository extends DatabaseRepository {
    constructor(dbPath) {
        super();
        this.dbPath = dbPath || path.resolve(__dirname, 'buildingverse.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Could not connect to database', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.initSchema().then(resolve).catch(reject);
                }
            });
        });
    }

    async initSchema() {
        const schemaPath = path.resolve(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        return new Promise((resolve, reject) => {
            this.db.exec(schema, (err) => {
                if (err) {
                    console.error('Schema initialization failed', err);
                    reject(err);
                } else {
                    console.log('Schema initialized');
                    resolve();
                }
            });
        });
    }

    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // --- Building Operations ---

    async getAllBuildings() {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM buildings", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async getBuildingById(id) {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT * FROM buildings WHERE id = ?", [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async createBuilding(data) {
        const { name, x, z, radius, floorCount, sectorCount, floorHeight } = data;
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO buildings (name, x, z, radius, floorCount, sectorCount, floorHeight) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            this.db.run(sql, [name, x || 0, z || 0, radius || 50, floorCount || 10, sectorCount || 20, floorHeight || 10], function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async updateBuilding(id, updates) {
        // Construct dynamic UPDATE query
        const keys = Object.keys(updates);
        if (keys.length === 0) return Promise.resolve();

        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => updates[k]);
        values.push(id);

        return new Promise((resolve, reject) => {
            const sql = `UPDATE buildings SET ${setClause} WHERE id = ?`;
            this.db.run(sql, values, function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    // --- Room Operations ---

    async getRoomsByBuildingId(buildingId) {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM rooms WHERE buildingId = ?", [buildingId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Parse 'data' JSON field
                    const parsed = rows.map(r => {
                        try {
                            r.data = JSON.parse(r.data);
                        } catch (e) {
                            r.data = {};
                        }
                        return r;
                    });
                    resolve(parsed);
                }
            });
        });
    }

    async createRoom(data) {
        const { buildingId, x, y, width, height, data: metaData } = data;
        const jsonStr = JSON.stringify(metaData || {});
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO rooms (buildingId, x, y, width, height, data) VALUES (?, ?, ?, ?, ?, ?)`;
            this.db.run(sql, [buildingId, x, y, width, height, jsonStr], function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async updateRoom(id, data) {
        // Construct dynamic UPDATE query
        const keys = Object.keys(data);
        if (keys.length === 0) return Promise.resolve();

        const setClause = keys.map(k => {
            if (k === 'data') return `data = ?`;
            return `${k} = ?`;
        }).join(', ');

        const values = keys.map(k => {
            if (k === 'data') return JSON.stringify(data[k]);
            return data[k];
        });
        values.push(id);

        return new Promise((resolve, reject) => {
            const sql = `UPDATE rooms SET ${setClause} WHERE id = ?`;
            this.db.run(sql, values, function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    async deleteRoom(id) {
        return new Promise((resolve, reject) => {
            this.db.run("DELETE FROM rooms WHERE id = ?", [id], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }
}

module.exports = SqliteRepository;
