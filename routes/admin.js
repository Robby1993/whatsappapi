const express = require("express");
const User = require("../models/User");
const Token = require("../models/Token");
const Message = require("../models/Message");
const Campaign = require("../models/Campaign");
const Flow = require("../models/Flow");
const Plan = require("../models/Plan");
const { authenticate, adminOnly, sendResponse } = require("../middleware/auth");
const DashboardController = require("../controllers/DashboardController");
const crypto = require("crypto");

const router = express.Router();

/**
 * Shared Dashboard (Accessible by both Admin and User)
 */
router.get("/dashboard", authenticate, DashboardController.getUserDashboard);

/**
 * ADMIN ONLY ROUTES
 */
router.use(authenticate, adminOnly);

/**
 * Global System Stats
 */
router.get("/stats", DashboardController.getAdminGlobalStats);

/**
 * API Key Management
 */
router.post("/users/:number/generate-api-key", async (req, res) => {
  try {
    const { number } = req.params;
    const apiKey = "wa_" + crypto.randomBytes(32).toString("hex");
    const [updated] = await User.update({ apiKey }, { where: { number } });
    if (!updated) return sendResponse(res, 404, "User not found");
    sendResponse(res, 200, "API Key generated successfully", { number, apiKey });
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

/**
 * User Management
 */
router.get("/users", async (req, res) => {
  try {
    const users = await User.findAll({ order: [['createdAt', 'DESC']] });
    sendResponse(res, 200, "Users fetched successfully", users);
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

router.post("/update-user", async (req, res) => {
  try {
    const { number, isActive, validDays } = req.body;
    await User.update({ isActive, validDays }, { where: { number } });
    const user = await User.findOne({ where: { number } });
    sendResponse(res, 200, "User updated", user);
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

router.delete("/users/:number/hard", async (req, res) => {
  try {
    const { number } = req.params;
    await User.destroy({ where: { number }, force: true });
    sendResponse(res, 200, `User ${number} permanently deleted.`);
  } catch (err) { sendResponse(res, 500, "Failed", err.message); }
});

/**
 * Plan Management
 */
router.post("/plans", async (req, res) => {
  try {
    const [plan] = await Plan.upsert(req.body);
    sendResponse(res, 200, "Plan saved", plan);
  } catch (err) { sendResponse(err, 500, "Failed", err.message); }
});

module.exports = router;
