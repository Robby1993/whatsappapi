const express = require("express");
const crypto = require("crypto");
const User = require("../models/User");
const Token = require("../models/Token");
const { sendResponse } = require("../middleware/auth");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { name, gender, number, password, userType } = req.body;
    if (!number || !password) return sendResponse(res, 400, "Mandatory fields missing");

    const existing = await User.findOne({ number });
    if (existing) return sendResponse(res, 400, "User already exists");

    const newUser = await User.create({
      number,
      name: name || "User",
      gender: gender || "N/A",
      password,
      userType: userType === "admin" ? "admin" : "user"
    });

    sendResponse(res, 201, "Registration successful", newUser);
  } catch (err) {
    sendResponse(res, 500, "Registration failed", err.message);
  }
});

router.post("/login", async (req, res) => {
  try {
    const { number, password, userType } = req.body;
    const user = await User.findOne({ number, password });
    if (!user) return sendResponse(res, 401, "Invalid credentials");

    if (userType && user.userType !== userType) return sendResponse(res, 403, `Unauthorized user type`);
    if (!user.isActive) return sendResponse(res, 403, "Account inactive");

    const token = crypto.randomBytes(24).toString('hex');
    await Token.create({ token, number: user.number, userType: user.userType });

    sendResponse(res, 200, "Login successful", { token, user });
  } catch (err) {
    sendResponse(res, 500, "Login failed", err.message);
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { number, newPassword } = req.body;
    const user = await User.findOneAndUpdate({ number }, { password: newPassword }, { new: true });
    if (!user) return sendResponse(res, 404, "User not found");
    sendResponse(res, 200, "Password updated successfully");
  } catch (err) {
    sendResponse(res, 500, "Update failed", err.message);
  }
});

module.exports = router;
