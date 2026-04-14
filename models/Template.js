const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Template = sequelize.define("Template", {
  keyword: { type: DataTypes.STRING, primaryKey: true },
  type: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, defaultValue: "" },
  buttons: { type: DataTypes.JSON, defaultValue: [] },
  footer: { type: DataTypes.STRING, defaultValue: "" },
  header: { type: DataTypes.STRING, defaultValue: "" },
  sections: { type: DataTypes.JSON, defaultValue: [] },
  mediaUrl: { type: DataTypes.STRING, defaultValue: "" },
  fileName: { type: DataTypes.STRING, defaultValue: "" }
}, {
  timestamps: false
});

module.exports = Template;
