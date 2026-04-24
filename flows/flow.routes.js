const express = require("express");
const flowController = require("./flow.controller");
const { authenticate } = require("../middleware/auth");
const router = express.Router();

router.use(authenticate);

router.post("/", flowController.create);
router.get("/", flowController.list);
router.get("/:id", flowController.getOne);
router.put("/:id", flowController.update);
router.delete("/:id", flowController.delete);

module.exports = router;
