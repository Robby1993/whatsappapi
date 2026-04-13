const mongoose = require("mongoose");

const QueuedMessageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  message: String,
  status: { type: String, enum: ["pending", "processing", "sent", "failed"], default: "pending" },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign" },
  createdAt: { type: Number, default: Date.now }
});

module.exports = mongoose.model("QueuedMessage", QueuedMessageSchema);
