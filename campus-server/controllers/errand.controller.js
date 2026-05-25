const errandModel = require("../models/errand.model");
const systemSettingModel = require("../models/system-setting.model");
const { getPagination, buildPageResult } = require("../utils/pagination");
const { success, failure } = require("../utils/response");
const { safeCreateSystemNotice } = require("../utils/notice");

const ERRAND_STATUS = {
  PENDING_AUDIT: 0,
  WAITING_RECEIVE: 1,
  IN_PROGRESS: 2,
  WAITING_CONFIRM: 3,
  FINISHED: 4,
  CANCELED: 5,
  REJECTED: 6,
  REMOVED: 7
};

const EDITABLE_STATUS = [
  ERRAND_STATUS.PENDING_AUDIT,
  ERRAND_STATUS.WAITING_RECEIVE,
  ERRAND_STATUS.CANCELED,
  ERRAND_STATUS.REJECTED,
  ERRAND_STATUS.REMOVED
];

const CANCELABLE_STATUS = [
  ERRAND_STATUS.PENDING_AUDIT,
  ERRAND_STATUS.WAITING_RECEIVE,
  ERRAND_STATUS.REJECTED,
  ERRAND_STATUS.REMOVED
];

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

function normalizeTextValue(value, maxLength = 100) {
  if (!value) {
    return "";
  }

  const text = String(value).trim();
  if (!text) {
    return "";
  }

  return text.slice(0, maxLength);
}

function validateMoney(value, label) {
  const text = String(value || "").trim();

  if (!text) {
    return {
      ok: false,
      message: `${label}不能为空`
    };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return {
      ok: false,
      message: `${label}请输入数字，最多保留两位小数`
    };
  }

  const amount = Number(text);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      message: `${label}必须大于0`
    };
  }

  if (amount > 999999.99) {
    return {
      ok: false,
      message: `${label}不能超过999999.99`
    };
  }

  return {
    ok: true,
    value: amount.toFixed(2)
  };
}

function canViewContact(record, viewerId) {
  const currentUserId = Number(viewerId || 0);
  if (!currentUserId) {
    return false;
  }

  if (Number(record.publisher_id) === currentUserId) {
    return true;
  }

  return Number(record.receiver_id) === currentUserId
    && [
      ERRAND_STATUS.IN_PROGRESS,
      ERRAND_STATUS.WAITING_CONFIRM,
      ERRAND_STATUS.FINISHED
    ].includes(Number(record.status));
}

function canViewDetail(record, viewerId) {
  const currentUserId = Number(viewerId || 0);
  if (Number(record.publisher_id) === currentUserId || Number(record.receiver_id) === currentUserId) {
    return true;
  }

  return Number(record.status) === ERRAND_STATUS.WAITING_RECEIVE;
}

function isEditableByPublisher(record, viewerId) {
  return Number(record.publisher_id) === Number(viewerId)
    && !record.receiver_id
    && EDITABLE_STATUS.includes(Number(record.status));
}

function isCancelableByPublisher(record, viewerId) {
  return Number(record.publisher_id) === Number(viewerId)
    && !record.receiver_id
    && CANCELABLE_STATUS.includes(Number(record.status));
}

function normalizeRow(row, viewerId) {
  const status = Number(row.status);
  const contactVisible = canViewContact(row, viewerId);

  return {
    ...row,
    images: normalizeImagesField(row.images),
    contact_info: contactVisible ? row.contact_info : "",
    contact_visible: contactVisible,
    can_edit: isEditableByPublisher(row, viewerId),
    can_cancel: isCancelableByPublisher(row, viewerId),
    can_release_receiver:
      Number(row.publisher_id) === Number(viewerId)
      && Number(row.receiver_id || 0) > 0
      && status === ERRAND_STATUS.IN_PROGRESS
  };
}

function hasRequiredOrderFields(body) {
  return Boolean(
    body.title
    && body.pick_address
    && body.deliver_address
    && body.pick_latitude
    && body.pick_longitude
    && body.deliver_latitude
    && body.deliver_longitude
    && body.reward
    && body.contact_info
  );
}

function buildOrderPayload(body, normalizedReward) {
  return {
    title: body.title,
    description: body.description,
    pick_address: body.pick_address,
    pick_latitude: body.pick_latitude,
    pick_longitude: body.pick_longitude,
    deliver_address: body.deliver_address,
    deliver_latitude: body.deliver_latitude,
    deliver_longitude: body.deliver_longitude,
    reward: normalizedReward,
    images: normalizeImagesField(body.images).join(","),
    contact_info: body.contact_info,
    expect_time: normalizeTextValue(body.expect_time)
  };
}

async function validateImageLimit(images) {
  const settings = await systemSettingModel.getSettings();
  const imageList = normalizeImagesField(images);
  const maxImages = Number(settings.errandMaxImages || 20);

  if (imageList.length > maxImages) {
    return {
      ok: false,
      message: `代拿订单最多上传${maxImages}张图片`
    };
  }

  return {
    ok: true
  };
}

async function add(req, res) {
  if (!hasRequiredOrderFields(req.body)) {
    return res.status(400).json(failure("请完整填写代拿订单信息"));
  }

  const rewardResult = validateMoney(req.body.reward, "赏金");
  if (!rewardResult.ok) {
    return res.status(400).json(failure(rewardResult.message));
  }

  const imageLimit = await validateImageLimit(req.body.images);
  if (!imageLimit.ok) {
    return res.status(400).json(failure(imageLimit.message));
  }

  const record = await errandModel.create({
    publisher_id: req.user.id,
    ...buildOrderPayload(req.body, rewardResult.value)
  });

  return res.json(success(normalizeRow(record, req.user.id), "代拿订单发布成功，等待审核"));
}

async function update(req, res) {
  if (!hasRequiredOrderFields(req.body)) {
    return res.status(400).json(failure("请完整填写代拿订单信息"));
  }

  const rewardResult = validateMoney(req.body.reward, "赏金");
  if (!rewardResult.ok) {
    return res.status(400).json(failure(rewardResult.message));
  }

  const imageLimit = await validateImageLimit(req.body.images);
  if (!imageLimit.ok) {
    return res.status(400).json(failure(imageLimit.message));
  }

  const record = await errandModel.findById(req.params.id);
  if (!record) {
    return res.status(404).json(failure("订单不存在", 404));
  }

  if (Number(record.publisher_id) !== Number(req.user.id)) {
    return res.status(403).json(failure("无权修改该订单", 403));
  }

  if (!isEditableByPublisher(record, req.user.id)) {
    return res.status(400).json(failure("当前订单状态不支持重新编辑"));
  }

  const ok = await errandModel.updateForResubmit(
    req.params.id,
    req.user.id,
    buildOrderPayload(req.body, rewardResult.value)
  );
  if (!ok) {
    return res.status(400).json(failure("修改提交失败，请稍后重试"));
  }

  const updatedRecord = await errandModel.findById(req.params.id);
  return res.json(success(normalizeRow(updatedRecord, req.user.id), "订单已重新提交审核"));
}

async function list(req, res) {
  const pagination = getPagination(req.query);
  const result = await errandModel.list(req.query, pagination, false);

  return res.json(
    success(
      buildPageResult(
        result.list.map((item) => normalizeRow(item, req.user.id)),
        result.total,
        pagination.pageNum,
        pagination.pageSize
      )
    )
  );
}

async function detail(req, res) {
  const record = await errandModel.findById(req.params.id);
  if (!record) {
    return res.status(404).json(failure("订单不存在", 404));
  }

  if (!canViewDetail(record, req.user.id)) {
    return res.status(403).json(failure("该订单当前不可查看", 403));
  }

  return res.json(success(normalizeRow(record, req.user.id)));
}

async function receive(req, res) {
  const record = await errandModel.findById(req.params.id);
  if (!record) {
    return res.status(404).json(failure("订单不存在", 404));
  }

  if (Number(record.publisher_id) === Number(req.user.id)) {
    return res.status(400).json(failure("不能接自己的订单"));
  }

  const ok = await errandModel.receive(req.params.id, req.user.id);
  if (!ok) {
    return res.status(400).json(failure("订单已被接单或当前状态不允许接单"));
  }

  const updatedRecord = await errandModel.findById(req.params.id);
  await safeCreateSystemNotice({
    receiverId: record.publisher_id,
    receiverRole: "user",
    title: "代拿订单已被接单",
    content: `你的代拿订单《${record.title}》已被 ${updatedRecord?.receiver_name || "同学"} 接单，当前已进入进行中状态。`,
    noticeType: "errand_received",
    relatedType: "errand",
    relatedId: record.order_id
  });

  return res.json(success(null, "接单成功"));
}

async function cancel(req, res) {
  const record = await errandModel.findById(req.params.id);
  if (!record) {
    return res.status(404).json(failure("订单不存在", 404));
  }

  if (Number(record.publisher_id) !== Number(req.user.id)) {
    return res.status(403).json(failure("无权取消该订单", 403));
  }

  if (!isCancelableByPublisher(record, req.user.id)) {
    return res.status(400).json(failure("当前订单状态不支持取消"));
  }

  const ok = await errandModel.cancelByPublisher(req.params.id, req.user.id);
  if (!ok) {
    return res.status(400).json(failure("取消订单失败，请稍后重试"));
  }

  return res.json(success(null, "订单已取消"));
}

async function release(req, res) {
  const record = await errandModel.findById(req.params.id);
  if (!record) {
    return res.status(404).json(failure("订单不存在", 404));
  }

  if (Number(record.publisher_id) !== Number(req.user.id)) {
    return res.status(403).json(failure("无权操作该订单", 403));
  }

  if (Number(record.status) !== ERRAND_STATUS.IN_PROGRESS || !record.receiver_id) {
    return res.status(400).json(failure("当前订单不支持重新开放"));
  }

  const ok = await errandModel.release(req.params.id, req.user.id);
  if (!ok) {
    return res.status(400).json(failure("取消当前接单失败，请稍后重试"));
  }

  await safeCreateSystemNotice({
    receiverId: record.receiver_id,
    receiverRole: "user",
    title: "代拿订单已重新开放",
    content: `你接单的代拿订单《${record.title}》已被发布方取消当前接单，订单重新回到待接单状态。`,
    noticeType: "errand_released",
    relatedType: "errand",
    relatedId: record.order_id
  });

  return res.json(success(null, "已取消当前接单并重新开放订单"));
}

async function updateStatus(req, res) {
  const parsedStatus = Number(req.body.status);
  const record = await errandModel.findById(req.params.id);

  if (!record) {
    return res.status(404).json(failure("订单不存在", 404));
  }

  if (Number.isNaN(parsedStatus)) {
    return res.status(400).json(failure("status 参数不正确"));
  }

  const currentUserId = Number(req.user.id);
  const isPublisher = Number(record.publisher_id) === currentUserId;
  const isReceiver = Number(record.receiver_id) === currentUserId;
  const currentStatus = Number(record.status);

  if (!isPublisher && !isReceiver) {
    return res.status(403).json(failure("无权更新该订单", 403));
  }

  if (parsedStatus === ERRAND_STATUS.WAITING_CONFIRM) {
    if (!isReceiver || currentStatus !== ERRAND_STATUS.IN_PROGRESS) {
      return res.status(400).json(failure("当前状态不支持标记为已送达"));
    }

    await errandModel.updateStatus(req.params.id, parsedStatus);
    await safeCreateSystemNotice({
      receiverId: record.publisher_id,
      receiverRole: "user",
      title: "代拿订单待确认",
      content: `代拿订单《${record.title}》已由接单方标记为已送达，当前等待你确认。`,
      noticeType: "errand_waiting_confirm",
      relatedType: "errand",
      relatedId: record.order_id
    });

    return res.json(success(null, "已标记为待确认"));
  }

  if (parsedStatus === ERRAND_STATUS.FINISHED) {
    if (!isPublisher || currentStatus !== ERRAND_STATUS.WAITING_CONFIRM) {
      return res.status(400).json(failure("当前状态不支持确认完成"));
    }

    await errandModel.updateStatus(req.params.id, parsedStatus, {
      finish_time: new Date()
    });

    if (record.receiver_id) {
      await safeCreateSystemNotice({
        receiverId: record.receiver_id,
        receiverRole: "user",
        title: "代拿订单已完成",
        content: `你参与的代拿订单《${record.title}》已由发布方确认完成。`,
        noticeType: "errand_finished",
        relatedType: "errand",
        relatedId: record.order_id
      });
    }

    return res.json(success(null, "订单已完成"));
  }

  return res.status(400).json(failure("当前仅支持已送达和确认完成两种状态变更"));
}

async function myList(req, res) {
  const rows = await errandModel.myList(req.user.id);
  return res.json(success(rows.map((item) => normalizeRow(item, req.user.id))));
}

module.exports = {
  add,
  update,
  list,
  detail,
  receive,
  cancel,
  release,
  updateStatus,
  myList
};
