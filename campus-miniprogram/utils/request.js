function handleDisabledAccount(app, message) {
  if (app.__handlingDisabledAccount) {
    return;
  }

  app.__handlingDisabledAccount = true;
  app.clearSession();

  wx.showModal({
    title: "账号已被禁用",
    content: message || "账号已被禁用，请联系管理员 lgy3452231",
    showCancel: false,
    complete() {
      app.__handlingDisabledAccount = false;
      wx.reLaunch({
        url: "/pages/auth/index"
      });
    }
  });
}

function request(options) {
  const app = getApp();
  const token = app.globalData.token;

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.baseUrl}${options.url}`,
      method: options.method || "GET",
      data: options.data || {},
      header: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.header || {})
      },
      success(res) {
        const result = res.data || {};

        if (result.code === 200) {
          resolve(result.data);
          return;
        }

        if (result.code === 401) {
          app.clearSession();
          wx.reLaunch({
            url: "/pages/auth/index"
          });
          reject(result);
          return;
        }

        if (result.code === 403 && String(result.msg || "").includes("已被禁用")) {
          handleDisabledAccount(app, result.msg);
          reject(result);
          return;
        }

        wx.showToast({
          title: result.msg || "请求失败",
          icon: "none"
        });
        reject(result);
      },
      fail(error) {
        wx.showToast({
          title: "网络异常，请稍后重试",
          icon: "none"
        });
        reject(error);
      }
    });
  });
}

module.exports = request;
