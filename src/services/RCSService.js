const axios = require("axios");
const { GoogleAuth } = require("google-auth-library");
const Message = require("../../models/Message");
const path = require("path");
const fs = require("fs");

class RCSService {
  constructor() {
    this.baseUrl = "https://rcsbusinessmessaging.googleapis.com/v1";
    this.agentId = process.env.RCS_AGENT_ID;

    // Path to your Google Service Account key file
    const keyPath = path.join(__dirname, "../../google-key.json");

    if (fs.existsSync(keyPath)) {
      this.auth = new GoogleAuth({
        keyFile: keyPath,
        scopes: "https://www.googleapis.com/auth/rcsbusinessmessaging",
      });
    } else {
      console.warn("⚠️ google-key.json not found. RCS messages will fail in production.");
    }
  }

  async getAccessToken() {
    if (!this.auth) return null;
    const client = await this.auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
  }

  async sendMessage(sender, receiver, type, content, metadata = {}) {
    try {
      const token = await this.getAccessToken();
      if (!token && process.env.NODE_ENV === "production") {
        throw new Error("RCS Access Token could not be generated. Check google-key.json");
      }

      const msisdn = receiver.startsWith("+") ? receiver : `+${receiver}`;

      let rcsMessage = {
        messageId: `rcs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };

      // Construct payload based on type
      if (type === "text") {
        rcsMessage.text = content;
      } else if (["image", "video"].includes(type)) {
        rcsMessage.contentInfo = {
          fileUrl: content,
          forceRefresh: false
        };
      } else if (type === "rich_card") {
        rcsMessage.richCard = metadata.richCard;
      }

      // In production, we call the real API
      if (token) {
        await axios.post(
          `${this.baseUrl}/phones/${msisdn}/messages`,
          rcsMessage,
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
        );
      } else {
        console.log("🛠 [Simulated] Sending RCS Message:", rcsMessage);
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

    } catch (error) {
      console.error("RCS Send Error:", error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new RCSService();
