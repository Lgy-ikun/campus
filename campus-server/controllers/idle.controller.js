const idleModel = require("../models/idle.model");
const systemSettingModel = require("../models/system-setting.model");
const { getPagination, buildPageResult } = require("../utils/pagination");
const { success, failure } = require("../utils/response");

const IDLE_STATUS = {
  PENDING_AUDIT: 0,
  ON_SALE: 1,
  REJECTED: 2,
  REMOVED: 3
};

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

function normalizeRow(row) {
  return {
    ...row,
    images: normalizeImagesField(row.images),
    trade_address: row.trade_address || "",
    trade_latitude: row.trade_latitude === undefined || row.trade_latitude === null ? "" : String(row.trade_latitude),
    trade_longitude: row.trade_longitude === undefined || row.trade_longitude === null ? "" : String(row.trade_longitude),
    contact_info: "",
    contact_visible: false,
    contact_mode: "chat_only"
  };
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function hasTradeLocation(data) {
  return hasValue(data.trade_address) && hasValue(data.trade_latitude) && hasValue(data.trade_longitude);
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

async function validateImageLimit(images) {
  const settings = await systemSettingModel.getSettings();
  const imageList = normalizeImagesField(images);
  const maxImages = Number(settings.idleMaxImages || 20);

  if (imageList.length > maxImages) {
    return {
      ok: false,
      message: `闲置物品最多上传${maxImages}张图片`
    };
  }

  return {
    ok: true,
    imageList
  };
}

function canViewDetail(record, viewerId) {
  if (Number(record.user_id) === Number(viewerId)) {
    return true;
  }

  return Number(record.status) === IDLE_STATUS.ON_SALE;
}

async function add(req, res) {
  const { title, price, description, images, trade_address, trade_latitude, trade_longitude } = req.body;
  if (!title || !price) {
    return res.status(400).json(failure("标题和价格不能为空"));
  }

  if (!hasTradeLocation(req.body)) {
    return res.status(400).json(failure("交易地点不能为空"));
  }

  const priceResult = validateMoney(price, "价格");
  if (!priceResult.ok) {
    return res.status(400).json(failure(priceResult.message));
  }

  const imageLimit = await validateImageLimit(images);
  if (!imageLimit.ok) {
    return res.status(400).json(failure(imageLimit.message));
  }

  const record = await idleModel.create({
    user_id: req.user.id,
    title,
    price: priceResult.value,
    description,
    images: imageLimit.imageList.join(","),
    contact_info: "",
    trade_address,
    trade_latitude,
    trade_longitude
  });

  return res.json(success(normalizeRow(record), "商品发布成功，等待审核"));
}

async function update(req, res) {
  const { title, price, description, images, trade_address, trade_latitude, trade_longitude } = req.body;
  if (!title || !price) {
    return res.status(400).json(failure("标题和价格不能为空"));
  }

  if (!hasTradeLocation(req.body)) {
    return res.status(400).json(failure("交易地点不能为空"));
  }

  const priceResult = validateMoney(price, "价格");
  if (!priceResult.ok) {
    return res.status(400).json(failure(priceResult.message));
  }

  const imageLimit = await validateImageLimit(images);
  if (!imageLimit.ok) {
    return res.status(400).json(failure(imageLimit.message));
  }

  const record = await idleModel.findById(req.params.id);
  if (!record) {
    return res.status(404).json(failure("商品不存在", 404));
  }

  if (Number(record.user_id) !== Number(req.user.id)) {
    return res.status(403).json(failure("无权修改该商品", 403));
  }

  const ok = await idleModel.updateForResubmit(req.params.id, req.user.id, {
    title,
    price: priceResult.value,
    description,
    images: imageLimit.imageList.join(","),
    contact_info: "",
    trade_address,
    trade_latitude,
    trade_longitude
  });

  if (!ok) {
    return res.status(400).json(failure("修改提交失败，请稍后重试"));
  }

  const updatedRecord = await idleModel.findById(req.params.id);
  return res.json(success(normalizeRow(updatedRecord), "商品已重新提交审核"));
}

async function list(req, res) {
  const pagination = getPagination(req.query);
  const result = await idleModel.list(req.query, pagination, false);

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

async function detail(req, res) {
  const record = await idleModel.findById(req.params.id);
  if (!record) {
    return res.status(404).json(failure("商品不存在", 404));
  }

  if (!canViewDetail(record, req.user.id)) {
    return res.status(403).json(failure("该商品当前不可查看", 403));
  }

  return res.json(success(normalizeRow(record)));
}

async function myList(req, res) {
  const rows = await idleModel.myList(req.user.id);
  return res.json(success(rows.map(normalizeRow)));
}

async function down(req, res) {
  const ok = await idleModel.downByOwner(req.params.id, req.user.id);
  if (!ok) {
    return res.status(400).json(failure("商品不存在、无权操作或当前状态不能下架"));
  }

  return res.json(success(null, "商品已下架"));
}

module.exports = {
  add,
  update,
  list,
  detail,
  myList,
  down
};
