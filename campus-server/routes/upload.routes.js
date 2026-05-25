const express = require("express");
const { imageUpload } = require("../middlewares/upload.middleware");
const uploadController = require("../controllers/upload.controller");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

router.post("/image", imageUpload, asyncHandler(uploadController.uploadImage));

module.exports = router;
