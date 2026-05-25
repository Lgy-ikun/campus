const express = require("express");
const adminController = require("../controllers/admin.controller");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

router.get("/user/list", asyncHandler(adminController.getUserList));
router.put("/user/status", asyncHandler(adminController.updateUserStatus));

router.get("/system/overview", asyncHandler(adminController.getOverview));
router.get("/system/dashboard", asyncHandler(adminController.getDashboardAnalytics));
router.get("/system/settings", asyncHandler(adminController.getSettings));
router.put("/system/settings", asyncHandler(adminController.updateSettings));

module.exports = router;
