Page({
  data: {
    url: "",
    title: "服务协议"
  },
  onLoad(query) {
    const title = decodeURIComponent(query.title || "服务协议");
    const url = decodeURIComponent(query.url || "");

    this.setData({
      title,
      url
    });

    wx.setNavigationBarTitle({
      title
    });
  }
});
