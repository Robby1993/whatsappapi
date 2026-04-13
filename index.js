require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const User = require("./models/User");
const authRoutes = require("./routes/auth");
const { router: whatsappRoutes, startSession, sessions, sessionStatus } = require("./routes/whatsapp");
const adminRoutes = require("./routes/admin");

const schedulerWorker = require("./workers/scheduler");
const queueWorker = require("./workers/queue");

const app = express();
app.use(express.json());
app.use(cors());

// prioritize .env values.
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/whatsappapi";
const PORT = process.env.PORT || 3000;

// Routes
app.use("/auth", authRoutes);
app.use("/whatsapp", whatsappRoutes);
app.use("/admin", adminRoutes);

/**
 * Automatically clears unused, broken, or orphaned session folders
 */
async function cleanupSessions() {
  const sessionsDir = path.join(__dirname, "sessions");
  if (!fs.existsSync(sessionsDir)) return;

  const folders = fs.readdirSync(sessionsDir);
  console.log("🔍 Running session cleanup...");

  for (const folder of folders) {
    const folderPath = path.join(sessionsDir, folder);

    // Process only directories
    if (fs.lstatSync(folderPath).isDirectory()) {
      const credsPath = path.join(folderPath, "creds.json");

      // 1. Delete if creds.json is missing (Broken/Failed link)
      if (!fs.existsSync(credsPath)) {
        console.log(`🧹 Deleting broken session: ${folder} (missing creds.json)`);
        fs.rmSync(folderPath, { recursive: true, force: true });
        continue;
      }

      // 2. Delete if the folder (phone number) does not exist in the Users database (Orphaned)
      // Note: This requires the folder name to be exactly the phone number.
      try {
        const userExists = await User.findOne({ number: folder });
        if (!userExists) {
          console.log(`🧹 Deleting orphaned session: ${folder} (User not found in DB)`);
          fs.rmSync(folderPath, { recursive: true, force: true });
        }
      } catch (e) {
        console.error(`Error checking DB for session ${folder}:`, e.message);
      }
    }
  }
}

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

    // Clean up unnecessary session folders before starting workers or restoring
    await cleanupSessions();

    // Start Workers
    schedulerWorker(sessions, sessionStatus, startSession);
    queueWorker(sessions, sessionStatus, startSession);

    // Use "0.0.0.0" to ensure it's accessible on cloud platforms like Render
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);

      // Restore valid sessions
      if (fs.existsSync(sessionsDir)) {
        fs.readdirSync(sessionsDir).forEach(phone => {
          const folderPath = path.join(sessionsDir, phone);
          if (fs.lstatSync(folderPath).isDirectory()) {
            const creds = path.join(folderPath, "creds.json");
            if (fs.existsSync(creds)) {
              console.log(`🔄 Restoring session: ${phone}`);
              startSession(phone);
            }
          }
        });
      }
    });
  } catch (err) {
    console.error("❌ Startup Error:", err.message);
    if (err.message.includes("ECONNREFUSED") || err.name === "MongooseServerSelectionError") {
       console.log("\n💡 TIP: Local MongoDB is off OR Render needs MONGODB_URI env var.");
    }
    process.exit(1);
  }
}

init();
