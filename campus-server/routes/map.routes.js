const express = require("express");
const mapController = require("../controllers/map.controller");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

router.get("/regeo", asyncHandler(mapController.regeo));
router.get("/poiSearch", asyncHandler(mapController.poiSearch));

module.exports = router;
