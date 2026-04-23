const { sessions, sessionStatus } = require("../routes/whatsapp");
const Message = require("../models/Message");

class WhatsAppService {
  async sendMessage(sender, receiver, type, content, metadata = {}) {
    try {
      const sock = sessions[sender];
      if (!sock || sessionStatus[sender]?.status !== "connected") {
        throw new Error(`WhatsApp session for ${sender} is not connected`);
      }

      const jid = receiver.replace(/\D/g, "") + "@s.whatsapp.net";
      let messagePayload = {};

      switch (type) {
        case "text":
          messagePayload = { text: content };
          break;
        case "image":
        case "video":
        case "audio":
        case "document":
          messagePayload = { [type]: { url: content }, caption: metadata.caption };
          break;
        default:
          throw new Error(`Unsupported message type: ${type}`);
      }

      const result = await sock.sendMessage(jid, messagePayload);

      return await Message.create({
        externalId: result.key.id,
        sender,
        receiver,
        channel: "whatsapp",
        type,
        content,
        status: "sent",
        metadata
      });
    } catch (error) {
      console.error("WhatsApp Send Error:", error.message);
      throw error;
    }
  }
}

module.exports = new WhatsAppService();
