const mongoose = require("mongoose");

const CampaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sender: { type: String, required: true },
  message: String,
  totalContacts: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  status: { type: String, enum: ["pending", "processing", "completed"], default: "pending" },
  createdAt: { type: Number, default: Date.now }
});

module.exports = mongoose.model("Campaign", CampaignSchema);
