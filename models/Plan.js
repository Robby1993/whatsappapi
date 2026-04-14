const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Plan = sequelize.define("Plan", {
  id: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  days: { type: DataTypes.INTEGER, allowNull: false },
  price: { type: DataTypes.FLOAT, allowNull: false }
}, {
  timestamps: false
});

module.exports = Plan;
