const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Message = sequelize.define("Message", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  externalId: { type: DataTypes.STRING },
  sender: { type: DataTypes.STRING, allowNull: false },
  receiver: { type: DataTypes.STRING, allowNull: false },
  channel: { type: DataTypes.STRING, allowNull: false }, // Use STRING for flexibility (whatsapp, rcs, etc.)
  type: { type: DataTypes.STRING, defaultValue: "text" },
  content: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: "pending" }, // Use STRING to avoid ENUM sync issues
  errorMessage: { type: DataTypes.STRING },
  metadata: { type: DataTypes.JSONB }
}, { timestamps: true });

module.exports = Message;
