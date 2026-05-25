const amapConfig = require("../config/amap");
const https = require("https");

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        let raw = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error("高德地图请求失败"));
            return;
          }

          try {
            resolve(JSON.parse(raw));
          } catch (error) {
            reject(new Error("高德地图响应解析失败"));
          }
        });
      })
      .on("error", reject);
  });
}

function ensureAmapSuccess(data, message) {
  if (data.status && data.status !== "1") {
    throw new Error(data.info || message);
  }
}

async function regeo(latitude, longitude) {
  if (!amapConfig.key || amapConfig.enableMock) {
    return {
      formatted_address: `校园示例地址(${latitude}, ${longitude})`,
      location: `${longitude},${latitude}`
    };
  }

  const url = new URL("https://restapi.amap.com/v3/geocode/regeo");
  url.searchParams.set("key", amapConfig.key);
  url.searchParams.set("location", `${longitude},${latitude}`);
  url.searchParams.set("extensions", "base");

  const data = await requestJson(url);
  ensureAmapSuccess(data, "高德逆地理编码请求失败");
  return data.regeocode || {};
}

async function poiSearch(keyword = "", city = "全国") {
  if (!amapConfig.key || amapConfig.enableMock) {
    return [
      {
        id: "mock-1",
        name: keyword ? `${keyword}示例点位` : "校园超市",
        address: `${city}校园生活区`,
        location: "116.397428,39.90923"
      },
      {
        id: "mock-2",
        name: "宿舍楼服务站",
        address: `${city}学生宿舍区`,
        location: "116.401394,39.915378"
      }
    ];
  }

  const url = new URL("https://restapi.amap.com/v3/place/text");
  url.searchParams.set("key", amapConfig.key);
  url.searchParams.set("keywords", keyword);
  url.searchParams.set("city", city);

  const data = await requestJson(url);
  ensureAmapSuccess(data, "高德POI搜索请求失败");
  return data.pois || [];
}

module.exports = {
  regeo,
  poiSearch
};
