const ScheduledMessage = require("../models/ScheduledMessage");
const MessageLog = require("../models/MessageLog");
const Stat = require("../models/Stat");

module.exports = function(sessions, sessionStatus, startSession) {
  setInterval(async () => {
    try {
      const now = Date.now();
      const pending = await ScheduledMessage.find({ status: "pending", scheduleTime: { $lte: now } });

      for (const msg of pending) {
        if (!sessions[msg.sender] || sessionStatus[msg.sender]?.status !== "connected") {
          // Attempt to restore session if it exists
          continue;
        }
        try {
          const jid = msg.receiver.replace(/\D/g, "") + "@s.whatsapp.net";
          await sessions[msg.sender].sendMessage(jid, { text: msg.message });

          msg.status = "sent";
          await msg.save();

          await MessageLog.create({
            sender: msg.sender,
            receiver: msg.receiver,
            message: msg.message,
            status: "sent"
          });

          await Stat.findOneAndUpdate({}, { $inc: { totalMessagesSent: 1 } }, { upsert: true });
        } catch (e) {
          if (now - msg.scheduleTime > 3600000) {
            msg.status = "failed";
            await msg.save();
          }
        }
      }
    } catch (e) {
      console.error("Scheduler worker error:", e.message);
    }
  }, 30000);
};
