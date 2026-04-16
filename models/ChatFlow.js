const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const ChatFlow = sequelize.define("ChatFlow", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userNumber: { type: DataTypes.STRING, allowNull: false },
  triggerKeyword: { type: DataTypes.STRING, allowNull: false },
  responseType: { type: DataTypes.ENUM("text", "image", "video", "audio", "document", "buttons", "list"), defaultValue: "text" },
  responseText: { type: DataTypes.TEXT, allowNull: true },
  mediaUrl: { type: DataTypes.STRING, allowNull: true },
  buttons: { type: DataTypes.JSON, defaultValue: [] },
  sections: { type: DataTypes.JSON, defaultValue: [] },
  footer: { type: DataTypes.STRING, allowNull: true },
  header: { type: DataTypes.STRING, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

module.exports = ChatFlow;
