const request = require("../utils/request");

function getUnreadCount() {
  return request({
    url: "/chat/unreadCount",
    method: "GET"
  });
}

function getSessionList() {
  return request({
    url: "/chat/sessionList",
    method: "GET"
  });
}

function getChatRecord(params) {
  return request({
    url: "/chat/record",
    method: "GET",
    data: params
  });
}

function sendMessage(data) {
  return request({
    url: "/chat/send",
    method: "POST",
    data
  });
}

function pinSession(data) {
  return request({
    url: "/chat/pin",
    method: "PUT",
    data
  });
}

function deleteSession(data) {
  return request({
    url: "/chat/deleteSession",
    method: "PUT",
    data
  });
}

function markChatRead(data) {
  return request({
    url: "/chat/read",
    method: "PUT",
    data
  });
}

module.exports = {
  getUnreadCount,
  getSessionList,
  getChatRecord,
  sendMessage,
  pinSession,
  deleteSession,
  markChatRead
};
