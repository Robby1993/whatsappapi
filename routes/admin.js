const express = require("express");
const User = require("../models/User");
const Token = require("../models/Token");
const { authenticate, adminOnly, sendResponse } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);
router.use(adminOnly);

router.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    sendResponse(res, 200, "Users fetched", users);
  } catch (err) {
    sendResponse(res, 500, "Failed", err.message);
  }
});

router.post("/update-user", async (req, res) => {
  try {
    const { number, isActive, validDays } = req.body;
    const user = await User.findOneAndUpdate({ number }, { isActive, validDays }, { new: true });
    sendResponse(res, 200, "User updated", user);
  } catch (err) {
    sendResponse(res, 500, "Failed", err.message);
  }
});

module.exports = router;
