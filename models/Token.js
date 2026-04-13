const mongoose = require("mongoose");

const TokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  number: { type: String, required: true },
  userType: { type: String, required: true }
});

module.exports = mongoose.model("Token", TokenSchema);
