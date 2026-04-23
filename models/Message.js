const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Message = sequelize.define("Message", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  externalId: { type: DataTypes.STRING }, // ID from Baileys or RCS
  sender: { type: DataTypes.STRING, allowNull: false },
  receiver: { type: DataTypes.STRING, allowNull: false },
  channel: { type: DataTypes.ENUM("whatsapp", "rcs"), allowNull: false },
  type: { type: DataTypes.STRING, defaultValue: "text" }, // text, image, video, document, rich_card
  content: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM("pending", "sent", "delivered", "read", "failed"), defaultValue: "pending" },
  errorMessage: { type: DataTypes.STRING },
  metadata: { type: DataTypes.JSONB } // For storing buttons or card data
}, { timestamps: true });

module.exports = Message;
