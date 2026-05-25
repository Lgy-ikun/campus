const request = require("../utils/request");

function getPublicSettings() {
  return request({
    url: "/system/settings"
  });
}

module.exports = {
  getPublicSettings
};
