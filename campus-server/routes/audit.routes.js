const express = require("express");
const auditController = require("../controllers/audit.controller");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

router.get("/list", asyncHandler(auditController.list));
router.get("/detail", asyncHandler(auditController.detail));
router.put("/handle", asyncHandler(auditController.handle));
router.put("/remove", asyncHandler(auditController.remove));
router.delete("/delete", asyncHandler(auditController.deleteContent));

module.exports = router;
