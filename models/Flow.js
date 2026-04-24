const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Flow = sequelize.define("Flow", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  trigger: { type: DataTypes.STRING, allowNull: false },
  userNumber: { type: DataTypes.STRING, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  timestamps: true,
  indexes: [{ unique: true, fields: ['trigger', 'userNumber'] }]
});

module.exports = Flow;
