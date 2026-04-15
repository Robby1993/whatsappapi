require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const sequelize = require("./db");
const User = require("./models/User");
const Session = require("./models/Session");
const authRoutes = require("./routes/auth");
const { router: whatsappRoutes, startSession, sessions, sessionStatus } = require("./routes/whatsapp");
const adminRoutes = require("./routes/admin");

const schedulerWorker = require("./workers/scheduler");
const queueWorker = require("./workers/queue");

const app = express();
app.use(express.json());
app.use(cors());

// prioritize .env values
const PORT = process.env.PORT || 3000;

// Routes
app.use("/auth", authRoutes);
app.use("/whatsapp", whatsappRoutes);
app.use("/admin", adminRoutes);

// Startup
async function init() {
  try {
    console.log("🐘 Connecting to PostgreSQL...");

    await sequelize.authenticate();
    console.log("✅ PostgreSQL Connected Successfully");

    // Sync database models (creates tables if they don't exist)
    await sequelize.sync({ alter: true });
    console.log("💾 Database Synced");

    // Start Workers
    schedulerWorker(sessions, sessionStatus, startSession);
    queueWorker(sessions, sessionStatus, startSession);

    app.listen(PORT, "0.0.0.0", async () => {
      console.log(`🚀 Server running on port ${PORT}`);

      // Restore active sessions from PostgreSQL Database
      try {
        const activeSessions = await Session.findAll({
          where: { dataType: "creds", dataId: "base" }
        });

        for (const session of activeSessions) {
          console.log(`🔄 Restoring session from DB: ${session.phone}`);
          startSession(session.phone);
        }
      } catch (e) {
        console.error("❌ Failed to restore sessions:", e.message);
      }
    });
  } catch (err) {
    console.error("❌ PostgreSQL Connection Error:", err.message);
    if (err.message.includes("ECONNREFUSED")) {
       console.log("👉 ACTION: Make sure your PostgreSQL server is running and the credentials in .env are correct.");
    }
    process.exit(1);
  }
}

init();
