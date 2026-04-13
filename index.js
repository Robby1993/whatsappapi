require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const authRoutes = require("./routes/auth");
const { router: whatsappRoutes, startSession, sessions, sessionStatus } = require("./routes/whatsapp");
const adminRoutes = require("./routes/admin");

const schedulerWorker = require("./workers/scheduler");
const queueWorker = require("./workers/queue");

const app = express();
app.use(express.json());
app.use(cors());

// prioritize .env values. On Render, set MONGODB_URI in the Environment Variables dashboard.
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://robinsonmacwan93_db_user:<db_password>@cluster0.0g318ha.mongodb.net/?appName=Cluster0";
const PORT = process.env.PORT || 3000;

// Routes
app.use("/auth", authRoutes);
app.use("/whatsapp", whatsappRoutes);
app.use("/admin", adminRoutes);

// Startup
async function init() {
  try {
    console.log("⏳ Connecting to MongoDB...");

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log("🍃 MongoDB Connected Successfully");

    const sessionsDir = path.join(__dirname, "sessions");
    if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

    // Start Workers
    schedulerWorker(sessions, sessionStatus, startSession);
    queueWorker(sessions, sessionStatus, startSession);

    // Use "0.0.0.0" to ensure it's accessible on cloud platforms like Render
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);

      // Restore sessions
      if (fs.existsSync(sessionsDir)) {
        fs.readdirSync(sessionsDir).forEach(phone => {
          const creds = path.join(sessionsDir, phone, "creds.json");
          if (fs.existsSync(creds)) {
            console.log(`🔄 Restoring session: ${phone}`);
            startSession(phone);
          }
        });
      }
    });
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);

    if (MONGODB_URI.includes("127.0.0.1") || MONGODB_URI.includes("localhost")) {
       console.log("\n💡 TIP: You are trying to connect to a local DB. If you are on Render, you MUST use MongoDB Atlas.");
       console.log("👉 ACTION: Add MONGODB_URI to your Render Environment Variables.");
    }

    process.exit(1);
  }
}

init();
