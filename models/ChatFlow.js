const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const ChatFlow = sequelize.define("ChatFlow", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userNumber: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: true },
  triggerKeyword: { type: DataTypes.STRING, allowNull: false },

  // New: Multi-node structure support
  nodes: { type: DataTypes.JSONB, defaultValue: [] },

  // Legacy support for single-step
  responseType: { type: DataTypes.ENUM("text", "image", "video", "audio", "document", "buttons", "list", "flow"), defaultValue: "text" },
  responseText: { type: DataTypes.TEXT, allowNull: true },
  mediaUrl: { type: DataTypes.STRING, allowNull: true },
  buttons: { type: DataTypes.JSONB, defaultValue: [] },
  sections: { type: DataTypes.JSONB, defaultValue: [] },
  footer: { type: DataTypes.STRING, allowNull: true },
  header: { type: DataTypes.STRING, allowNull: true },

  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

module.exports = ChatFlow;
