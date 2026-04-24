const Template = require("../models/Template");
const { sendResponse } = require("../middleware/auth");

class TemplateController {
  async create(req, res) {
    try {
      const { keyword, type, content, buttons, footer, header, sections, mediaUrl, fileName } = req.body;

      if (!keyword || !type) {
        return sendResponse(res, 400, "Keyword and Type are required");
      }

      const template = await Template.create({
        keyword,
        type,
        content: content || "",
        buttons: buttons || [],
        footer: footer || "",
        header: header || "",
        sections: sections || [],
        mediaUrl: mediaUrl || "",
        fileName: fileName || ""
      });

      sendResponse(res, 201, "Template created successfully", template);
    } catch (error) {
      console.error("Template Create Error:", error);
      sendResponse(res, 500, "Failed to create template", error.message);
    }
  }

  async list(req, res) {
    try {
      const templates = await Template.findAll({
        order: [['createdAt', 'DESC']]
      });
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

      if (!updated) {
        // Check if keyword changed in body? Usually no, but check existence
        const exists = await Template.findByPk(keyword);
        if (!exists) return sendResponse(res, 404, "Template not found");
        return sendResponse(res, 200, "No changes made", exists);
      }

      const template = await Template.findByPk(keyword);
      sendResponse(res, 200, "Template updated successfully", template);
    } catch (error) {
      sendResponse(res, 500, "Update failed", error.message);
    }
  }

  async delete(req, res) {
    try {
      const { keyword } = req.params;
      const deleted = await Template.destroy({ where: { keyword } });
      if (!deleted) return sendResponse(res, 404, "Template not found");
      sendResponse(res, 200, "Template deleted successfully");
    } catch (error) {
      sendResponse(res, 500, "Delete failed", error.message);
    }
  }
}

module.exports = new TemplateController();
