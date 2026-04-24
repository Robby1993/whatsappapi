const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const FlowState = sequelize.define("FlowState", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userNumber: { type: DataTypes.STRING, allowNull: false }, // The Business Phone
  remoteJid: { type: DataTypes.STRING, allowNull: false },  // The Customer Phone
  flowId: { type: DataTypes.INTEGER, allowNull: false },
  currentNodeId: { type: DataTypes.STRING, allowNull: true },
  metadata: { type: DataTypes.JSONB, defaultValue: {} },
  lastInteraction: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

module.exports = FlowState;
