const idleModel = require("../models/idle.model");
const errandModel = require("../models/errand.model");
const reportModel = require("../models/report.model");
const { success, failure } = require("../utils/response");

async function getBusinessRecord(businessType, businessId) {
  if (businessType === "idle") {
    const record = await idleModel.findById(businessId);
    if (!record) {
      return null;
    }

    return {
      ownerId: Number(record.user_id),
      title: record.title
    };
  }

  if (businessType === "errand") {
    const record = await errandModel.findById(businessId);
    if (!record) {
      return null;
    }

    return {
      ownerId: Number(record.publisher_id),
      title: record.title
    };
  }

  return null;
}

async function submit(req, res) {
  const businessType = String(req.body.businessType || "").trim();
  const businessId = Number(req.body.businessId || 0);
  const reason = String(req.body.reason || "").trim();

  if (!["idle", "errand"].includes(businessType) || !businessId || !reason) {
    return res.status(400).json(failure("举报参数不完整"));
  }

  const business = await getBusinessRecord(businessType, businessId);
  if (!business) {
    return res.status(404).json(failure("举报内容不存在", 404));
  }

  if (business.ownerId === Number(req.user.id)) {
    return res.status(400).json(failure("不能举报自己发布的内容"));
  }

  const report = await reportModel.upsert({
    business_type: businessType,
    business_id: businessId,
    latest_reason: reason,
    latest_reporter_id: req.user.id
  });

  return res.json(
    success(
      {
        reportId: report?.report_id || 0,
        businessType,
        businessId,
        reportCount: Number(report?.report_count || 1)
      },
      "举报已提交，平台会尽快处理"
    )
  );
}

module.exports = {
  submit
};
