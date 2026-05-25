const chatApi = require("../../api/chat");
const noticeApi = require("../../api/notice");

const HERO_SLIDES = [
  {
    theme: "mint",
    eyebrow: "清爽校园",
    title: "闲置好物和代拿互助，打开就能办",
    desc: "把最常用的校园服务放在第一屏，少找一步，快一点完成。",
    tags: ["随手发布", "同学互助"]
  },
  {
    theme: "sky",
    eyebrow: "快速发布",
    title: "有需求马上发，有闲置马上挂",
    desc: "发布入口更醒目，代拿任务和闲置商品都能快速开始。",
    tags: ["少填几步", "发布更快"]
  },
  {
    theme: "sunrise",
    eyebrow: "消息提醒",
    title: "订单、审核、会话消息集中查看",
    desc: "未读提醒同步到首页，重要状态变化不容易错过。",
    tags: ["未读提醒", "状态同步"]
  }
];

function buildHomeActions() {
  return [
    {
      key: "idle-market",
      title: "闲置市场",
      desc: "校园好物随时逛",
      icon: "/assets/tabbar/idle.png",
      tone: "mint",
      badge: "好物",
      kind: "tab",
      url: "/pages/idle/list/list"
    },
    {
      key: "errand-hall",
      title: "代拿大厅",
      desc: "任务接单更顺手",
      icon: "/assets/tabbar/errand.png",
      tone: "sky",
      badge: "互助",
      kind: "tab",
      url: "/pages/errand/list/list"
    },
    {
      key: "publish-idle",
      title: "发布闲置",
      desc: "图片和价格一次填好",
      icon: "/assets/tabbar/idle-active.png",
      tone: "sky",
      badge: "发布",
      kind: "page",
      url: "/pages/idle/publish/publish"
    },
    {
      key: "publish-errand",
      title: "发布代拿",
      desc: "填写地址、赏金和时间",
      icon: "/assets/tabbar/errand-active.png",
      tone: "mint",
      badge: "发布",
      kind: "page",
      url: "/pages/errand/publish/publish"
    }
  ];
}

function openByKind(kind, url) {
  if (!url) {
    return;
  }

  if (kind === "tab") {
    wx.switchTab({ url });
    return;
  }

  wx.navigateTo({ url });
}

function getUserName(userInfo) {
  return userInfo.nickname || userInfo.real_name || "同学";
}

Page({
  data: {
    role: "",
    roleText: "学生用户",
    userInfo: null,
    userName: "同学",
    isLoginSuccess: false,
    loginKicker: "校园便利服务",
    loginTitle: "登录后查看订单和消息提醒",
    loginActionText: "去登录",
    heroSlides: HERO_SLIDES,
    homeActions: buildHomeActions(),
    messageSummary: "登录后查看消息提醒"
  },
  async onShow() {
    const app = getApp();
    const isLoginSuccess = Boolean(app.globalData.token);

    if (!isLoginSuccess) {
      this.setData({
        role: "",
        roleText: "游客",
        userInfo: null,
        userName: "同学",
        isLoginSuccess: false,
        loginKicker: "校园便利服务",
        loginTitle: "登录后查看订单和消息提醒",
        loginActionText: "去登录",
        messageSummary: "登录后查看消息提醒"
      });
      return;
    }

    const role = app.globalData.role || "user";
    const userInfo = app.globalData.userInfo || {};
    const userName = getUserName(userInfo);

    this.setData({
      role,
      roleText: role === "admin" ? "管理员视角" : "学生用户",
      userInfo,
      userName,
      isLoginSuccess: true,
      loginKicker: "欢迎回来",
      loginTitle: `${userName} · ${role === "admin" ? "管理员视角" : "学生用户"}`,
      loginActionText: "个人中心"
    });

    const [chatResult, noticeResult] = await Promise.allSettled([
      chatApi.getUnreadCount(),
      noticeApi.getNoticeUnreadCount()
    ]);

    const chatUnread =
      chatResult.status === "fulfilled" ? Number(chatResult.value?.unreadCount || 0) : 0;
    const noticeUnread =
      noticeResult.status === "fulfilled" ? Number(noticeResult.value?.unreadCount || 0) : 0;
    const totalUnread = chatUnread + noticeUnread;

    this.setData({
      messageSummary: totalUnread ? `消息中心当前有 ${totalUnread} 条未读提醒` : "消息中心暂时没有未读提醒"
    });
  },
  handleLoginBanner() {
    if (!getApp().globalData.token) {
      wx.reLaunch({
        url: "/pages/auth/index"
      });
      return;
    }

    wx.switchTab({
      url: "/pages/profile/index/index"
    });
  },
  handleNoticeStrip() {
    if (!getApp().globalData.token) {
      wx.reLaunch({
        url: "/pages/auth/index"
      });
      return;
    }

    wx.switchTab({
      url: "/pages/chat/list/list"
    });
  },
  handleAction(event) {
    if (!getApp().globalData.token) {
      wx.reLaunch({
        url: "/pages/auth/index"
      });
      return;
    }

    const { kind, url } = event.currentTarget.dataset;
    openByKind(kind, url);
  }
});
