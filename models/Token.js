const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Token = sequelize.define("Token", {
  token: { type: DataTypes.STRING, allowNull: false, unique: true },
  number: { type: DataTypes.STRING, allowNull: false },
  userType: { type: DataTypes.STRING, allowNull: false }
}, {
  timestamps: false
});

module.exports = Token;
