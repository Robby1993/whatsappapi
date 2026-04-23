const axios = require("axios");
const { GoogleAuth } = require("google-auth-library");
const Message = require("../models/Message");
const path = require("path");
const fs = require("fs");

class RCSService {
  constructor() {
    this.baseUrl = "https://rcsbusinessmessaging.googleapis.com/v1";
    this.agentId = process.env.RCS_AGENT_ID;
    const keyPath = path.join(__dirname, "../google-key.json");

    if (fs.existsSync(keyPath)) {
      this.auth = new GoogleAuth({
        keyFile: keyPath,
        scopes: "https://www.googleapis.com/auth/rcsbusinessmessaging",
      });
    }
  }

  async getAccessToken() {
    if (!this.auth) return null;
    try {
      const client = await this.auth.getClient();
      const token = await client.getAccessToken();
      return token.token;
    } catch (e) { return null; }
  }

  async sendMessage(sender, receiver, type, content, metadata = {}) {
    try {
      const token = await this.getAccessToken();
      const msisdn = receiver.startsWith("+") ? receiver : `+${receiver}`;
      let rcsMessage = { messageId: `rcs-${Date.now()}` };

      if (type === "text") rcsMessage.text = content;
      else if (["image", "video"].includes(type)) rcsMessage.contentInfo = { fileUrl: content };
      else if (type === "rich_card") rcsMessage.richCard = metadata.richCard;

      if (token) {
        await axios.post(`${this.baseUrl}/phones/${msisdn}/messages`, rcsMessage, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      return await Message.create({
        externalId: rcsMessage.messageId,
        sender: this.agentId || "RCS_AGENT",
        receiver,
        channel: "rcs",
        type,
        content: typeof content === 'string' ? content : JSON.stringify(content),
        status: token ? "sent" : "simulated",
        metadata
      });
    } catch (error) { throw error; }
  }
}

module.exports = new RCSService();
