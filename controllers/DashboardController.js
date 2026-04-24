const User = require("../models/User");
const Message = require("../models/Message");
const Campaign = require("../models/Campaign");
const Flow = require("../models/Flow");
const FlowSession = require("../models/FlowSession");
const Template = require("../models/Template");
const { sessionStatus } = require("../sessionStore");
const { Op } = require("sequelize");

class DashboardController {
  async getUserDashboard(req, res) {
    try {
      const userNumber = req.userNumber;

      // 1. Message Metrics
      const totalMessages = await Message.count({ where: { sender: userNumber } });
      const deliveredCount = await Message.count({
        where: {
          sender: userNumber,
          status: { [Op.in]: ["sent", "delivered", "read"] }
        }
      });
      const readCount = await Message.count({ where: { sender: userNumber, status: "read" } });

      const readRate = totalMessages > 0 ? ((readCount / totalMessages) * 100).toFixed(1) : "0";

      // 2. Template Metrics
      const totalTemplates = await Template.count(); // Global or per user if you add userNumber to Template model

      // 3. Campaign Metrics
      const recentCampaigns = await Campaign.findAll({
        where: { sender: userNumber },
        limit: 5,
        order: [["createdAt", "DESC"]]
      });

      // 4. User & Subscription
      const user = await User.findOne({
        where: { number: userNumber },
        attributes: ["name", "number", "validDays", "createdAt", "isActive", "apiKey"]
      });

      const expiry = Number(user.createdAt) + (user.validDays * 86400000);
      const daysRemaining = Math.max(0, Math.ceil((expiry - Date.now()) / 86400000));

      // 5. Device Status
      const device = sessionStatus[userNumber] || { status: "not_connected" };

      res.status(200).json({
        status: true,
        message: "Dashboard data fetched",
        result: {
          // --- Fields specifically for Flutter UI ---
          totalMessages: totalMessages,
          delivered: deliveredCount,
          readRate: `${readRate}%`,
          totalTemplates: totalTemplates,
          recentCampaigns: recentCampaigns,

          // --- Additional Detailed Metrics ---
          account: {
            name: user.name,
            number: user.number,
            planDaysRemaining: daysRemaining,
            isActive: user.isActive,
            apiKey: user.apiKey,
            deviceStatus: device.status
          },
          metrics: {
              flows: {
                  activeFlows: await Flow.count({ where: { userNumber, isActive: true } }),
                  currentLiveSessions: await FlowSession.count({ where: { userNumber } })
              }
          }
        }
      });

    } catch (error) {
      console.error("Dashboard Error:", error);
      res.status(500).json({ status: false, error: error.message });
    }
  }

  async getAdminGlobalStats(req, res) {
    try {
        const totalUsers = await User.count();
        const activeUsers = await User.count({ where: { isActive: true } });
        const totalMessages = await Message.count();
        const totalFlows = await Flow.count();

        res.status(200).json({
            status: true,
            result: {
                totalUsers,
                activeUsers,
                totalMessages,
                totalFlows,
                systemStatus: "Healthy"
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
  }
}

module.exports = new DashboardController();
