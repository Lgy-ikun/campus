const express = require("express");
const userController = require("../controllers/user.controller");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

router.get("/profile", asyncHandler(userController.getProfile));
router.put("/profile", asyncHandler(userController.updateProfile));

module.exports = router;
