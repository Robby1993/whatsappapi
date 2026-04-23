const User = require("../../models/User");

const apiKeyAuth = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({ status: false, message: "API Key required" });
  }

  try {
    const user = await User.findOne({ where: { apiKey, isActive: true } });
    if (!user) {
      return res.status(403).json({ status: false, message: "Invalid API Key" });
    }

    req.user = user;
    req.userNumber = user.number;
    next();
  } catch (error) {
    res.status(500).json({ status: false, error: "Auth Error" });
  }
};

module.exports = apiKeyAuth;
