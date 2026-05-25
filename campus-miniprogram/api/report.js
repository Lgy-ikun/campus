const request = require("../utils/request");

function submitReport(data) {
  return request({
    url: "/report/submit",
    method: "POST",
    data
  });
}

module.exports = {
  submitReport
};
