const express = require("express");
const systemController = require("../controllers/system.controller");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

router.get("/settings", asyncHandler(systemController.getPublicSettings));

module.exports = router;
