const request = require("../utils/request");

function getProfile() {
  return request({
    url: "/user/profile",
    method: "GET"
  });
}

function updateProfile(data) {
  return request({
    url: "/user/profile",
    method: "PUT",
    data
  });
}

module.exports = {
  getProfile,
  updateProfile
};