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

// prioritize .env values
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/whatsappapi";
const PORT = process.env.PORT || 3000;

// Routes
app.use("/auth", authRoutes);
app.use("/whatsapp", whatsappRoutes);
app.use("/admin", adminRoutes);

// Startup
async function init() {
  try {
    console.log("⏳ Connecting to MongoDB...");

    // 5 seconds timeout to detect if service is off
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log("🍃 MongoDB Connected");

    const sessionsDir = path.join(__dirname, "sessions");
    if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

    // Start Workers
    schedulerWorker(sessions, sessionStatus, startSession);
    queueWorker(sessions, sessionStatus, startSession);

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);

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
    if (err.message.includes("ECONNREFUSED") || err.name === "MongooseServerSelectionError") {
       console.error("❌ MongoDB is NOT running at 127.0.0.1:27017.");
       console.log("👉 ACTION: Open 'Services' on your computer and start 'MongoDB Server'.");
     } else {
       console.error("❌ Startup error:", err.message);
     }
    process.exit(1);
  }
}

init();
