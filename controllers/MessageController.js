const MessagingService = require("../services/MessagingService");
const Message = require("../models/Message");

class MessageController {
  async sendWhatsApp(req, res) {
    try {
      const { receiver, type, content, metadata, from } = req.body;
      const message = await MessagingService.send({
        channel: "whatsapp", sender: from || req.userNumber, receiver, type: type || "text", content, metadata
      });
      res.status(200).json({ status: true, message: "Message sent", data: message });
    } catch (error) { res.status(500).json({ status: false, error: error.message }); }
  }

  async sendRCS(req, res) {
    try {
      const { receiver, type, content, metadata } = req.body;
      const message = await MessagingService.send({
        channel: "rcs", sender: "SYSTEM", receiver, type: type || "text", content, metadata
      });
      res.status(200).json({ status: true, message: "RCS Message sent", data: message });
    } catch (error) { res.status(500).json({ status: false, error: error.message }); }
  }

  async getStatus(req, res) {
    try {
      const message = await Message.findByPk(req.params.id);
      if (!message) return res.status(404).json({ status: false, message: "Message not found" });
      res.status(200).json({ status: true, data: message });
    } catch (error) { res.status(500).json({ status: false, error: error.message }); }
  }

  async broadcast(req, res) {
    try {
      const { channel, receivers, type, content, metadata, from } = req.body;
      const results = await MessagingService.broadcast({
        channel, sender: from || req.userNumber, receivers, type, content, metadata
      });
      res.status(200).json({ status: true, results });
    } catch (error) { res.status(500).json({ status: false, error: error.message }); }
  }
}

module.exports = new MessageController();
