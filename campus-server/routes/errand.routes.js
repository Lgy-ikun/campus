const express = require("express");
const errandController = require("../controllers/errand.controller");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

router.post("/add", asyncHandler(errandController.add));
router.put("/update/:id", asyncHandler(errandController.update));
router.get("/list", asyncHandler(errandController.list));
router.get("/detail/:id", asyncHandler(errandController.detail));
router.put("/receive/:id", asyncHandler(errandController.receive));
router.put("/cancel/:id", asyncHandler(errandController.cancel));
router.put("/release/:id", asyncHandler(errandController.release));
router.put("/updateStatus/:id", asyncHandler(errandController.updateStatus));
router.get("/myList", asyncHandler(errandController.myList));

module.exports = router;
