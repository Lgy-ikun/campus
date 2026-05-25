const express = require("express");
const noticeController = require("../controllers/notice.controller");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

router.get("/list", asyncHandler(noticeController.list));
router.get("/unreadCount", asyncHandler(noticeController.unreadCount));
router.put("/read/:id", asyncHandler(noticeController.read));
router.put("/readAll", asyncHandler(noticeController.readAll));

module.exports = router;