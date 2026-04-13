const mongoose = require("mongoose");

const ScheduledMessageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  message: String,
  scheduleTime: Number,
  status: { type: String, enum: ["pending", "sent", "failed"], default: "pending" },
  createdAt: { type: Number, default: Date.now }
});

module.exports = mongoose.model("ScheduledMessage", ScheduledMessageSchema);
