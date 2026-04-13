const mongoose = require("mongoose");

const TemplateSchema = new mongoose.Schema({
  keyword: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  content: { type: String, default: "" },
  buttons: { type: Array, default: [] },
  footer: { type: String, default: "" },
  header: { type: String, default: "" },
  sections: { type: Array, default: [] },
  mediaUrl: { type: String, default: "" },
  fileName: { type: String, default: "" }
});

module.exports = mongoose.model("Template", TemplateSchema);
