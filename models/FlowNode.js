const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const FlowNode = sequelize.define("FlowNode", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  flowId: { type: DataTypes.INTEGER, allowNull: false },
  nodeId: { type: DataTypes.STRING, allowNull: false }, // ID from the JSON nodes
  type: { type: DataTypes.ENUM("text", "image", "buttons", "list", "condition"), allowNull: false },
  data: { type: DataTypes.JSONB, defaultValue: {} },
  next: { type: DataTypes.STRING, allowNull: true }
}, {
  timestamps: false
});

module.exports = FlowNode;
