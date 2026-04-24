require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const sequelize = require("./db");
const User = require("./models/User");
const Session = require("./models/Session");
const Flow = require("./models/Flow");
const FlowNode = require("./models/FlowNode");
const FlowSession = require("./models/FlowSession");
const authRoutes = require("./routes/auth");
const { router: whatsappRoutes, startSession, sessions, sessionStatus } = require("./routes/whatsapp");
const adminRoutes = require("./routes/admin");
const messagingRoutes = require("./routes/messaging");
const flowRoutes = require("./flows/flow.routes");

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
app.use("/api/v1", messagingRoutes);
app.use("/flows", flowRoutes);

// Test Route to verify server is active
app.get("/ping", (req, res) => res.send("pong"));

// Startup
async function init() {
  try {
    console.log("🐘 Connecting to PostgreSQL...");

    await sequelize.authenticate();
    console.log("✅ PostgreSQL Connected Successfully");

    await sequelize.sync({ alter: true });
    console.log("💾 Database Synced (Alter Mode)");

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
    process.exit(1);
  }
}

init();
