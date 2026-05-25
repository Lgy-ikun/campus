const request = require("../utils/request");

function addIdle(data) {
  return request({
    url: "/idle/add",
    method: "POST",
    data
  });
}

function updateIdle(id, data) {
  return request({
    url: `/idle/update/${id}`,
    method: "PUT",
    data
  });
}

function getIdleList(params) {
  return request({
    url: "/idle/list",
    method: "GET",
    data: params
  });
}

function getIdleDetail(id) {
  return request({
    url: `/idle/detail/${id}`,
    method: "GET"
  });
}

function getIdleMyList() {
  return request({
    url: "/idle/myList",
    method: "GET"
  });
}

function downIdle(id) {
  return request({
    url: `/idle/down/${id}`,
    method: "PUT"
  });
}

module.exports = {
  addIdle,
  updateIdle,
  getIdleDetail,
  getIdleMyList,
  downIdle,
  getIdleList
};
