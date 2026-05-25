const userModel = require("../models/user.model");
const adminModel = require("../models/admin.model");
const { success, failure } = require("../utils/response");

async function findProfileByRole(role, id) {
  if (role === "admin") {
    return adminModel.findById(id);
  }

  return userModel.findById(id);
}

function pickFields(source, fields) {
  const payload = {};
  const data = source || {};

  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      payload[field] = typeof data[field] === "string" ? data[field].trim() : data[field];
    }
  });

  return payload;
}

function normalizeProfile(role, profile) {
  if (!profile) {
    return null;
  }

  if (role === "admin") {
    return profile;
  }

  const { openid, password, ...userInfo } = profile;
  return {
    ...userInfo,
    internal_code: userInfo.student_id || ""
  };
}

async function getProfile(req, res, next) {
  try {
    const profile = await findProfileByRole(req.user.role, req.user.id);

    if (!profile) {
      return res.status(404).json(failure("用户不存在", 404));
    }

    return res.json(success(normalizeProfile(req.user.role, profile)));
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  let payload = {};

  if (req.user.role === "admin") {
    payload = pickFields(req.body, ["real_name", "phone"]);
  } else {
    payload = pickFields(req.body, ["nickname", "avatar", "phone"]);
  }

  if (!Object.keys(payload).length) {
    return res.status(400).json(failure("没有可更新的资料"));
  }

  if (Object.prototype.hasOwnProperty.call(payload, "nickname") && !payload.nickname) {
    return res.status(400).json(failure("昵称不能为空"));
  }

  if (Object.prototype.hasOwnProperty.call(payload, "real_name") && !payload.real_name) {
    return res.status(400).json(failure("姓名不能为空"));
  }

  try {
    let updated = false;

    if (req.user.role === "admin") {
      updated = await adminModel.update(req.user.id, payload);
    } else {
      updated = await userModel.update(req.user.id, payload);
    }

    if (!updated) {
      return res.status(400).json(failure("资料更新失败"));
    }

    const profile = await findProfileByRole(req.user.role, req.user.id);

    if (!profile) {
      return res.status(404).json(failure("用户不存在", 404));
    }

    return res.json(success(normalizeProfile(req.user.role, profile), "资料更新成功"));
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json(failure("资料已存在，请更换后重试"));
    }

    return next(error);
  }
}

module.exports = {
  getProfile,
  updateProfile
};
