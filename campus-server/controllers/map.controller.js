const amapUtils = require("../utils/amap");
const { success, failure } = require("../utils/response");

async function regeo(req, res) {
  const { latitude, longitude } = req.query;
  if (!latitude || !longitude) {
    return res.status(400).json(failure("latitude和longitude不能为空"));
  }

  const data = await amapUtils.regeo(latitude, longitude);
  return res.json(success(data));
}

async function poiSearch(req, res) {
  const { keyword, city } = req.query;
  const data = await amapUtils.poiSearch(keyword, city);
  return res.json(success(data));
}

module.exports = {
  regeo,
  poiSearch
};
