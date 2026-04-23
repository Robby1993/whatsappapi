require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

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

    // Manually drop the old unique constraint on 'number' if it exists
    // This allows same number for different user types without losing data
    /*try {
      await sequelize.query('ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS "Users_number_key"');
      await sequelize.query('ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS "Users_number_key11"');
      console.log("🛠  Cleaned up old unique constraints.");
    } catch (e) {
      console.log("⚠️  Note: No old constraints found or already removed.");
    }
*/
    /**
     * DATABASE SYNC LOGIC
     */
    const FORCE_REBUILD = false;

    await sequelize.sync({ force: FORCE_REBUILD, alter: !FORCE_REBUILD });
    console.log(`💾 Database Synced (Force: ${FORCE_REBUILD})`);

    // Start Workers
    schedulerWorker(sessions, sessionStatus, startSession);
    queueWorker(sessions, sessionStatus, startSession);

    app.listen(PORT, "0.0.0.0", async () => {
      console.log(`🚀 Server running on port ${PORT}`);

      // 🚚 Auto-migrate filesystem sessions to Database (if any)
      try {
        const sessionsDir = path.join(__dirname, "sessions");
        if (fs.existsSync(sessionsDir)) {
          const folders = fs.readdirSync(sessionsDir);
          for (const phone of folders) {
            const credsFile = path.join(sessionsDir, phone, "creds.json");
            if (fs.existsSync(credsFile)) {
              const exists = await Session.findOne({ where: { phone, dataType: "creds", dataId: "base" } });
              if (!exists) {
                console.log(`🚚 Migrating session for ${phone} from filesystem to Database...`);
                const data = fs.readFileSync(credsFile, "utf-8");
                await Session.create({ phone, dataType: "creds", dataId: "base", data });
              }
            }
          }
        }
      } catch (e) {
        console.error("⚠️ Migration error:", e.message);
      }

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

    // --- GRACEFUL SHUTDOWN ---
    const shutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}, closing sessions...`);
      for (const phone in sessions) {
        try {
          if (sessions[phone].ws?.readyState === 1) {
            await sessions[phone].end();
          }
        } catch (e) {}
      }
      console.log("✅ Sessions closed, exiting.");
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

  } catch (err) {
    console.error("❌ PostgreSQL Connection Error:", err.message);
    process.exit(1);
  }
}

init();
