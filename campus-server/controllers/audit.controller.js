const auditModel = require("../models/audit.model");
const idleModel = require("../models/idle.model");
const errandModel = require("../models/errand.model");
const reportModel = require("../models/report.model");
const { query } = require("../models");
const { getPagination, buildPageResult } = require("../utils/pagination");
const { success, failure } = require("../utils/response");
const { safeCreateSystemNotice } = require("../utils/notice");

function normalizeImagesField(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getOperationType(businessType, status, latestAuditResult) {
  if (Number(latestAuditResult) === 4) {
    return "delete";
  }

  if (Number(status) === 0) {
    return "pending";
  }

  if (Number(latestAuditResult) === 3) {
    return "remove";
  }

  if (Number(latestAuditResult) === 2) {
    return "reject";
  }

  if (Number(latestAuditResult) === 1) {
    return "approve";
  }

  if (businessType === "idle") {
    if (Number(status) === 2) return "reject";
    if (Number(status) === 3) return "remove";
    if ([1, 4].includes(Number(status))) return "approve";
  }

  if (businessType === "errand") {
    if (Number(status) === 6) return "reject";
    if (Number(status) === 7) return "remove";
    if ([1, 2, 3, 4, 5].includes(Number(status))) return "approve";
  }

  return "unknown";
}

function normalizeListRow(row) {
  return {
    ...row,
    images: normalizeImagesField(row.images),
    latest_audit_result:
      row.latest_audit_result === null || row.latest_audit_result === undefined
        ? null
        : Number(row.latest_audit_result),
    operation_type:
      row.operation_type || getOperationType(row.business_type, row.status, row.latest_audit_result),
    report_count: Number(row.report_count || 0),
    is_reported: Number(row.is_reported || 0) === 1
  };
}

function normalizeDetailRow(row) {
  return {
    ...row,
    images: normalizeImagesField(row.images)
  };
}

async function getBusinessRecord(businessType, businessId) {
  if (businessType === "idle") {
    const record = await idleModel.findById(businessId);
    return record
      ? {
          record,
          publisherId: Number(record.user_id),
          publisherName: record.nickname || "",
          title: record.title
        }
      : null;
  }

  if (businessType === "errand") {
    const record = await errandModel.findById(businessId);
    return record
      ? {
          record,
          publisherId: Number(record.publisher_id),
          publisherName: record.publisher_name || "",
          title: record.title
        }
      : null;
  }

  return null;
}

async function cleanupBusinessRelations(businessType, businessId) {
  await Promise.all([
    query("DELETE FROM chat_message WHERE related_type = ? AND related_id = ?", [businessType, businessId]),
    query(
      "DELETE FROM chat_session_preference WHERE related_type = ? AND related_id = ?",
      [businessType, businessId]
    ),
    query("DELETE FROM system_notice WHERE related_type = ? AND related_id = ?", [businessType, businessId]),
    reportModel.removeByBusiness(businessType, businessId)
  ]);
}

async function markReportHandled(businessType, businessId, adminId, handleNote) {
  await reportModel.markHandled({
    businessType,
    businessId,
    adminId,
    handleNote
  });
}

async function list(req, res) {
  const pagination = getPagination(req.query);
  const result = await auditModel.listContents(req.query, pagination);

  return res.json(
    success(
      buildPageResult(
        result.list.map(normalizeListRow),
        result.total,
        pagination.pageNum,
        pagination.pageSize
      )
    )
  );
}

async function detail(req, res) {
  const businessType = String(req.query.businessType || "").trim();
  const businessId = Number(req.query.businessId || 0);

  if (!businessType || !businessId) {
    return res.status(400).json(failure("缺少内容详情参数"));
  }

  const business = await getBusinessRecord(businessType, businessId);
  if (!business) {
    return res.status(404).json(failure("内容不存在", 404));
  }

  const latestLog = await auditModel.findLatestLog(businessType, businessId);
  const reportInfo = await reportModel.findByBusiness(businessType, businessId);

  return res.json(
    success({
      businessType,
      businessId,
      record: normalizeDetailRow(business.record),
      latestAudit: latestLog
        ? {
            ...latestLog,
            audit_result: Number(latestLog.audit_result),
            operation_type: getOperationType(businessType, business.record.status, latestLog.audit_result)
          }
        : {
            audit_result: null,
            audit_reason: "",
            create_time: null,
            admin_id: null,
            admin_name: "",
            admin_username: "",
            operation_type: getOperationType(businessType, business.record.status, null)
          },
      reportInfo: reportInfo
        ? {
            ...reportInfo,
            report_count: Number(reportInfo.report_count || 0),
            is_handled: Number(reportInfo.is_handled || 0) === 1
          }
        : null
    })
  );
}

async function handle(req, res) {
  const businessType = String(req.body.businessType || "").trim();
  const parsedBusinessId = Number(req.body.businessId || 0);
  const parsedAuditResult = Number(req.body.auditResult);
  const auditReason = String(req.body.auditReason || "").trim();

  if (!businessType || !parsedBusinessId || Number.isNaN(parsedAuditResult)) {
    return res.status(400).json(failure("审核参数不完整"));
  }

  if (![1, 2].includes(parsedAuditResult)) {
    return res.status(400).json(failure("审核结果不正确"));
  }

  const business = await getBusinessRecord(businessType, parsedBusinessId);
  if (!business) {
    return res.status(404).json(failure("内容不存在", 404));
  }

  const approved = parsedAuditResult === 1;
  const reasonText = auditReason || (approved ? "内容合规" : "内容不符合发布要求");

  if (businessType === "idle") {
    await idleModel.updateStatus(parsedBusinessId, approved ? 1 : 2, approved ? "" : reasonText);
    await safeCreateSystemNotice({
      receiverId: business.publisherId,
      receiverRole: "user",
      title: approved ? "闲置商品审核通过" : "闲置商品已驳回",
      content: approved
        ? `你发布的闲置商品《${business.title}》已审核通过。`
        : `你发布的闲置商品《${business.title}》已被驳回，原因：${reasonText}`,
      noticeType: approved ? "idle_approved" : "idle_rejected",
      relatedType: "idle",
      relatedId: parsedBusinessId
    });
  } else if (businessType === "errand") {
    await errandModel.updateStatus(parsedBusinessId, approved ? 1 : 6, {
      reject_reason: approved ? "" : reasonText,
      ...(approved ? {} : { receiver_id: null, finish_time: null })
    });
    await safeCreateSystemNotice({
      receiverId: business.publisherId,
      receiverRole: "user",
      title: approved ? "代拿订单审核通过" : "代拿订单已驳回",
      content: approved
        ? `你发布的代拿订单《${business.title}》已审核通过，当前等待接单。`
        : `你发布的代拿订单《${business.title}》已被驳回，原因：${reasonText}`,
      noticeType: approved ? "errand_approved" : "errand_rejected",
      relatedType: "errand",
      relatedId: parsedBusinessId
    });

    if (!approved && business.record.receiver_id) {
      await safeCreateSystemNotice({
        receiverId: business.record.receiver_id,
        receiverRole: "user",
        title: "代拿订单接单已取消",
        content: `你接单的代拿订单《${business.title}》已被管理员驳回，接单关系已取消。`,
        noticeType: "errand_rejected_receiver",
        relatedType: "errand",
        relatedId: parsedBusinessId
      });
    }
  } else {
    return res.status(400).json(failure("未知业务类型"));
  }

  await auditModel.addLog({
    admin_id: req.user.id,
    business_type: businessType,
    business_id: parsedBusinessId,
    audit_result: parsedAuditResult,
    audit_reason: reasonText
  });

  if (!approved) {
    await markReportHandled(businessType, parsedBusinessId, req.user.id, `已驳回：${reasonText}`);
  }

  return res.json(success(null, "审核处理成功"));
}

async function remove(req, res) {
  const businessType = String(req.body.businessType || "").trim();
  const parsedBusinessId = Number(req.body.businessId || 0);
  const reasonText = String(req.body.reason || "").trim() || "管理员下架";

  if (!businessType || !parsedBusinessId) {
    return res.status(400).json(failure("下架参数不完整"));
  }

  const business = await getBusinessRecord(businessType, parsedBusinessId);
  if (!business) {
    return res.status(404).json(failure("内容不存在", 404));
  }

  if (businessType === "idle") {
    await idleModel.updateStatus(parsedBusinessId, 3, reasonText);
    await safeCreateSystemNotice({
      receiverId: business.publisherId,
      receiverRole: "user",
      title: "闲置商品已下架",
      content: `你发布的闲置商品《${business.title}》已被管理员下架，原因：${reasonText}`,
      noticeType: "idle_removed",
      relatedType: "idle",
      relatedId: parsedBusinessId
    });
  } else if (businessType === "errand") {
    await errandModel.updateStatus(parsedBusinessId, 7, {
      reject_reason: reasonText,
      receiver_id: null,
      finish_time: null
    });
    await safeCreateSystemNotice({
      receiverId: business.publisherId,
      receiverRole: "user",
      title: "代拿订单已下架",
      content: `你发布的代拿订单《${business.title}》已被管理员下架，原因：${reasonText}`,
      noticeType: "errand_removed",
      relatedType: "errand",
      relatedId: parsedBusinessId
    });

    if (business.record.receiver_id) {
      await safeCreateSystemNotice({
        receiverId: business.record.receiver_id,
        receiverRole: "user",
        title: "代拿订单接单已取消",
        content: `你接单的代拿订单《${business.title}》已被管理员下架，接单关系已取消。`,
        noticeType: "errand_removed_receiver",
        relatedType: "errand",
        relatedId: parsedBusinessId
      });
    }
  } else {
    return res.status(400).json(failure("未知业务类型"));
  }

  await auditModel.addLog({
    admin_id: req.user.id,
    business_type: businessType,
    business_id: parsedBusinessId,
    audit_result: 3,
    audit_reason: reasonText
  });

  await markReportHandled(businessType, parsedBusinessId, req.user.id, `已下架：${reasonText}`);

  return res.json(success(null, "内容已下架"));
}

async function deleteContent(req, res) {
  const businessType = String(req.body.businessType || "").trim();
  const parsedBusinessId = Number(req.body.businessId || 0);
  const reasonText = String(req.body.reason || "").trim() || "管理员删除";

  if (!businessType || !parsedBusinessId) {
    return res.status(400).json(failure("删除参数不完整"));
  }

  const business = await getBusinessRecord(businessType, parsedBusinessId);
  if (!business) {
    return res.status(404).json(failure("内容不存在", 404));
  }

  let deleted = false;

  if (businessType === "idle") {
    deleted = await idleModel.deleteById(parsedBusinessId);
  } else if (businessType === "errand") {
    deleted = await errandModel.deleteById(parsedBusinessId);
  } else {
    return res.status(400).json(failure("未知业务类型"));
  }

  if (!deleted) {
    return res.status(400).json(failure("内容删除失败，请稍后重试"));
  }

  await auditModel.addLog({
    admin_id: req.user.id,
    business_type: businessType,
    business_id: parsedBusinessId,
    audit_result: 4,
    audit_reason: reasonText
  });
  await cleanupBusinessRelations(businessType, parsedBusinessId);

  await safeCreateSystemNotice({
    receiverId: business.publisherId,
    receiverRole: "user",
    title: businessType === "idle" ? "闲置商品已删除" : "代拿订单已删除",
    content: `你发布的${businessType === "idle" ? "闲置商品" : "代拿订单"}《${business.title}》已被管理员删除，原因：${reasonText}`,
    noticeType: businessType === "idle" ? "idle_deleted" : "errand_deleted",
    relatedType: "",
    relatedId: 0
  });

  return res.json(success(null, "内容已从数据库删除"));
}

module.exports = {
  list,
  detail,
  handle,
  remove,
  deleteContent
};
