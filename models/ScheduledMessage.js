const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const ScheduledMessage = sequelize.define("ScheduledMessage", {
  sender: { type: DataTypes.STRING },
  receiver: { type: DataTypes.STRING },
  message: { type: DataTypes.TEXT },
  scheduleTime: { type: DataTypes.BIGINT },
  status: { type: DataTypes.ENUM("pending", "sent", "failed"), defaultValue: "pending" },
  createdAt: { type: DataTypes.BIGINT, defaultValue: () => Date.now() }
}, {
  timestamps: false
});

module.exports = ScheduledMessage;
