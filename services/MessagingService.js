const WhatsAppService = require("./WhatsAppService");
const RCSService = require("./RCSService");

class MessagingService {
  async send(params) {
    const { channel, sender, receiver, type, content, metadata } = params;
    if (channel === "whatsapp") return await WhatsAppService.sendMessage(sender, receiver, type, content, metadata);
    if (channel === "rcs") return await RCSService.sendMessage(sender, receiver, type, content, metadata);
    throw new Error(`Invalid channel: ${channel}`);
  }

  async broadcast(params) {
    const { channel, sender, receivers, type, content, metadata } = params;
    const results = [];
    for (const receiver of receivers) {
      try {
        const res = await this.send({ channel, sender, receiver, type, content, metadata });
        results.push({ receiver, status: "success", messageId: res.id });
      } catch (error) {
        results.push({ receiver, status: "failed", error: error.message });
      }
    }
    return results;
  }
}

module.exports = new MessagingService();
