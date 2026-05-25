function getRoleHome() {
  return "/pages/index/index";
}

function switchToRoleHome(role) {
  wx.switchTab({
    url: getRoleHome(role)
  });
}

function requireLogin() {
  const app = getApp();
  if (!app.globalData.token) {
    wx.reLaunch({
      url: "/pages/auth/index"
    });
    return false;
  }
  return true;
}

function requireRole(expectedRole) {
  if (!requireLogin()) {
    return false;
  }

  const app = getApp();
  const currentRole = app.globalData.role || "user";

  if (currentRole !== expectedRole) {
    wx.showToast({
      title: "当前账号无权访问该页面",
      icon: "none"
    });

    switchToRoleHome(currentRole);
    return false;
  }

  return true;
}

module.exports = {
  getRoleHome,
  switchToRoleHome,
  requireLogin,
  requireRole
};
