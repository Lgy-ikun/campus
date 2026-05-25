const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRoles } = require("../middlewares/role.middleware");
const asyncHandler = require("../utils/async-handler");

const authRoutes = require("./auth.routes");
const adminRoutes = require("./admin.routes");
const userRoutes = require("./user.routes");
const idleRoutes = require("./idle.routes");
const errandRoutes = require("./errand.routes");
const auditRoutes = require("./audit.routes");
const chatRoutes = require("./chat.routes");
const noticeRoutes = require("./notice.routes");
const uploadRoutes = require("./upload.routes");
const mapRoutes = require("./map.routes");
const reportRoutes = require("./report.routes");
const systemRoutes = require("./system.routes");
const uploadController = require("../controllers/upload.controller");

const router = express.Router();

router.use("/auth", authRoutes);
router.get("/upload/file", asyncHandler(uploadController.previewImage));
router.use("/system", systemRoutes);
router.use("/admin", authMiddleware, requireRoles("admin"), adminRoutes);
router.use("/admin/audit", authMiddleware, requireRoles("admin"), auditRoutes);
router.use("/user", authMiddleware, userRoutes);
router.use("/idle", authMiddleware, requireRoles("user"), idleRoutes);
router.use("/errand", authMiddleware, requireRoles("user"), errandRoutes);
router.use("/report", authMiddleware, requireRoles("user"), reportRoutes);
router.use("/chat", authMiddleware, chatRoutes);
router.use("/notice", authMiddleware, noticeRoutes);
router.use("/upload", authMiddleware, uploadRoutes);
router.use("/map", authMiddleware, mapRoutes);

module.exports = router;
