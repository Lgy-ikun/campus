const request = require("../utils/request");

function sendSmsCode(data) {
  return request({
    url: "/auth/sendSmsCode",
    method: "POST",
    data
  });
}

function phoneLogin(data) {
  return request({
    url: "/auth/phoneLogin",
    method: "POST",
    data
  });
}

function phoneOneClickLogin(data) {
  return request({
    url: "/auth/phoneOneClickLogin",
    method: "POST",
    data
  });
}

function wxLogin(data) {
  return request({
    url: "/auth/wxLogin",
    method: "POST",
    data
  });
}

function getUserInfo() {
  return request({
    url: "/auth/userInfo",
    method: "GET"
  });
}

function updatePassword(data) {
  return request({
    url: "/auth/updatePassword",
    method: "PUT",
    data
  });
}

module.exports = {
  sendSmsCode,
  phoneLogin,
  phoneOneClickLogin,
  wxLogin,
  getUserInfo,
  updatePassword
};
