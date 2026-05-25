const USER_TABS = [
  { key: "home", label: "首页", icon: "首", path: "/pages/index/index" },
  { key: "errand", label: "代拿", icon: "跑", path: "/pages/errand/list/list" },
  { key: "idle", label: "闲置", icon: "闲", path: "/pages/idle/list/list" },
  { key: "chat", label: "消息", icon: "聊", path: "/pages/chat/list/list" },
  { key: "profile", label: "我的", icon: "我", path: "/pages/profile/index/index" }
];

Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    current: {
      type: String,
      value: ""
    },
    role: {
      type: String,
      value: ""
    }
  },
  data: {
    tabs: []
  },
  lifetimes: {
    attached() {
      this.syncTabs();
    }
  },
  pageLifetimes: {
    show() {
      this.syncTabs();
    }
  },
  methods: {
    syncTabs() {
      this.setData({
        tabs: USER_TABS
      });
    },
    handleSwitch(event) {
      const { key, path } = event.currentTarget.dataset;

      if (!path || key === this.properties.current) {
        return;
      }

      wx.reLaunch({
        url: path
      });
    }
  }
});
