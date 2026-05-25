const adminModel = require("../models/admin.model");
const userModel = require("../models/user.model");
const { verifyToken } = require("../utils/jwt");
const { failure } = require("../utils/response");
const { DISABLED_USER_MESSAGE, DISABLED_ADMIN_MESSAGE } = require("../utils/account-status");

async function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) {
    return res.status(401).json(failure("未登录或登录已过期", 401));
  }

  try {
    const payload = verifyToken(token);
    let profile = null;

    if (payload.role === "admin") {
      profile = await adminModel.findById(payload.id);

      if (!profile) {
        return res.status(401).json(failure("登录状态已失效，请重新登录", 401));
      }

      if (Number(profile.status) !== 1) {
        return res.status(403).json(failure(DISABLED_ADMIN_MESSAGE, 403));
      }
    } else {
      profile = await userModel.findById(payload.id);

      if (!profile) {
        return res.status(401).json(failure("登录状态已失效，请重新登录", 401));
      }

      if (Number(profile.status) !== 1) {
        return res.status(403).json(failure(DISABLED_USER_MESSAGE, 403));
      }
    }

    req.user = payload;
    req.currentProfile = profile;
    return next();
  } catch (error) {
    return res.status(401).json(failure("登录凭证无效，请重新登录", 401));
  }
}

module.exports = authMiddleware;
