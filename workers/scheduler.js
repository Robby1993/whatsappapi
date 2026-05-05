const ScheduledMessage = require("../models/ScheduledMessage");
const MessageLog = require("../models/MessageLog");
const Stat = require("../models/Stat");
const { Op } = require("sequelize");

module.exports = function(sessions, sessionStatus, startSession) {
  setInterval(async () => {
    try {
      const now = Date.now();
      // Find all pending messages that are due
      const pending = await ScheduledMessage.findAll({
        where: {
          status: "pending",
          scheduleTime: { [Op.lte]: now }
        }
      });

      for (const msg of pending) {
        if (!sessions[msg.sender] || sessionStatus[msg.sender]?.status !== "connected") {
          console.log(`⏰ Scheduler: Sender ${msg.sender} not connected, attempting to start...`);
          startSession(msg.sender);
          continue;
        }
        try {
          const jid = msg.receiver.replace(/\D/g, "") + "@s.whatsapp.net";
          await sessions[msg.sender].sendMessage(jid, { text: msg.message });

          await msg.update({ status: "sent" });

          await MessageLog.create({
            sender: msg.sender,
            receiver: msg.receiver,
            message: msg.message,
            status: "sent"
          });

          // Increment global stats
          const [stat] = await Stat.findOrCreate({ where: { id: 1 }, defaults: { totalMessagesSent: 0 } });
          await stat.increment('totalMessagesSent');

        } catch (e) {
          console.error(`❌ Scheduler error for ${msg.receiver}:`, e.message);
          // If message is older than 1 hour, mark as failed
          if (now - Number(msg.scheduleTime) > 3600000) {
            await msg.update({ status: "failed" });
          }
        }
      }
    } catch (e) {
      console.error("Scheduler worker interval error:", e.message);
    }
  }, 30000);
};
