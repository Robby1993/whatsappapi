const mongoose = require("mongoose");

const MessageLogSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  message: String,
  type: { type: String, default: "text" },
  status: String,
  timestamp: { type: Number, default: Date.now },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign" }
});

module.exports = mongoose.model("MessageLog", MessageLogSchema);
