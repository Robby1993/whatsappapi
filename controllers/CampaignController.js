const Campaign = require("../models/Campaign");
const QueuedMessage = require("../models/QueuedMessage");
const { sendResponse } = require("../middleware/auth");

class CampaignController {
  async create(req, res) {
    try {
      const sender = req.body.from || req.userNumber;
      const { name, message, numbers } = req.body;
      if (!name || !message || !numbers) return sendResponse(res, 400, "Fields missing (name, message, numbers)");

      const campaign = await Campaign.create({
        name,
        sender,
        message,
        totalContacts: numbers.length,
        status: "pending"
      });

      const queued = numbers.map(num => ({
        sender,
        receiver: num,
        message,
        campaignId: campaign.id
      }));

      await QueuedMessage.bulkCreate(queued);

      sendResponse(res, 201, "Campaign created and queued", campaign);
    } catch (error) {
      sendResponse(res, 500, "Failed to create campaign", error.message);
    }
  }

  async list(req, res) {
    try {
      const campaigns = await Campaign.findAll({
        where: { sender: req.userNumber },
        order: [['createdAt', 'DESC']]
      });
      sendResponse(res, 200, "Campaigns fetched", campaigns);
    } catch (error) {
      sendResponse(res, 500, "Failed to fetch campaigns", error.message);
    }
  }

  async getOne(req, res) {
    try {
      const campaign = await Campaign.findOne({
        where: { id: req.params.id, sender: req.userNumber }
      });
      if (!campaign) return sendResponse(res, 404, "Campaign not found");
      sendResponse(res, 200, "Campaign details", campaign);
    } catch (error) {
      sendResponse(res, 500, "Failed to fetch campaign", error.message);
    }
  }

  async delete(req, res) {
    try {
      const campaign = await Campaign.findOne({
        where: { id: req.params.id, sender: req.userNumber }
      });
      if (!campaign) return sendResponse(res, 404, "Campaign not found");

      // Delete queued messages for this campaign if they are still pending
      await QueuedMessage.destroy({ where: { campaignId: campaign.id, status: "pending" } });
      await campaign.destroy();

      sendResponse(res, 200, "Campaign and pending queued messages deleted");
    } catch (error) {
      sendResponse(res, 500, "Delete failed", error.message);
    }
  }
}

module.exports = new CampaignController();
