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
    } catch (e) {
      console.error("RCS Auth Error:", e.message);
      return null;
    }
  }

  async sendMessage(sender, receiver, type, content, metadata = {}) {
    let rcsMessageId = `rcs-${Date.now()}`;
    let status = "pending";
    let errorMessage = null;

    try {
      const token = await this.getAccessToken();
      const msisdn = receiver.startsWith("+") ? receiver : `+${receiver}`;

      let rcsPayload = { messageId: rcsMessageId };
      if (type === "text") rcsPayload.text = content;
      else if (["image", "video"].includes(type)) rcsPayload.contentInfo = { fileUrl: content };
      else if (type === "rich_card") rcsPayload.richCard = metadata.richCard;

      if (token) {
        try {
          await axios.post(`${this.baseUrl}/phones/${msisdn}/messages`, rcsPayload, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            }
          });
          status = "sent";
        } catch (apiError) {
          status = "failed";
          // Capture detailed error from Google API
          const detail = apiError.response?.data?.error?.message || apiError.message;
          errorMessage = `Google API Error: ${detail}`;

          if (detail.includes("not a test device")) {
            errorMessage = "FAILED: Receiver is not registered as a Test Device in RBM Console.";
          } else if (detail.includes("permission denied")) {
            errorMessage = "FAILED: Google Service Account permissions are incorrect.";
          }

          throw new Error(errorMessage);
        }
      } else {
        status = "simulated";
        errorMessage = "WARNING: No google-key.json found. Message was NOT sent to a real phone.";
        console.log("🛠 [Simulated RCS]:", rcsPayload);
      }

      const msgRecord = await Message.create({
        externalId: rcsMessageId,
        sender: this.agentId || "RCS_AGENT",
        receiver,
        channel: "rcs",
        type,
        content: typeof content === 'string' ? content : JSON.stringify(content),
        status: status,
        errorMessage: errorMessage,
        metadata
      });

      // If simulated, we still return the record but the controller can handle the warning
      return msgRecord;

    } catch (error) {
      // Create a failed message record even on catch
      await Message.create({
        externalId: rcsMessageId,
        sender: this.agentId || "RCS_AGENT",
        receiver,
        channel: "rcs",
        type,
        content: String(content),
        status: "failed",
        errorMessage: error.message
      });
      throw error;
    }
  }
}

module.exports = new RCSService();
