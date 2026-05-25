const request = require("../utils/request");

function addErrand(data) {
  return request({
    url: "/errand/add",
    method: "POST",
    data
  });
}

function updateErrand(id, data) {
  return request({
    url: `/errand/update/${id}`,
    method: "PUT",
    data
  });
}

function getErrandList(params) {
  return request({
    url: "/errand/list",
    method: "GET",
    data: params
  });
}

function getErrandDetail(id) {
  return request({
    url: `/errand/detail/${id}`,
    method: "GET"
  });
}

function receiveErrand(id) {
  return request({
    url: `/errand/receive/${id}`,
    method: "PUT"
  });
}

function releaseErrand(id) {
  return request({
    url: `/errand/release/${id}`,
    method: "PUT"
  });
}

function cancelErrand(id) {
  return request({
    url: `/errand/cancel/${id}`,
    method: "PUT"
  });
}

function updateErrandStatus(id, data) {
  return request({
    url: `/errand/updateStatus/${id}`,
    method: "PUT",
    data
  });
}

function getErrandMyList() {
  return request({
    url: "/errand/myList",
    method: "GET"
  });
}

module.exports = {
  addErrand,
  updateErrand,
  getErrandDetail,
  receiveErrand,
  cancelErrand,
  releaseErrand,
  updateErrandStatus,
  getErrandMyList,
  getErrandList
};
