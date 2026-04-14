const express = require("express");
const User = require("../models/User");
const Token = require("../models/Token");
const Stat = require("../models/Stat");
const MessageLog = require("../models/MessageLog");
const Campaign = require("../models/Campaign");
const Plan = require("../models/Plan");
const Template = require("../models/Template");
const { authenticate, adminOnly, sendResponse } = require("../middleware/auth");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// --- DASHBOARD (Shared) ---
router.get("/dashboard", authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ number: req.userNumber });
    const stat = await Stat.findOne();
    const recentLogs = await MessageLog.find({ sender: req.userNumber }).sort({ timestamp: -1 }).limit(5);

    sendResponse(res, 200, "Dashboard data fetched", {
      totalSent: stat ? stat.totalMessagesSent : 0,
      profile: user,
      recentLogs
    });
  } catch (err) { sendResponse(res, 500, "Failed to fetch dashboard", err.message); }
});

// --- ADMIN ONLY ROUTES ---
router.use(authenticate, adminOnly);

/**
 * Global System Stats
 */
router.get("/stats", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const totalMessages = await MessageLog.countDocuments();
    const totalCampaigns = await Campaign.countDocuments();

    sendResponse(res, 200, "System stats fetched", {
      totalUsers,
      activeUsers,
      totalMessages,
      totalCampaigns
    });
  } catch (err) { sendResponse(res, 500, "Failed to fetch stats", err.message); }
});

/**
 * User Management
 */
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    sendResponse(res, 200, "Users fetched successfully", users);
  } catch (err) { sendResponse(res, 500, "Failed to fetch users", err.message); }
});

router.post("/update-user", async (req, res) => {
  try {
    const { number, isActive, validDays, userType } = req.body;
    const update = {};
    if (isActive !== undefined) update.isActive = isActive;
    if (validDays !== undefined) update.validDays = validDays;
    if (userType) update.userType = userType;

    const user = await User.findOneAndUpdate({ number }, update, { new: true });
    if (!user) return sendResponse(res, 404, "User not found");
    sendResponse(res, 200, "User updated successfully", user);
  } catch (err) { sendResponse(res, 500, "Failed to update user", err.message); }
});

router.delete("/users/:number", async (req, res) => {
  try {
    const { number } = req.params;
    await User.deleteOne({ number });
    await Token.deleteMany({ number });

    // Clean up physical session folder
    const sessionDir = path.join(__dirname, "../sessions", number);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }

    sendResponse(res, 200, `User ${number} and their sessions deleted.`);
  } catch (err) { sendResponse(res, 500, "Failed to delete user", err.message); }
});

/**
 * Plan Management (CRUD)
 */
router.post("/plans", async (req, res) => {
  try {
    const { id, name, days, price } = req.body;
    const plan = await Plan.findOneAndUpdate(
      { id },
      { name, days, price },
      { upsert: true, new: true }
    );
    sendResponse(res, 200, "Plan saved successfully", plan);
  } catch (err) { sendResponse(res, 500, "Failed to save plan", err.message); }
});

router.delete("/plans/:id", async (req, res) => {
  try {
    await Plan.deleteOne({ id: req.params.id });
    sendResponse(res, 200, "Plan deleted");
  } catch (err) { sendResponse(res, 500, "Failed to delete plan", err.message); }
});

/**
 * Global Logs
 */
router.get("/all-logs", async (req, res) => {
  try {
    const logs = await MessageLog.find().sort({ timestamp: -1 }).limit(100);
    sendResponse(res, 200, "Global logs fetched", logs);
  } catch (err) { sendResponse(res, 500, "Failed to fetch logs", err.message); }
});

/**
 * System Cleanup
 */
router.post("/clear-database", async (req, res) => {
  try {
    await User.deleteMany({ userType: { $ne: "admin" } });
    await Token.deleteMany({});
    await MessageLog.deleteMany({});
    await Template.deleteMany({});
    await Plan.deleteMany({});
    await Campaign.deleteMany({});
    await Stat.deleteMany({});

    sendResponse(res, 200, "Database cleared (except admin users)");
  } catch (err) { sendResponse(res, 500, "Clear failed", err.message); }
});

module.exports = router;
