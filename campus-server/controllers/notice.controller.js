const noticeModel = require("../models/notice.model");
const { getPagination, buildPageResult } = require("../utils/pagination");
const { success, failure } = require("../utils/response");
const { normalizeReceiverRole } = require("../utils/notice");

function parseIsRead(value) {
  if (value === undefined || value === "") {
    return undefined;
  }

  if (value === true || value === "true" || Number(value) === 1) {
    return 1;
  }

  if (value === false || value === "false" || Number(value) === 0) {
    return 0;
  }

  return undefined;
}

function parseExtra(extraJson) {
  if (!extraJson) {
    return null;
  }

  try {
    return JSON.parse(extraJson);
  } catch (error) {
    return null;
  }
}

function normalizeRow(row) {
  return {
    ...row,
    notice_id: Number(row.notice_id || 0),
    receiver_id: Number(row.receiver_id || 0),
    related_id: Number(row.related_id || 0),
    is_read: Number(row.is_read || 0),
    extra: parseExtra(row.extra_json)
  };
}

async function list(req, res) {
  const pagination = getPagination(req.query);
  const result = await noticeModel.listByReceiver(
    {
      receiverId: req.user.id,
      receiverRole: normalizeReceiverRole(req.user.role),
      isRead: parseIsRead(req.query.isRead)
    },
    pagination
  );

  return res.json(
    success(
      buildPageResult(
        result.list.map(normalizeRow),
        result.total,
        pagination.pageNum,
        pagination.pageSize
      )
    )
  );
}

async function unreadCount(req, res) {
  const total = await noticeModel.unreadCount(req.user.id, normalizeReceiverRole(req.user.role));
  return res.json(success({ unreadCount: total }));
}

async function read(req, res) {
  const noticeId = Number(req.params.id);
  if (!noticeId) {
    return res.status(400).json(failure("noticeId不能为空"));
  }

  const record = await noticeModel.markRead(
    noticeId,
    req.user.id,
    normalizeReceiverRole(req.user.role)
  );

  if (!record) {
    return res.status(404).json(failure("通知不存在", 404));
  }

  return res.json(success(normalizeRow(record), "通知已读更新成功"));
}

async function readAll(req, res) {
  const total = await noticeModel.markAllRead(req.user.id, normalizeReceiverRole(req.user.role));
  return res.json(success({ updated: total }, "全部通知已标记为已读"));
}

module.exports = {
  list,
  unreadCount,
  read,
  readAll
};