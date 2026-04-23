const express = require("express");
const MessageController = require("../controllers/MessageController");
const apiKeyAuth = require("../middleware/apiKeyAuth");
const router = express.Router();

router.post("/webhook/whatsapp", (req, res) => res.sendStatus(200));
router.post("/webhook/rcs", (req, res) => res.sendStatus(200));

router.use(apiKeyAuth);

router.post("/whatsapp/send", MessageController.sendWhatsApp);
router.post("/whatsapp/broadcast", MessageController.broadcast);
router.post("/rcs/send", MessageController.sendRCS);
router.post("/rcs/media", MessageController.sendRCS);
router.post("/rcs/rich-card", (req, res) => {
    req.body.type = "rich_card";
    MessageController.sendRCS(req, res);
});
router.get("/message/status/:id", MessageController.getStatus);
router.post("/broadcast", MessageController.broadcast);

module.exports = router;
