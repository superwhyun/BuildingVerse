const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const SqliteRepository = require('./db/sqlite-repo');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Database setup
const db = new SqliteRepository();

// --- API Routes ---

// 1. Get all buildings
app.get('/api/buildings', async (req, res) => {
    try {
        const buildings = await db.getAllBuildings();
        res.json(buildings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Create a new building
app.post('/api/buildings', async (req, res) => {
    try {
        const id = await db.createBuilding(req.body);
        const newBuilding = await db.getBuildingById(id);
        res.status(201).json(newBuilding);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Update building (resize, move, etc.)
app.patch('/api/buildings/:id', async (req, res) => {
    try {
        await db.updateBuilding(req.params.id, req.body);
        const updated = await db.getBuildingById(req.params.id);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Get rooms for a building
app.get('/api/buildings/:id/rooms', async (req, res) => {
    try {
        const rooms = await db.getRoomsByBuildingId(req.params.id);
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Create a room in a building
app.post('/api/rooms', async (req, res) => {
    try {
        const id = await db.createRoom(req.body);
        res.status(201).json({ id, ...req.body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Update a room
app.put('/api/rooms/:id', async (req, res) => {
    try {
        await db.updateRoom(req.params.id, req.body);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Delete a room
app.delete('/api/rooms/:id', async (req, res) => {
    try {
        await db.deleteRoom(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
db.connect().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error("Failed to start server:", err);
});
