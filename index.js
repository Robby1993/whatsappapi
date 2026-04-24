require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const sequelize = require("./db");
const User = require("./models/User");
const Session = require("./models/Session");
const authRoutes = require("./routes/auth");
const { router: whatsappRoutes, startSession } = require("./routes/whatsapp");
const { sessions, sessionStatus } = require("./sessionStore");
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

// Test Route to verify server is active
app.get("/ping", (req, res) => res.send("pong"));

// Routes
app.use("/auth", authRoutes);
app.use("/whatsapp", whatsappRoutes);
app.use("/admin", adminRoutes);
app.use("/api/v1", messagingRoutes);
app.use("/flows", flowRoutes);

// Startup
async function init() {
  try {
    console.log("🐘 Connecting to PostgreSQL...");

    await sequelize.authenticate();
    console.log("✅ PostgreSQL Connected Successfully");

    await sequelize.sync({ alter: true });
    console.log("💾 Database Synced");

    // Start Workers
    schedulerWorker(sessions, sessionStatus, startSession);
    queueWorker(sessions, sessionStatus, startSession);

    app.listen(PORT, "0.0.0.0", async () => {
      console.log(`🚀 Server running on port ${PORT}`);

      // 🚚 Auto-migrate filesystem sessions
      try {
        const sessionsDir = path.join(__dirname, "sessions");
        if (fs.existsSync(sessionsDir)) {
          const folders = fs.readdirSync(sessionsDir);
          for (const phone of folders) {
            const credsFile = path.join(sessionsDir, phone, "creds.json");
            if (fs.existsSync(credsFile)) {
              const exists = await Session.findOne({ where: { phone, dataType: "creds", dataId: "base" } });
              if (!exists) {
                const data = fs.readFileSync(credsFile, "utf-8");
                await Session.create({ phone, dataType: "creds", dataId: "base", data });
              }
            }
          }
        }
      } catch (e) {}

      // Restore active sessions
      try {
        const activeSessions = await Session.findAll({ where: { dataType: "creds", dataId: "base" } });
        for (const session of activeSessions) {
          startSession(session.phone);
        }
      } catch (e) {}
    });
  } catch (err) {
    console.error("❌ PostgreSQL Connection Error:", err.message);
    process.exit(1);
  }
}

init();
