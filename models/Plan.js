const mongoose = require("mongoose");

const PlanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  days: { type: Number, required: true },
  price: { type: Number, required: true }
});

module.exports = mongoose.model("Plan", PlanSchema);
