const express = require("express");
const crypto = require("crypto");
const User = require("../models/User");
const Token = require("../models/Token");
const Plan = require("../models/Plan");
const { authenticate, sendResponse } = require("../middleware/auth");

const router = express.Router();

/**
 * Register a new user
 * Now allows same number for different user types
 */
router.post("/register", async (req, res) => {
  try {
    const { name, gender, number, password, userType } = req.body;
    if (!number || !password) {
      return sendResponse(res, 400, "Phone number and password are required");
    }

    const type = userType === "admin" ? "admin" : "user";
    const cleanNumber = number.toString().replace(/\D/g, "");

    // Check if this specific number + type combo already exists
    const existing = await User.findOne({
      where: {
        number: cleanNumber,
        userType: type
      }
    });

    if (existing) {
      return sendResponse(res, 400, `An account with this number already exists as ${type}`);
    }

    const newUser = await User.create({
      number: cleanNumber,
      apiKey: "wa_" + crypto.randomBytes(32).toString("hex"),
      name: name || "User",
      gender: gender || "Not Specified",
      password,
      userType: type,
      validDays: 3
    });

    const result = newUser.toJSON();
    delete result.password;

    sendResponse(res, 201, "Registration successful", result);
  } catch (err) {
    console.error("Registration Error:", err);
    sendResponse(res, 500, "Registration failed", err.message);
  }
});

/**
 * Login based on User Type
 */
router.post("/login", async (req, res) => {
  try {
    const { number, password, userType } = req.body;

    if (!number || !password || !userType) {
      return sendResponse(res, 400, "Number, password, and userType are required");
    }

    const cleanNumber = number.toString().replace(/\D/g, "");

    // Find user by number AND userType
    const user = await User.findOne({
      where: {
        number: cleanNumber,
        userType: userType
      }
    });

    if (!user) {
      return sendResponse(res, 404, `User not found as ${userType}`);
    }

    if (user.password !== password) {
      return sendResponse(res, 401, "Incorrect password");
    }

    if (!user.isActive) {
      return sendResponse(res, 403, "Account is currently inactive");
    }

    // Generate session token
    const token = crypto.randomBytes(24).toString('hex');
    await Token.create({
      token,
      number: user.number,
      userType: user.userType
    });

    const resultUser = user.toJSON();
    delete resultUser.password;

    sendResponse(res, 200, "Login successful", {
      token,
      user: resultUser
    });
  } catch (err) {
    console.error("Login Error:", err);
    sendResponse(res, 500, "Login failed", err.message);
  }
});

/**
 * Forgot Password
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { number, userType, newPassword } = req.body;
    if (!number || !userType || !newPassword) return sendResponse(res, 400, "Missing fields");

    const cleanNumber = number.toString().replace(/\D/g, "");
    const [updated] = await User.update(
      { password: newPassword },
      { where: { number: cleanNumber, userType } }
    );

    if (!updated) return sendResponse(res, 404, "User account not found");
    sendResponse(res, 200, "Password updated successfully");
  } catch (err) {
    sendResponse(res, 500, "Update failed", err.message);
  }
});

router.use(authenticate);

router.post("/update-profile", async (req, res) => {
  try {
    const { name, gender, password } = req.body;
    const update = {};
    if (name) update.name = name;
    if (gender) update.gender = gender;
    if (password) update.password = password;

    await User.update(update, {
      where: {
        number: req.userNumber,
        userType: req.userType // Ensure we update the correct account type
      }
    });

    const user = await User.findOne({
      where: {
        number: req.userNumber,
        userType: req.userType
      }
    });

    const result = user.toJSON();
    delete result.password;
    sendResponse(res, 200, "Profile updated successfully", result);
  } catch (err) { sendResponse(res, 500, "Update failed", err.message); }
});

router.post("/buy-subscription", async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = await Plan.findByPk(planId);
    if (!plan) return sendResponse(res, 400, "Invalid plan");

    const user = await User.findOne({
      where: {
        number: req.userNumber,
        userType: req.userType
      }
    });

    let newValidDays = user.validDays;
    let newCreatedAt = user.createdAt;

    const expiry = Number(user.createdAt) + (user.validDays * 86400000);

    if (Date.now() < expiry) {
      newValidDays += plan.days;
    } else {
      newCreatedAt = Date.now();
      newValidDays = plan.days;
    }

    await User.update({
      validDays: newValidDays,
      createdAt: newCreatedAt
    }, {
      where: {
        number: req.userNumber,
        userType: req.userType
      }
    });

    const updatedUser = await User.findOne({
      where: {
        number: req.userNumber,
        userType: req.userType
      }
    });
    const result = updatedUser.toJSON();
    delete result.password;

    sendResponse(res, 200, "Subscription purchased successfully", result);
  } catch (err) { sendResponse(res, 500, "Purchase failed", err.message); }
});

module.exports = router;
