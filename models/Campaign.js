const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Campaign = sequelize.define("Campaign", {
  name: { type: DataTypes.STRING, allowNull: false },
  sender: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT },
  totalContacts: { type: DataTypes.INTEGER, defaultValue: 0 },
  sentCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  failedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM("pending", "processing", "completed"), defaultValue: "pending" },
  createdAt: { type: DataTypes.BIGINT, defaultValue: () => Date.now() }
}, {
  timestamps: false
});

module.exports = Campaign;
