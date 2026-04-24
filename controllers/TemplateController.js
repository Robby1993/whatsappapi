const Template = require("../models/Template");
const { sendResponse } = require("../middleware/auth");

class TemplateController {
  async create(req, res) {
    try {
      const template = await Template.create(req.body);
      sendResponse(res, 201, "Template created successfully", template);
    } catch (error) {
      sendResponse(res, 500, "Failed to create template", error.message);
    }
  }

  async list(req, res) {
    try {
      const templates = await Template.findAll();
      sendResponse(res, 200, "Templates fetched", templates);
    } catch (error) {
      sendResponse(res, 500, "Failed to fetch templates", error.message);
    }
  }

  async getOne(req, res) {
    try {
      const template = await Template.findByPk(req.params.keyword);
      if (!template) return sendResponse(res, 404, "Template not found");
      sendResponse(res, 200, "Template fetched", template);
    } catch (error) {
      sendResponse(res, 500, "Failed to fetch template", error.message);
    }
  }

  async update(req, res) {
    try {
      const { keyword } = req.params;
      const [updated] = await Template.update(req.body, { where: { keyword } });
      if (!updated) return sendResponse(res, 404, "Template not found");
      const template = await Template.findByPk(keyword);
      sendResponse(res, 200, "Template updated", template);
    } catch (error) {
      sendResponse(res, 500, "Update failed", error.message);
    }
  }

  async delete(req, res) {
    try {
      const { keyword } = req.params;
      await Template.destroy({ where: { keyword } });
      sendResponse(res, 200, "Template deleted");
    } catch (error) {
      sendResponse(res, 500, "Delete failed", error.message);
    }
  }
}

module.exports = new TemplateController();
