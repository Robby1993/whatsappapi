const User = require("../models/User");
const Message = require("../models/Message");
const Campaign = require("../models/Campaign");
const Flow = require("../models/Flow");
const FlowSession = require("../models/FlowSession");
const { sessionStatus } = require("../sessionStore");
const { Op } = require("sequelize");

class DashboardController {
  async getUserDashboard(req, res) {
    try {
      const userNumber = req.userNumber;

      // 1. Message Metrics
      const totalWhatsApp = await Message.count({ where: { sender: userNumber, channel: "whatsapp" } });
      const totalRCS = await Message.count({ where: { sender: userNumber, channel: "rcs" } });
      const failedMessages = await Message.count({ where: { sender: userNumber, status: "failed" } });

      // 2. Flow Metrics
      const activeFlows = await Flow.count({ where: { userNumber, isActive: true } });
      const activeSessions = await FlowSession.count({ where: { userNumber } });

      // 3. Campaign Metrics
      const totalCampaigns = await Campaign.count({ where: { sender: userNumber } });

      // 4. User & Subscription
      const user = await User.findOne({
        where: { number: userNumber },
        attributes: ["name", "number", "validDays", "createdAt", "isActive", "apiKey"]
      });

      const expiry = Number(user.createdAt) + (user.validDays * 86400000);
      const daysRemaining = Math.max(0, Math.ceil((expiry - Date.now()) / 86400000));

      // 5. Recent Activity
      const recentActivity = await Message.findAll({
        where: { sender: userNumber },
        limit: 10,
        order: [["createdAt", "DESC"]]
      });

      // 6. Device Status
      const device = sessionStatus[userNumber] || { status: "not_connected" };

      res.status(200).json({
        status: true,
        message: "Dashboard data fetched",
        result: {
          metrics: {
            messages: {
                whatsapp: totalWhatsApp,
                rcs: totalRCS,
                failed: failedMessages,
                total: totalWhatsApp + totalRCS
            },
            flows: {
                activeFlows,
                currentLiveSessions: activeSessions
            },
            campaigns: {
                total: totalCampaigns
            }
          },
          account: {
            name: user.name,
            number: user.number,
            planDaysRemaining: daysRemaining,
            isActive: user.isActive,
            apiKey: user.apiKey,
            deviceStatus: device.status
          },
          recentActivity
        }
      });

    } catch (error) {
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
