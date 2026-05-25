const { failure } = require("../utils/response");

function notFoundHandler(req, res) {
  return res.status(404).json(failure("接口不存在", 404));
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  console.error(error);
  const statusCode = Number(error.statusCode || error.status || 500);
  return res.status(statusCode).json(
    failure(error.message || "服务器内部错误", statusCode)
  );
}

module.exports = {
  notFoundHandler,
  errorHandler
};
