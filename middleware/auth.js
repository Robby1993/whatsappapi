const Token = require("../models/Token");
const User = require("../models/User");

// Common response helper
function sendResponse(res, code, message, result = null) {
  res.status(code).json({
    status: code >= 200 && code < 300,
    code: code,
    message: message,
    result: result
  });
}

async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const tokenString = authHeader && authHeader.split(' ')[1];

  if (!tokenString) return sendResponse(res, 401, "Token required");

  try {
    const tokenData = await Token.findOne({ token: tokenString });
    if (!tokenData) return sendResponse(res, 401, "Invalid token");

    const user = await User.findOne({ number: tokenData.number });
    if (!user || !user.isActive) {
      await Token.deleteOne({ token: tokenString });
      return sendResponse(res, 403, "Access denied");
    }

    req.userNumber = user.number;
    req.userType = user.userType;
    next();
  } catch (err) {
    sendResponse(res, 500, "Auth error", err.message);
  }
}

const adminOnly = (req, res, next) => {
  if (req.userType !== "admin") return sendResponse(res, 403, "Admin only access");
  next();
};

module.exports = { authenticate, adminOnly, sendResponse };
