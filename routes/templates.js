const express = require("express");
const templateController = require("../controllers/TemplateController");
const { authenticate } = require("../middleware/auth");
const router = express.Router();

router.use(authenticate);

router.post("/", templateController.create);
router.get("/", templateController.list);
router.get("/:keyword", templateController.getOne);
router.put("/:keyword", templateController.update);
router.delete("/:keyword", templateController.delete);

module.exports = router;
