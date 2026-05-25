const userModel = require("../models/user.model");
const idleModel = require("../models/idle.model");
const errandModel = require("../models/errand.model");
const auditModel = require("../models/audit.model");
const dashboardModel = require("../models/dashboard.model");
const systemSettingModel = require("../models/system-setting.model");
const { getPagination, buildPageResult } = require("../utils/pagination");
const { success, failure } = require("../utils/response");

function parseLimitedNumber(value, { min, max, integer = false, fieldName }) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName}参数不正确`);
  }

  const normalized = integer ? Math.floor(parsed) : parsed;

  if (normalized < min || normalized > max) {
    throw new Error(`${fieldName}取值范围为 ${min} 到 ${max}`);
  }

  return normalized;
}

async function getUserList(req, res) {
  const pagination = getPagination(req.query);
  const result = await userModel.list(req.query, pagination);
  return res.json(
    success(buildPageResult(result.list, result.total, pagination.pageNum, pagination.pageSize))
  );
}

async function updateUserStatus(req, res) {
  const { userId, status } = req.body;
  if (!userId && userId !== 0) {
    return res.status(400).json(failure("userId 不能为空"));
  }

  const parsedStatus = Number(status);
  if (Number.isNaN(parsedStatus)) {
    return res.status(400).json(failure("status 参数不正确"));
  }

  const currentUser = await userModel.findById(userId);
  if (!currentUser) {
    return res.status(404).json(failure("用户不存在", 404));
  }

  await userModel.updateStatus(userId, parsedStatus);

  if (Number(currentUser.status) !== parsedStatus && parsedStatus !== 1) {
    await auditModel.addLog({
      admin_id: req.user.id,
      business_type: "user",
      business_id: Number(userId),
      audit_result: 4,
      audit_reason: "账号封禁"
    });
  }

  return res.json(success(null, "用户状态更新成功"));
}

async function getOverview(req, res) {
  const [userTotal, idlePending, errandPending] = await Promise.all([
    userModel.countAll(),
    idleModel.countPending(),
    errandModel.countPending()
  ]);

  return res.json(
    success({
      userTotal,
      pendingAuditTotal: idlePending + errandPending,
      idlePending,
      errandPending
    })
  );
}

async function getDashboardAnalytics(req, res) {
  const granularity = String(req.query.granularity || "day").trim();
  const targetDate = String(req.query.targetDate || "").trim();
  const data = await dashboardModel.getDashboardAnalytics(granularity, targetDate);
  return res.json(success(data));
}

async function getSettings(req, res) {
  const settings = await systemSettingModel.getSettings();

  return res.json(
    success({
      projectName: "校园便利服务综合平台",
      uploadMaxSizeMb: settings.uploadMaxSizeMb,
      uploadLimitMb: settings.uploadMaxSizeMb,
      idleMaxImages: settings.idleMaxImages,
      errandMaxImages: settings.errandMaxImages,
      amapEnabled: Boolean(process.env.AMAP_KEY),
      wxMockEnabled: false
    })
  );
}

async function updateSettings(req, res) {
  let nextSettings;

  try {
    nextSettings = {
      uploadMaxSizeMb: parseLimitedNumber(req.body.uploadMaxSizeMb, {
        min: 0,
        max: 100,
        fieldName: "单张图片大小限制"
      }),
      idleMaxImages: parseLimitedNumber(req.body.idleMaxImages, {
        min: 1,
        max: 50,
        integer: true,
        fieldName: "闲置图片数量限制"
      }),
      errandMaxImages: parseLimitedNumber(req.body.errandMaxImages, {
        min: 1,
        max: 50,
        integer: true,
        fieldName: "代拿图片数量限制"
      })
    };
  } catch (error) {
    return res.status(400).json(failure(error.message));
  }

  const settings = await systemSettingModel.updateSettings(nextSettings);
  return res.json(success(settings, "系统设置保存成功"));
}

module.exports = {
  getUserList,
  updateUserStatus,
  getOverview,
  getDashboardAnalytics,
  getSettings,
  updateSettings
};
