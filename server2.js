const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const path = require("path");
const nodemailer = require("nodemailer");
const multer = require("multer");
const fs = require("fs");

const app = express();
const port = 3000;
const cors = require("cors");
app.use(cors());
const session = require("express-session");




app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "hrmreg",
    password: "chintu",
    port: 5432,
});

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "jennyzoya2018@gmail.com",
        pass: "zlsntgmmijwpjvtn",
    }
});

// 🔹 Multer Setup for File Uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage: storage });
app.use("/uploads", express.static("uploads"));

// ✅ Serve "home.html" as Default Page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "home.html"));
});

// 🔹 Register Route
app.post("/register", async (req, res) => {
    const { user_id, f_name, email, password, conpass } = req.body;

    if (password !== conpass) {
        return res.json({ error: "Passwords do not match" });
    }

    try {
        const existingUser = await pool.query("SELECT * FROM register WHERE user_id = $1", [user_id]);
        if (existingUser.rows.length > 0) {
            return res.json({ error: "User ID already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            "INSERT INTO register (user_id, f_name, email, password) VALUES ($1, $2, $3, $4)",
            [user_id, f_name, email, hashedPassword]
        );

        // ✅ Send Confirmation Email
        const mailOptions = {
            from: "jennyzoya2018@gmail.com",
            to: email,
            subject: "Welcome to Our Platform!",
            html: `<h2>Hello ${f_name},</h2>
                   <p>Thank you for registering.</p>
                   <p>Your User ID: <strong>${user_id}</strong></p>
                   <a href="http://localhost:3000/chils.html" 
                     style="padding: 15px 30px; font-size: 18px; 
                            color: white; background-color:rgb(33, 153, 200);
                            text-decoration: none; border-radius: 8px;">
                      CLICK HERE TO LOGIN
                   </a>`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Email error:", error);
            } else {
                console.log("Email sent: " + info.response);
            }
        });

        res.json({ message: "Registration successful! Please log in." });
    } catch (err) {
        console.error(err);
        res.json({ error: "Error registering user" });
    }
});

// 🔹 Login Route
app.post("/login", async (req, res) => {
    const { user_id, password } = req.body;

    try {
        // Fetch user details from the database
        const result = await pool.query(
            "SELECT user_id, f_name FROM register WHERE user_id = $1 AND password = $2",
            [user_id, password]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        const user = result.rows[0];
        let redirectPage = "/chellam.html"; // Default for employees

        // Check if user is admin
        if (user_id === "U12101" && password === "pashupathi") {
            redirectPage = "/dashboard.html";
        }

        res.json({
            success: true,
            user_id: user.user_id,
            name: user.f_name,
            redirect: redirectPage
        });

    } catch (error) {
        console.error("❌ Login error:", error);
        res.status(500).json({ error: "Server error" });
    }
});
app.get("/attendance/:user_id", async (req, res) => {
    const { user_id } = req.params;

    try {
        const result = await pool.query(
            "SELECT date, status FROM attendance WHERE user_id = $1",
            [user_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("❌ Attendance fetch error:", error);
        res.status(500).json({ error: "Server error" });
    }
});



// 🔹 Add Employee
app.post("/add_employee", upload.single("profile_picture"), async (req, res) => {
    try {
        const { user_id, full_name, email, gender, phone, department, position, joining_date, address, country } = req.body;
        let profile_picture = req.file ? `/uploads/${req.file.filename}` : null;

        await pool.query(
            "INSERT INTO employee (user_id, full_name, gender, email, phone, department, position, joining_date, address, country, profile_picture) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
            [user_id, full_name, gender, email, phone, department, position, joining_date, address, country, profile_picture]
        );

        res.json({ message: "Employee added successfully!" });
    } catch (error) {
        console.error("Error inserting employee:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🔹 Get Employees
app.get("/employees", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT r.user_id, r.f_name AS full_name, r.email, 
                    e.gender, e.phone, e.department, e.position, 
                    e.joining_date, e.address, e.country, e.profile_picture
             FROM register r
             LEFT JOIN employee e ON r.user_id = e.user_id`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error fetching employees" });
    }
});

// 🔹 Edit Employee
app.put("/edit_employee/:user_id", upload.single("profile_picture"), async (req, res) => {
    try {
        const { user_id } = req.params;
        const { full_name, email, gender, phone, department, position, joining_date, address, country } = req.body;
        let profile_picture = req.file ? `/uploads/${req.file.filename}` : req.body.profile_picture || null;

        await pool.query(
            "UPDATE employee SET full_name=$1, email=$2, gender=$3, phone=$4, department=$5, position=$6, joining_date=$7, address=$8, country=$9, profile_picture=$10 WHERE user_id=$11",
            [full_name, email, gender, phone, department, position, joining_date, address, country, profile_picture, user_id]
        );

        res.json({ message: "Employee updated successfully!" });
    } catch (error) {
        console.error("Error updating employee:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🔹 Delete Employee
app.delete("/delete_employee/:user_id", async (req, res) => {
    try {
        const { user_id } = req.params;
        await pool.query("DELETE FROM employee WHERE user_id = $1", [user_id]);
        res.json({ message: "Employee deleted successfully!" });
    } catch (error) {
        console.error("Error deleting employee:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// 🔹 Fetch Employees for Performance Page

// Fetch Employees for Performance Page
app.post("/update_performance", async (req, res) => {
    try {
        const { user_id, full_name, department, position, tasks_completed, rating, review } = req.body;
        
        console.log("Received Data:", req.body);  // ✅ Logs the received data
        
        if (!user_id || !full_name || !department || !position) {
            console.log("❌ Missing required fields!");
            return res.status(400).json({ message: "Missing required fields" });
        }

        const query = `
            INSERT INTO performance (user_id, full_name, department, position, tasks_completed, rating, review)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id) DO UPDATE 
            SET tasks_completed = $5, rating = $6, review = $7
        `;

        await pool.query(query, [user_id, full_name, department, position, tasks_completed, rating, review]);

        console.log("✅ Performance updated successfully!");
        res.json({ message: "Performance updated successfully" });
    } catch (error) {
        console.error("❌ Error updating performance:", error.message);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});


// 🔹 Submit Single Attendance
app.post('/submit-attendance', async (req, res) => {
    const { user_id, full_name, department, attendance_status } = req.body;

    console.log("📥 Received Attendance Data:", req.body); // Debugging Log

    try {
        const result = await pool.query(
            `INSERT INTO present (user_id, full_name, department, attendance_status) 
             VALUES ($1, $2, $3, $4) RETURNING *;`,
            [user_id, full_name, department, attendance_status]
        );
        
        console.log("✅ Attendance Recorded:", result.rows[0]);
        res.status(201).json({ message: 'Attendance recorded successfully' });
    } catch (err) {
        console.error('❌ Error inserting attendance:', err);
        res.status(500).json({ error: 'Database error' });
    }
});
app.post("/addjob", async (req, res) => {
    try {
        console.log("Received job data:", req.body); // Debugging Log
        const { jobPosition, maxApplicants, accessibleTill, eligibilityCriteria } = req.body;

        const query = `
            INSERT INTO addjob (job_position, max_applicants, accessible_till, eligibility_criteria)
            VALUES ($1, $2, $3, $4) RETURNING *;
        `;
        const result = await pool.query(query, [jobPosition, maxApplicants, accessibleTill, eligibilityCriteria]);

        res.json({ message: "Job added successfully!", job: result.rows[0] });
    } catch (error) {
        console.error("Error adding job:", error);
        res.status(500).json({ message: "Error adding job" });
    }
});
app.get("/getjobs", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM addjob");
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching jobs:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/applyjob", upload.fields([{ name: "cv" }, { name: "resume" }]), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN"); // Start transaction

        const { jobPosition, fullName, email, phone } = req.body;
        const cvPath = req.files["cv"] ? req.files["cv"][0].path : null;
        const resumePath = req.files["resume"] ? req.files["resume"][0].path : null;

        console.log("📌 Preparing to insert:", jobPosition, fullName, email, phone, cvPath, resumePath);

        const result = await client.query(
            `INSERT INTO recruit (job_position, full_name, email, phone, cv, resume) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [jobPosition, fullName, email, phone, cvPath, resumePath]
        );

        console.log("✅ Inserted successfully:", result.rows);

        await client.query("COMMIT"); // Commit transaction
        res.json({ success: true, message: "Application submitted successfully!", data: result.rows[0] });
    } catch (error) {
        await client.query("ROLLBACK"); // Rollback on error
        console.error("❌ Error inserting data:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    } finally {
        client.release();
    }
});
app.post("/submit-leave", async (req, res) => {
    const client = await pool.connect();
    try {
        const { user_id, full_name, department, leave_type, starting_date, ending_date } = req.body;

        console.log("📌 Received Leave Request:", req.body);

        const result = await client.query(
            `INSERT INTO leaves (user_id, f_name, department, leave_type, starting_date, ending_date) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [user_id, full_name, department, leave_type, starting_date, ending_date]
        );

        console.log("✅ Leave request stored:", result.rows[0]);

        res.json({ success: true, message: "Leave request submitted successfully!" });
    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ success: false, message: "Failed to submit leave request" });
    } finally {
        client.release();
    }
});
app.get("/get-leaves", async (req, res) => {
    try {
        const query = "SELECT * FROM leaves ORDER BY id DESC";
        const result = await pool.query(query);
        res.json(result.rows); // ✅ Send data as JSON
    } catch (error) {
        console.error("Error fetching leave requests:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
app.post('/update-leave-status', (req, res) => {
    const { leave_id, status } = req.body;
    const query = 'UPDATE leaves SET status = $1 WHERE id = $2';

    pool.query(query, [status, leave_id], (err, result) => {
        if (err) {
            console.error('Error updating status:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true });
    });
});

app.get("/getAttendance", async (req, res) => {
    if (!req.session.user_id) {
        return res.json({ error: "Unauthorized" });
    }

    try {
        const result = await pool.query("SELECT * FROM present WHERE user_id = $1", [req.session.user_id]);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error fetching attendance:", err);
        res.status(500).send("Server error");
    }
});





// Start the server






  

// Start Server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
