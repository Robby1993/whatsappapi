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

// MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/whatsappapi";

// Routes
app.use("/auth", authRoutes);
app.use("/whatsapp", whatsappRoutes);
app.use("/admin", adminRoutes);

// Startup
async function init() {
  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("🍃 MongoDB Connected");

    const sessionsDir = path.join(__dirname, "sessions");
    if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

    // Start Workers
    schedulerWorker(sessions, sessionStatus, startSession);
    queueWorker(sessions, sessionStatus, startSession);

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);

      // Restore sessions
      fs.readdirSync(sessionsDir).forEach(phone => {
        const creds = path.join(sessionsDir, phone, "creds.json");
        if (fs.existsSync(creds)) {
          console.log(`🔄 Restoring session: ${phone}`);
          startSession(phone);
        }
      });
    });
  } catch (err) {
  //  console.error("Startup error:", err.message);
    if (err.message.includes("ECONNREFUSED")) {
       console.error("MongoDB is not running. Start it and retry.");
     } else {
       console.error("Startup error:", err.message);
     }

    process.exit(1);
  }
}

init();
