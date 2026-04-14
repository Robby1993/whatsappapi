const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const MessageLog = sequelize.define("MessageLog", {
  sender: { type: DataTypes.STRING },
  receiver: { type: DataTypes.STRING },
  message: { type: DataTypes.TEXT },
  type: { type: DataTypes.STRING, defaultValue: "text" },
  status: { type: DataTypes.STRING },
  timestamp: { type: DataTypes.BIGINT, defaultValue: () => Date.now() },
  campaignId: { type: DataTypes.INTEGER } // Foreign key manually or via associations
}, {
  timestamps: false
});

module.exports = MessageLog;
