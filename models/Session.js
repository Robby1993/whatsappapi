const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Session = sequelize.define("Session", {
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dataType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dataId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  data: {
    type: DataTypes.TEXT, // Using TEXT to store stringified JSON
    allowNull: true
  }
}, {
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['phone', 'dataType', 'dataId']
    }
  ]
});

module.exports = Session;
