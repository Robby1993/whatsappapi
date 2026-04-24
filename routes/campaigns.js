const express = require("express");
const campaignController = require("../controllers/CampaignController");
const { authenticate } = require("../middleware/auth");
const router = express.Router();

router.use(authenticate);

router.post("/", campaignController.create);
router.get("/", campaignController.list);
router.get("/:id", campaignController.getOne);
router.delete("/:id", campaignController.delete);

module.exports = router;
