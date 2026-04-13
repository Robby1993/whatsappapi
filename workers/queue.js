const QueuedMessage = require("../models/QueuedMessage");
const Campaign = require("../models/Campaign");
const MessageLog = require("../models/MessageLog");
const Stat = require("../models/Stat");

const delay = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = function(sessions, sessionStatus, startSession) {
  setInterval(async () => {
    try {
      const msg = await QueuedMessage.findOneAndUpdate({ status: "pending" }, { status: "processing" });
      if (!msg) return;

      if (!sessions[msg.sender] || sessionStatus[msg.sender]?.status !== "connected") {
        // If session exists but not connected, try to start it
        // Note: startSession is async, we don't necessarily want to await it here to block the interval
        msg.status = "pending";
        await msg.save();
        return;
      }

      try {
        const jid = msg.receiver.replace(/\D/g, "") + "@s.whatsapp.net";
        await sessions[msg.sender].sendMessage(jid, { text: msg.message });

        msg.status = "sent";
        await msg.save();

        if (msg.campaignId) {
          await Campaign.findByIdAndUpdate(msg.campaignId, { $inc: { sentCount: 1 } });
          const camp = await Campaign.findById(msg.campaignId);
          if (camp && camp.sentCount + camp.failedCount >= camp.totalContacts) {
            await Campaign.findByIdAndUpdate(msg.campaignId, { status: "completed" });
          }
        }

        await MessageLog.create({
          sender: msg.sender,
          receiver: msg.receiver,
          message: msg.message,
          status: "sent",
          campaignId: msg.campaignId
        });

        await Stat.findOneAndUpdate({}, { $inc: { totalMessagesSent: 1 } }, { upsert: true });

        await delay(2000); // Throttling
      } catch (e) {
        console.error(`Error sending queued message to ${msg.receiver}:`, e.message);
        msg.status = "failed";
        await msg.save();
        if (msg.campaignId) {
          await Campaign.findByIdAndUpdate(msg.campaignId, { $inc: { failedCount: 1 } });
        }
      }
    } catch (e) {
      console.error("Queue worker interval error:", e.message);
    }
  }, 10000);
};
