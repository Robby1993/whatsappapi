const express = require("express");
const User = require("../models/User");
const Token = require("../models/Token");
const Stat = require("../models/Stat");
const MessageLog = require("../models/MessageLog");
const Campaign = require("../models/Campaign");
const ScheduledMessage = require("../models/ScheduledMessage");
const QueuedMessage = require("../models/QueuedMessage");
const Plan = require("../models/Plan");
const Template = require("../models/Template");
const { authenticate, adminOnly, sendResponse } = require("../middleware/auth");

const router = express.Router();

// dashboard is accessible by all authenticated users
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

// Admin-only routes
router.use(authenticate, adminOnly);

router.get("/users", async (req, res) => {
  try {
    const users = await User.find();
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

router.get("/sessions-list", async (req, res) => {
    // Note: To get real-time memory sessions, we'd need to import them from whatsapp.js
    // For now, returning success message. You can expand this logic.
    sendResponse(res, 200, "Admin session list endpoint reached");
});

router.post("/clear-database", async (req, res) => {
  try {
    await User.deleteMany({ userType: { $ne: "admin" } });
    await Token.deleteMany({});
    await MessageLog.deleteMany({});
    await Template.deleteMany({});
    await Plan.deleteMany({});
    await ScheduledMessage.deleteMany({});
    await QueuedMessage.deleteMany({});
    await Campaign.deleteMany({});
    await Stat.deleteMany({});

    sendResponse(res, 200, "Database cleared (except admin users)");
  } catch (err) { sendResponse(res, 500, "Clear failed", err.message); }
});

module.exports = router;
