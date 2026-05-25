function success(data = null, msg = "操作成功") {
  return {
    code: 200,
    msg,
    data
  };
}

function failure(msg = "操作失败", code = 400, data = null) {
  return {
    code,
    msg,
    data
  };
}

module.exports = {
  success,
  failure
};
