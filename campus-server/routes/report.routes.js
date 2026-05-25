const express = require("express");
const reportController = require("../controllers/report.controller");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

router.post("/submit", asyncHandler(reportController.submit));

module.exports = router;
