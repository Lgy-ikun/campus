const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const authController = require("../controllers/auth.controller");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

router.post("/sendSmsCode", asyncHandler(authController.sendLoginSmsCode));
router.post("/phoneLogin", asyncHandler(authController.phoneLogin));
router.post("/phoneOneClickLogin", asyncHandler(authController.phoneOneClickLogin));
router.post("/wxLogin", asyncHandler(authController.wxLogin));
router.post("/adminLogin", asyncHandler(authController.adminLogin));
router.put("/updatePassword", authMiddleware, asyncHandler(authController.updatePassword));
router.get("/userInfo", authMiddleware, asyncHandler(authController.userInfo));

module.exports = router;
