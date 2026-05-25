const express = require("express");
const chatController = require("../controllers/chat.controller");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

router.get("/record", asyncHandler(chatController.record));
router.post("/send", asyncHandler(chatController.send));
router.get("/sessionList", asyncHandler(chatController.sessionList));
router.put("/pin", asyncHandler(chatController.pin));
router.put("/deleteSession", asyncHandler(chatController.deleteSession));
router.get("/unreadCount", asyncHandler(chatController.unreadCount));
router.put("/read", asyncHandler(chatController.read));

module.exports = router;
