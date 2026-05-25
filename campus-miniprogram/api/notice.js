const request = require("../utils/request");

function getNoticeList(params) {
  return request({
    url: "/notice/list",
    method: "GET",
    data: params
  });
}

function getNoticeUnreadCount() {
  return request({
    url: "/notice/unreadCount",
    method: "GET"
  });
}

function readNotice(id) {
  return request({
    url: `/notice/read/${id}`,
    method: "PUT"
  });
}

function readAllNotices() {
  return request({
    url: "/notice/readAll",
    method: "PUT"
  });
}

module.exports = {
  getNoticeList,
  getNoticeUnreadCount,
  readNotice,
  readAllNotices
};