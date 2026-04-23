const express = require("express");
const User = require("../models/User");
const Token = require("../models/Token");
const Stat = require("../models/Stat");
const MessageLog = require("../models/MessageLog");
const Campaign = require("../models/Campaign");
const Plan = require("../models/Plan");
const Template = require("../models/Template");
const ScheduledMessage = require("../models/ScheduledMessage");
const QueuedMessage = require("../models/QueuedMessage");
const { authenticate, adminOnly, sendResponse } = require("../middleware/auth");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");

const router = express.Router();

// --- DASHBOARD (Shared) ---
router.get("/dashboard", authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ where: { number: req.userNumber, userType: req.userType } });
    const stat = await Stat.findByPk(1);
    const recentLogs = await MessageLog.findAll({
      where: { sender: req.userNumber },
      order: [['timestamp', 'DESC']],
      limit: 5
    });

    sendResponse(res, 200, "Dashboard data fetched", {
      totalSent: stat ? stat.totalMessagesSent : 0,
      profile: user,
      recentLogs
    });
  } catch (err) { sendResponse(res, 500, "Failed to fetch dashboard", err.message); }
});

// --- ADMIN ONLY ROUTES ---
router.use(authenticate, adminOnly);

const crypto = require("crypto");

/**
 * Generate API Key for a user
 */
router.post("/users/:number/generate-api-key", async (req, res) => {
  try {
    const { number } = req.params;
    const apiKey = "wa_" + crypto.randomBytes(32).toString("hex");

    const [updated] = await User.update({ apiKey }, { where: { number } });
    if (!updated) return sendResponse(res, 404, "User not found");

    sendResponse(res, 200, "API Key generated successfully", { number, apiKey });
  } catch (err) { sendResponse(res, 500, "Failed to generate API Key", err.message); }
});

/**
 * Global System Stats
 */
router.get("/stats", async (req, res) => {
  try {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { isActive: true } });
    const totalMessages = await MessageLog.count();
    const totalCampaigns = await Campaign.count();

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
    // includeDeleted can be passed as query param to see soft-deleted users
    const includeDeleted = req.query.includeDeleted === 'true';
    const users = await User.findAll({
      order: [['createdAt', 'DESC']],
      paranoid: !includeDeleted
    });
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

    const [updated] = await User.update(update, { where: { number } });
    if (!updated) return sendResponse(res, 404, "User not found");
    const user = await User.findOne({ where: { number } });
    sendResponse(res, 200, "User updated successfully", user);
  } catch (err) { sendResponse(res, 500, "Failed to update user", err.message); }
});

/**
 * Soft Delete User
 */
router.delete("/users/:number/soft", async (req, res) => {
  try {
    const { number } = req.params;
    const { userType } = req.query; // Optional: specify which type if multiple exist

    const where = { number };
    if (userType) where.userType = userType;

    const user = await User.findOne({ where });
    if (!user) return sendResponse(res, 404, "User not found");

    await user.destroy(); // Soft delete because paranoid: true is set in model

    sendResponse(res, 200, `User ${number} soft deleted successfully.`);
  } catch (err) { sendResponse(res, 500, "Soft delete failed", err.message); }
});

/**
 * Restore Soft Deleted User
 */
router.post("/users/:number/restore", async (req, res) => {
  try {
    const { number } = req.params;
    const { userType } = req.query;

    const where = { number };
    if (userType) where.userType = userType;

    const user = await User.findOne({ where, paranoid: false });
    if (!user) return sendResponse(res, 404, "User not found");

    await user.restore();

    sendResponse(res, 200, `User ${number} restored successfully.`, user);
  } catch (err) { sendResponse(res, 500, "Restore failed", err.message); }
});

/**
 * Hard Delete User
 */
router.delete("/users/:number/hard", async (req, res) => {
  try {
    const { number } = req.params;
    const { userType } = req.query;

    const where = { number };
    if (userType) where.userType = userType;

    // Hard delete from DB
    await User.destroy({ where, force: true });
    await Token.destroy({ where: { number } });

    // Clean up physical session data (if any)
    const Session = require("../models/Session");
    await Session.destroy({ where: { phone: number } });

    sendResponse(res, 200, `User ${number} permanently deleted.`);
  } catch (err) { sendResponse(res, 500, "Hard delete failed", err.message); }
});

/**
 * Plan Management
 */
router.post("/plans", async (req, res) => {
  try {
    const { id, name, days, price } = req.body;
    const [plan] = await Plan.upsert({ id, name, days, price });
    sendResponse(res, 200, "Plan saved successfully", plan);
  } catch (err) { sendResponse(res, 500, "Failed to save plan", err.message); }
});

router.delete("/plans/:id", async (req, res) => {
  try {
    await Plan.destroy({ where: { id: req.params.id } });
    sendResponse(res, 200, "Plan deleted");
  } catch (err) { sendResponse(res, 500, "Failed to delete plan", err.message); }
});

/**
 * Global Logs
 */
router.get("/all-logs", async (req, res) => {
  try {
    const logs = await MessageLog.findAll({ order: [['timestamp', 'DESC']], limit: 100 });
    sendResponse(res, 200, "Global logs fetched", logs);
  } catch (err) { sendResponse(res, 500, "Failed to fetch logs", err.message); }
});

/**
 * System Cleanup
 */
router.post("/clear-database", async (req, res) => {
  try {
    await User.destroy({ where: { userType: { [Op.ne]: "admin" } }, force: true });
    await Token.destroy({ where: {}, truncate: true });
    await MessageLog.destroy({ where: {}, truncate: true });
    await Template.destroy({ where: {}, truncate: true });
    await Plan.destroy({ where: {}, truncate: true });
    await Campaign.destroy({ where: {}, truncate: true });
    await Stat.destroy({ where: {}, truncate: true });
    await ScheduledMessage.destroy({ where: {}, truncate: true });
    await QueuedMessage.destroy({ where: {}, truncate: true });

    sendResponse(res, 200, "Database cleared (except admin users)");
  } catch (err) { sendResponse(res, 500, "Clear failed", err.message); }
});

module.exports = router;
