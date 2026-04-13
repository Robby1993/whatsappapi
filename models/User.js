const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  name: { type: String, default: "User" },
  gender: { type: String, default: "Not Specified" },
  password: { type: String, required: true },
  userType: { type: String, enum: ["admin", "user"], default: "user" },
  createdAt: { type: Number, default: Date.now },
  validDays: { type: Number, default: 3 },
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model("User", UserSchema);
