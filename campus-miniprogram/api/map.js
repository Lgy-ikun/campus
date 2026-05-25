const request = require("../utils/request");

function regeo(params) {
  return request({
    url: "/map/regeo",
    method: "GET",
    data: params
  });
}

function poiSearch(params) {
  return request({
    url: "/map/poiSearch",
    method: "GET",
    data: params
  });
}

module.exports = {
  regeo,
  poiSearch
};
