const express = require("express");
const idleController = require("../controllers/idle.controller");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

router.post("/add", asyncHandler(idleController.add));
router.put("/update/:id", asyncHandler(idleController.update));
router.get("/list", asyncHandler(idleController.list));
router.get("/detail/:id", asyncHandler(idleController.detail));
router.get("/myList", asyncHandler(idleController.myList));
router.put("/down/:id", asyncHandler(idleController.down));

module.exports = router;
