-- Buildings table: Stores physical properties and location of each building
CREATE TABLE IF NOT EXISTS buildings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    x REAL NOT NULL DEFAULT 0,
    z REAL NOT NULL DEFAULT 0,
    radius REAL NOT NULL DEFAULT 50,
    floorCount INTEGER NOT NULL DEFAULT 10,
    sectorCount INTEGER NOT NULL DEFAULT 20,
    floorHeight REAL NOT NULL DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rooms table: Stores content and grid position for each room
CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buildingId INTEGER NOT NULL,
    x INTEGER NOT NULL, -- horizontal grid index (sector)
    y INTEGER NOT NULL, -- vertical grid index (floor)
    width INTEGER NOT NULL DEFAULT 1, -- horizontal span
    height INTEGER NOT NULL DEFAULT 1, -- vertical span
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    data TEXT, -- JSON string for flexible metadata (url, imageUrl, title, description)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (buildingId) REFERENCES buildings(id)
);
