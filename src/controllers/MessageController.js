const MessagingService = require("../services/MessagingService");
const Message = require("../../models/Message");

class MessageController {
  async sendWhatsApp(req, res) {
    try {
      const { receiver, type, content, metadata, from } = req.body;
      const sender = from || req.userNumber;

      const message = await MessagingService.send({
        channel: "whatsapp",
        sender,
        receiver,
        type: type || "text",
        content,
        metadata
      });

      res.status(200).json({ status: true, message: "Message sent", data: message });
    } catch (error) {
      res.status(500).json({ status: false, error: error.message });
    }
  }

  async sendRCS(req, res) {
    try {
      const { receiver, type, content, metadata } = req.body;

      const message = await MessagingService.send({
        channel: "rcs",
        sender: "SYSTEM", // Or from agent config
        receiver,
        type: type || "text",
        content,
        metadata
      });

      res.status(200).json({ status: true, message: "RCS Message sent", data: message });
    } catch (error) {
      res.status(500).json({ status: false, error: error.message });
    }
  }

  async getStatus(req, res) {
    try {
      const { id } = req.params;
      const message = await Message.findByPk(id);
      if (!message) return res.status(404).json({ status: false, message: "Message not found" });

      res.status(200).json({ status: true, data: message });
    } catch (error) {
      res.status(500).json({ status: false, error: error.message });
    }
  }

  async broadcast(req, res) {
    try {
      const { channel, receivers, type, content, metadata, from } = req.body;
      const sender = from || req.userNumber;

      const results = await MessagingService.broadcast({
        channel,
        sender,
        receivers,
        type,
        content,
        metadata
      });

      res.status(200).json({ status: true, results });
    } catch (error) {
      res.status(500).json({ status: false, error: error.message });
    }
  }
}

module.exports = new MessageController();
