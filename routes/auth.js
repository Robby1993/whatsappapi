const express = require("express");
const crypto = require("crypto");
const User = require("../models/User");
const Token = require("../models/Token");
const Plan = require("../models/Plan");
const { authenticate, sendResponse } = require("../middleware/auth");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { name, gender, number, password, userType } = req.body;
    if (!number || !password) return sendResponse(res, 400, "Mandatory fields missing");

    const existing = await User.findOne({ where: { number } });
    if (existing) return sendResponse(res, 400, "User already exists");

    const newUser = await User.create({
      number,
      name: name || "User",
      gender: gender || "N/A",
      password,
      userType: userType === "admin" ? "admin" : "user",
      validDays: 3
    });

    sendResponse(res, 201, "Registration successful", newUser);
  } catch (err) { sendResponse(res, 500, "Registration failed", err.message); }
});

router.post("/login", async (req, res) => {
  try {
    const { number, password, userType } = req.body;
    const user = await User.findOne({ where: { number, password } });
    if (!user) return sendResponse(res, 401, "Invalid credentials");

    if (userType && user.userType !== userType) return sendResponse(res, 403, `Unauthorized user type`);
    if (!user.isActive) return sendResponse(res, 403, "Account inactive");

    const token = crypto.randomBytes(24).toString('hex');
    await Token.create({ token, number: user.number, userType: user.userType });

    sendResponse(res, 200, "Login successful", { token, user });
  } catch (err) { sendResponse(res, 500, "Login failed", err.message); }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { number, newPassword } = req.body;
    const [updated] = await User.update({ password: newPassword }, { where: { number } });
    if (!updated) return sendResponse(res, 404, "User not found");
    sendResponse(res, 200, "Password updated successfully");
  } catch (err) { sendResponse(res, 500, "Update failed", err.message); }
});

router.use(authenticate);

router.post("/update-profile", async (req, res) => {
  try {
    const { name, gender, password } = req.body;
    const update = {};
    if (name) update.name = name;
    if (gender) update.gender = gender;
    if (password) update.password = password;

    await User.update(update, { where: { number: req.userNumber } });
    const user = await User.findOne({ where: { number: req.userNumber } });
    sendResponse(res, 200, "Profile updated successfully", user);
  } catch (err) { sendResponse(res, 500, "Update failed", err.message); }
});

router.post("/buy-subscription", async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = await Plan.findByPk(planId);
    if (!plan) return sendResponse(res, 400, "Invalid plan");

    const user = await User.findOne({ where: { number: req.userNumber } });
    let newValidDays = user.validDays;
    let newCreatedAt = user.createdAt;

    const expiry = Number(user.createdAt) + (user.validDays * 86400000);

    if (Date.now() < expiry) {
      newValidDays += plan.days;
    } else {
      newCreatedAt = Date.now();
      newValidDays = plan.days;
    }
    await User.update({ validDays: newValidDays, createdAt: newCreatedAt }, { where: { number: req.userNumber } });
    const updatedUser = await User.findOne({ where: { number: req.userNumber } });
    sendResponse(res, 200, "Subscription purchased successfully", updatedUser);
  } catch (err) { sendResponse(res, 500, "Purchase failed", err.message); }
});

module.exports = router;
