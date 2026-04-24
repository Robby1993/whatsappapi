const flowService = require("./flow.service");
const { sendResponse } = require("../middleware/auth");

class FlowController {
  async create(req, res) {
    try {
      const flow = await flowService.createFlow(req.userNumber, req.body);
      sendResponse(res, 201, "Flow created successfully", flow);
    } catch (error) {
      sendResponse(res, 500, "Failed to create flow", error.message);
    }
  }

  async list(req, res) {
    try {
      const flows = await flowService.listFlows(req.userNumber);
      sendResponse(res, 200, "Flows fetched", flows);
    } catch (error) {
      sendResponse(res, 500, "Failed to fetch flows", error.message);
    }
  }

  async getOne(req, res) {
    try {
      const flow = await flowService.getFlowById(req.userNumber, req.params.id);
      if (!flow) return sendResponse(res, 404, "Flow not found");
      sendResponse(res, 200, "Flow fetched", flow);
    } catch (error) {
      sendResponse(res, 500, "Failed to fetch flow", error.message);
    }
  }

  async update(req, res) {
    try {
      const flow = await flowService.updateFlow(req.userNumber, req.params.id, req.body);
      sendResponse(res, 200, "Flow updated", flow);
    } catch (error) {
      sendResponse(res, 500, "Update failed", error.message);
    }
  }

  async delete(req, res) {
    try {
      await flowService.deleteFlow(req.userNumber, req.params.id);
      sendResponse(res, 200, "Flow deleted");
    } catch (error) {
      sendResponse(res, 500, "Delete failed", error.message);
    }
  }
}

module.exports = new FlowController();
