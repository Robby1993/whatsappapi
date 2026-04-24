const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Template = sequelize.define("Template", {
  keyword: { type: DataTypes.STRING, primaryKey: true },
  type: { type: DataTypes.STRING, allowNull: false }, // text, image, video, document, buttons, list
  content: { type: DataTypes.TEXT, defaultValue: "" },
  buttons: { type: DataTypes.JSONB, defaultValue: [] },
  footer: { type: DataTypes.STRING, defaultValue: "" },
  header: { type: DataTypes.STRING, defaultValue: "" },
  sections: { type: DataTypes.JSONB, defaultValue: [] },
  mediaUrl: { type: DataTypes.STRING, defaultValue: "" },
  fileName: { type: DataTypes.STRING, defaultValue: "" },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  timestamps: false
});

module.exports = Template;
