const express = require("express");
const MessageController = require("../controllers/MessageController");
const apiKeyAuth = require("../middleware/apiKeyAuth");
const router = express.Router();

// Public/Internal Webhooks
router.post("/webhook/whatsapp", (req, res) => {
    // Handle Baileys webhooks
    res.sendStatus(200);
});

router.post("/webhook/rcs", (req, res) => {
    // Handle Google RCS webhooks (Delivery status, incoming messages)
    console.log("RCS Webhook:", req.body);
    res.sendStatus(200);
});

// Protected API Routes
router.use(apiKeyAuth);

router.post("/whatsapp/send", MessageController.sendWhatsApp);
router.post("/whatsapp/broadcast", MessageController.broadcast);

router.post("/rcs/send", MessageController.sendRCS);
router.post("/rcs/media", MessageController.sendRCS); // Uses same controller with type=image/video
router.post("/rcs/rich-card", (req, res) => {
    req.body.type = "rich_card";
    MessageController.sendRCS(req, res);
});

router.get("/message/status/:id", MessageController.getStatus);
router.post("/broadcast", MessageController.broadcast);

module.exports = router;
