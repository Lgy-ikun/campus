const noticeApi = require("../../../api/notice");
const { requireLogin } = require("../../../utils/auth");
const { formatDateTime } = require("../../../utils/format");

function getCategoryText(item) {
  if ((item.notice_type || "").includes("errand")) {
    return "代拿提醒";
  }

  if ((item.notice_type || "").includes("idle")) {
    return "闲置提醒";
  }

  if (item.related_type === "errand") {
    return "代拿提醒";
  }

  if (item.related_type === "idle") {
    return "闲置提醒";
  }

  return "系统通知";
}

function getJumpUrl(item) {
  if (item.related_type === "idle" && item.related_id) {
    return `/pages/idle/detail/detail?id=${item.related_id}`;
  }

  if (item.related_type === "errand" && item.related_id) {
    return `/pages/errand/detail/detail?id=${item.related_id}`;
  }

  return "";
}

function getActionText(item) {
  const url = getJumpUrl(item);
  if (!url) {
    return item.isRead ? "" : "点击后标记为已读";
  }

  return "点击查看相关页面";
}

function buildNotice(item) {
  const isRead = Number(item.is_read || 0) === 1;
  const relatedId = Number(item.related_id || 0);

  return {
    ...item,
    related_id: relatedId,
    isRead,
    categoryText: getCategoryText(item),
    createTimeText: formatDateTime(item.create_time),
    actionText: getActionText({ ...item, isRead, related_id: relatedId })
  };
}

Page({
  data: {
    currentFilter: "all",
    unreadCount: 0,
    list: []
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
    if (this.loading) {
      return;
    }

    this.loading = true;

    try {
      const isRead = this.data.currentFilter === "all"
        ? undefined
        : this.data.currentFilter === "unread"
          ? 0
          : 1;
      const [pageData, unreadData] = await Promise.all([
        noticeApi.getNoticeList({
          pageNum: 1,
          pageSize: 50,
          ...(isRead !== undefined ? { isRead } : {})
        }),
        noticeApi.getNoticeUnreadCount()
      ]);

      this.setData({
        list: (pageData?.list || []).map((item) => buildNotice(item)),
        unreadCount: Number(unreadData?.unreadCount || 0)
      });
    } finally {
      this.loading = false;
    }
  },
  handleFilterChange(event) {
    const value = event.currentTarget.dataset.value;
    if (!value || value === this.data.currentFilter) {
      return;
    }

    this.setData({
      currentFilter: value
    });
    this.loadData();
  },
  markLocalRead(index) {
    const current = this.data.list[index];
    if (!current || current.isRead) {
      return;
    }

    this.setData({
      [`list[${index}].isRead`]: true,
      [`list[${index}].is_read`]: 1,
      [`list[${index}].actionText`]: getActionText({ ...current, isRead: true }),
      unreadCount: Math.max(Number(this.data.unreadCount || 0) - 1, 0)
    });
  },
  async handleReadAll() {
    if (!this.data.unreadCount) {
      return;
    }

    await noticeApi.readAllNotices();
    wx.showToast({
      title: "已全部标记为已读",
      icon: "success"
    });
    this.loadData();
  },
  async handleOpenNotice(event) {
    const { index } = event.currentTarget.dataset;
    const item = this.data.list[index];

    if (!item) {
      return;
    }

    if (!item.isRead) {
      try {
        await noticeApi.readNotice(item.notice_id);
        this.markLocalRead(index);
      } catch (error) {
        return;
      }
    }

    const url = getJumpUrl(item);

    if (!url) {
      wx.showToast({
        title: item.isRead ? "当前通知暂无可跳转页面" : "通知已标记为已读",
        icon: "none"
      });
      return;
    }

    wx.navigateTo({
      url
    });
  }
});
