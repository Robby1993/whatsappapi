const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const User = sequelize.define("User", {
  number: { type: DataTypes.STRING, allowNull: false, unique: true },
  name: { type: DataTypes.STRING, defaultValue: "User" },
  gender: { type: DataTypes.STRING, defaultValue: "Not Specified" },
  password: { type: DataTypes.STRING, allowNull: false },
  userType: { type: DataTypes.ENUM("admin", "user"), defaultValue: "user" },
  createdAt: { type: DataTypes.BIGINT, defaultValue: () => Date.now() },
  validDays: { type: DataTypes.INTEGER, defaultValue: 3 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  timestamps: false
});

module.exports = User;
