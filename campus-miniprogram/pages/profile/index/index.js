const userApi = require("../../../api/user");
const noticeApi = require("../../../api/notice");
const { requireLogin } = require("../../../utils/auth");

const TAB_PAGES = new Set([
  "/pages/index/index",
  "/pages/idle/list/list",
  "/pages/errand/list/list",
  "/pages/chat/list/list",
  "/pages/profile/index/index"
]);

function getDisplayName(userInfo) {
  return userInfo.nickname || userInfo.real_name || userInfo.username || "未命名用户";
}

function getAvatarText(displayName) {
  return String(displayName || "我").slice(0, 1);
}

function buildProfileRows(role, userInfo) {
  if (role === "admin") {
    return [
      { label: "管理员账号", value: userInfo.username || "未填写" },
      { label: "手机号", value: userInfo.phone || "未填写" }
    ];
  }

  return [{ label: "手机号", value: userInfo.phone || "未填写" }];
}

function buildNoticeMenu(noticeUnreadCount) {
  return {
    title: "系统通知",
    desc: noticeUnreadCount
      ? `集中查看审核结果、订单状态和平台提醒，当前未读 ${noticeUnreadCount} 条。`
      : "集中查看审核结果、订单状态和平台提醒。",
    url: "/pages/notice/list/list",
    badgeText: noticeUnreadCount ? String(noticeUnreadCount) : ""
  };
}

function buildMenus(role, noticeUnreadCount) {
  const noticeMenu = buildNoticeMenu(noticeUnreadCount);

  if (role === "admin") {
    return [noticeMenu, { title: "消息中心", desc: "查看系统内会话记录。", url: "/pages/chat/list/list" }];
  }

  return [
    { title: "闲置市场", desc: "浏览和管理校园闲置物品。", url: "/pages/idle/list/list" },
    { title: "代拿大厅", desc: "查看任务并进入自己的代拿订单。", url: "/pages/errand/list/list" },
    noticeMenu,
    { title: "消息中心", desc: "查看会话、未读消息和图片缩略图。", url: "/pages/chat/list/list" }
  ];
}

function openPage(url) {
  if (!url) {
    return;
  }

  if (TAB_PAGES.has(url)) {
    wx.switchTab({ url });
    return;
  }

  wx.navigateTo({ url });
}

Page({
  data: {
    role: "",
    userInfo: {},
    displayName: "未命名用户",
    avatarText: "我",
    profileRows: [],
    menus: [],
    noticeUnreadCount: 0
  },
  onShow() {
    if (!requireLogin()) {
      return;
    }

    this.loadData();
  },
  onPullDownRefresh() {
    this.loadData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },
  async loadData() {
    const app = getApp();
    const role = app.globalData.role || "user";
    const [userInfo, noticeInfo] = await Promise.all([
      userApi.getProfile(),
      noticeApi.getNoticeUnreadCount().catch(() => ({ unreadCount: 0 }))
    ]);
    const displayName = getDisplayName(userInfo);
    const noticeUnreadCount = Number(noticeInfo?.unreadCount || 0);

    app.updateUserInfo(userInfo);

    this.setData({
      role,
      userInfo,
      displayName,
      avatarText: getAvatarText(displayName),
      profileRows: buildProfileRows(role, userInfo),
      menus: buildMenus(role, noticeUnreadCount),
      noticeUnreadCount
    });
  },
  handleNavigate(event) {
    const { url } = event.currentTarget.dataset;
    openPage(url);
  },
  handleEdit() {
    wx.navigateTo({
      url: "/pages/profile/edit/edit"
    });
  },
  handlePassword() {
    wx.navigateTo({
      url: "/pages/profile/password/password"
    });
  },
  handleRefresh() {
    this.loadData();
  },
  handleLogout() {
    getApp().clearSession();
    wx.reLaunch({
      url: "/pages/auth/index"
    });
  }
});
