// const LOCAL_BASE_URL = "http://127.0.0.1:3000/api";
const LOCAL_BASE_URL = "https://campus.wananfe.top/api";
const PROD_BASE_URL = "https://campus.wananfe.top/api";

function getBaseUrl() {
  const deviceInfo = wx.getDeviceInfo ? wx.getDeviceInfo() : wx.getSystemInfoSync();
  return deviceInfo.platform === "devtools" ? LOCAL_BASE_URL : PROD_BASE_URL;
}

App({
  globalData: {
    baseUrl: getBaseUrl(),
    token: wx.getStorageSync("token") || "",
    role: wx.getStorageSync("role") || "",
    userInfo: wx.getStorageSync("userInfo") || null,
    settings: {
      uploadMaxSizeMb: 5,
      idleMaxImages: 20,
      errandMaxImages: 20
    }
  },
  updateSettings(settings = {}) {
    this.globalData.settings = {
      ...this.globalData.settings,
      ...settings
    };
  },
  setSession(payload) {
    this.globalData.token = payload.token || "";
    this.globalData.role = payload.role || "";
    this.globalData.userInfo = payload.userInfo || null;
    wx.setStorageSync("token", this.globalData.token);
    wx.setStorageSync("role", this.globalData.role);
    wx.setStorageSync("userInfo", this.globalData.userInfo);
  },
  updateUserInfo(userInfo) {
    this.globalData.userInfo = userInfo || null;

    if (userInfo) {
      wx.setStorageSync("userInfo", userInfo);
      return;
    }

    wx.removeStorageSync("userInfo");
  },
  clearSession() {
    this.globalData.token = "";
    this.globalData.role = "";
    this.globalData.userInfo = null;
    wx.removeStorageSync("token");
    wx.removeStorageSync("role");
    wx.removeStorageSync("userInfo");
  }
});
