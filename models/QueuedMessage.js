const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const QueuedMessage = sequelize.define("QueuedMessage", {
  sender: { type: DataTypes.STRING },
  receiver: { type: DataTypes.STRING },
  message: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM("pending", "processing", "sent", "failed"), defaultValue: "pending" },
  campaignId: { type: DataTypes.INTEGER },
  createdAt: { type: DataTypes.BIGINT, defaultValue: () => Date.now() }
}, {
  timestamps: false
});

module.exports = QueuedMessage;
