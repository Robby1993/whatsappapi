const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const User = sequelize.define("User", {
  number: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: { type: DataTypes.STRING, defaultValue: "User" },
  gender: { type: DataTypes.STRING, defaultValue: "Not Specified" },
  password: { type: DataTypes.STRING, allowNull: false },
  userType: {
    type: DataTypes.ENUM("admin", "user"),
    defaultValue: "user"
  },
  validDays: { type: DataTypes.INTEGER, defaultValue: 3 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  webhookUrl: { type: DataTypes.STRING, allowNull: true },

  createdAt: {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: () => Date.now()
  },

  updatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  paranoid: true,
  indexes: [
    {
      unique: true,
      fields: ['number', 'userType', 'deletedAt']
    }
  ]
});

module.exports = User;
