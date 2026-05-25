const { failure } = require("../utils/response");

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json(failure("无权限访问该接口", 403));
    }

    return next();
  };
}

module.exports = {
  requireRoles
};
