const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const FlowSession = sequelize.define("FlowSession", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  phone: { type: DataTypes.STRING, allowNull: false }, // Remote JID
  userNumber: { type: DataTypes.STRING, allowNull: false }, // Business Number
  flowId: { type: DataTypes.INTEGER, allowNull: false },
  currentNodeId: { type: DataTypes.STRING, allowNull: true },
  variables: { type: DataTypes.JSONB, defaultValue: {} },
  lastInteraction: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  timestamps: true
});

module.exports = FlowSession;
