const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Stat = sequelize.define("Stat", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  totalMessagesSent: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
  timestamps: false
});

module.exports = Stat;
