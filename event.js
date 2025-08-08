const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// PostgreSQL database connection
const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "hrmreg",
    password: "chintu",
    port: 5432,
});

// Root route
app.get("/", (req, res) => {
    res.send("Welcome to the HIRIZE HRM Event Calendar API");
});

// Get all events
app.get("/events", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM events");
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: "Error fetching events", error });
    }
});

// Add an event
app.post("/add-event", async (req, res) => {
    const { date, title } = req.body;
    if (!date || !title) {
        return res.status(400).json({ message: "Date and title are required" });
    }
    try {
        await pool.query("INSERT INTO events (date, title) VALUES ($1, $2)", [date, title]);
        res.status(201).json({ message: "Event added successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error adding event", error });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

