module.exports = {
  getSuggestion(keyword) {
    return Promise.resolve([
      {
        name: keyword ? `${keyword}示例点位` : "校园服务中心",
        address: "校园主路 1 号",
        latitude: 39.90923,
        longitude: 116.397428
      }
    ]);
  }
};
