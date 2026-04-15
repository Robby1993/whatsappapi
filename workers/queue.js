const QueuedMessage = require("../models/QueuedMessage");
const Campaign = require("../models/Campaign");
const MessageLog = require("../models/MessageLog");
const Stat = require("../models/Stat");

const delay = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = function(sessions, sessionStatus, startSession) {
  setInterval(async () => {
    try {
      // Find one pending message
      const msg = await QueuedMessage.findOne({ where: { status: "pending" } });
      if (!msg) return;

      // Mark as processing
      await msg.update({ status: "processing" });

      if (!sessions[msg.sender] || sessionStatus[msg.sender]?.status !== "connected") {
        console.log(`⏳ Queue: Sender ${msg.sender} not connected, skipping...`);
        await msg.update({ status: "pending" });
        return;
      }

      try {
        const jid = msg.receiver.replace(/\D/g, "") + "@s.whatsapp.net";
        await sessions[msg.sender].sendMessage(jid, { text: msg.message });

        await msg.update({ status: "sent" });

        if (msg.campaignId) {
          const campaign = await Campaign.findByPk(msg.campaignId);
          if (campaign) {
            await campaign.increment('sentCount');
            if (campaign.sentCount + campaign.failedCount >= campaign.totalContacts) {
              await campaign.update({ status: "completed" });
            }
          }
        }

        await MessageLog.create({
          sender: msg.sender,
          receiver: msg.receiver,
          message: msg.message,
          status: "sent",
          campaignId: msg.campaignId
        });

        // Increment global stats
        const [stat] = await Stat.findOrCreate({ where: { id: 1 }, defaults: { totalMessagesSent: 0 } });
        await stat.increment('totalMessagesSent');

        await delay(2000); // Throttling
      } catch (e) {
        console.error(`❌ Error sending queued message to ${msg.receiver}:`, e.message);
        await msg.update({ status: "failed" });
        if (msg.campaignId) {
          const campaign = await Campaign.findByPk(msg.campaignId);
          if (campaign) await campaign.increment('failedCount');
        }
      }
    } catch (e) {
      console.error("Queue worker interval error:", e.message);
    }
  }, 10000);
};
