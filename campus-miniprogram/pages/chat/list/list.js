const chatApi = require("../../../api/chat");
const noticeApi = require("../../../api/notice");
const { requireLogin } = require("../../../utils/auth");
const { formatDateTime } = require("../../../utils/format");

const POLL_INTERVAL = 3000;

function getBusinessText(relatedType) {
  if (relatedType === "errand") {
    return "代拿订单";
  }

  if (relatedType === "idle") {
    return "闲置咨询";
  }

  return "普通会话";
}

function buildSession(item) {
  return {
    ...item,
    businessText: getBusinessText(item.related_type),
    lastTimeText: formatDateTime(item.last_time),
    unreadText: Number(item.unread_count || 0),
    lastPreviewText: Number(item.last_message_type) === 2 ? "[图片]" : (item.last_content || "暂无消息内容"),
    isPinned: Number(item.is_pinned || 0) === 1,
    thumbnailUrl: Number(item.last_message_type) === 2 ? item.last_content : ""
  };
}

function normalizeKeyword(keyword) {
  return String(keyword || "").trim().toLowerCase();
}

function filterSessions(sessions, keyword) {
  const normalizedKeyword = normalizeKeyword(keyword);

  if (!normalizedKeyword) {
    return sessions;
  }

  return sessions.filter((item) => {
    const text = [
      item.partner_name,
      item.businessText,
      item.lastPreviewText
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(normalizedKeyword);
  });
}

Page({
  data: {
    unreadCount: 0,
    noticeUnreadCount: 0,
    keyword: "",
    sessions: [],
    allSessions: []
  },
  onShow() {
    if (!requireLogin()) {
      return;
    }

    this.loadData();
    this.startPolling();
  },
  onHide() {
    this.stopPolling();
  },
  onUnload() {
    this.stopPolling();
  },
  startPolling() {
    this.stopPolling();
    this.timer = setInterval(() => {
      this.loadData();
    }, POLL_INTERVAL);
  },
  stopPolling() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },
  async loadData() {
    if (this.loading) {
      return;
    }

    this.loading = true;

    try {
      const [sessionResult, noticeResult] = await Promise.allSettled([
        chatApi.getSessionList(),
        noticeApi.getNoticeUnreadCount()
      ]);

      const nextData = {};

      if (sessionResult.status === "fulfilled") {
        const allSessions = (sessionResult.value || []).map(buildSession);
        nextData.unreadCount = allSessions.reduce((sum, item) => sum + Number(item.unreadText || 0), 0);
        nextData.allSessions = allSessions;
        nextData.sessions = filterSessions(allSessions, this.data.keyword);
      }

      if (noticeResult.status === "fulfilled") {
        nextData.noticeUnreadCount = Number(noticeResult.value?.unreadCount || 0);
      }

      if (Object.keys(nextData).length) {
        this.setData(nextData);
      }
    } finally {
      this.loading = false;
    }
  },
  handleKeywordInput(event) {
    const keyword = event.detail.value;

    this.setData({
      keyword,
      sessions: filterSessions(this.data.allSessions, keyword)
    });
  },
  clearKeyword() {
    this.setData({
      keyword: "",
      sessions: this.data.allSessions
    });
  },
  goNoticeCenter() {
    wx.navigateTo({
      url: "/pages/notice/list/list"
    });
  },
  goDetail(event) {
    const { index } = event.currentTarget.dataset;
    const session = this.data.sessions[index];

    if (!session) {
      return;
    }

    wx.navigateTo({
      url: `/pages/chat/detail/detail?targetId=${session.partner_id}&targetType=${session.partner_type}&partnerName=${encodeURIComponent(session.partner_name || "聊天对象")}&relatedType=${session.related_type || ""}&relatedId=${session.related_id || ""}&isPinned=${session.isPinned ? 1 : 0}`
    });
  },
  async handleTogglePin(index) {
    const session = this.data.sessions[index];

    if (!session) {
      return;
    }

    try {
      await chatApi.pinSession({
        partnerId: session.partner_id,
        partnerType: session.partner_type,
        relatedType: session.related_type || "",
        relatedId: session.related_id || 0,
        isPinned: session.isPinned ? 0 : 1
      });

      wx.showToast({
        title: session.isPinned ? "已取消置顶" : "已置顶会话",
        icon: "success"
      });

      this.loadData();
    } catch (error) {
      wx.showToast({
        title: "置顶操作失败",
        icon: "none"
      });
    }
  },
  async handleDeleteSession(index) {
    const session = this.data.sessions[index];

    if (!session) {
      return;
    }

    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: "删除会话",
        content: "删除后会先在当前账号隐藏这段会话，后续有新消息时会重新出现。",
        confirmText: "删除",
        success(res) {
          resolve(Boolean(res.confirm));
        },
        fail() {
          resolve(false);
        }
      });
    });

    if (!confirm) {
      return;
    }

    try {
      await chatApi.deleteSession({
        partnerId: session.partner_id,
        partnerType: session.partner_type,
        relatedType: session.related_type || "",
        relatedId: session.related_id || 0
      });

      wx.showToast({
        title: "会话已删除",
        icon: "success"
      });

      this.loadData();
    } catch (error) {
      wx.showToast({
        title: "删除会话失败",
        icon: "none"
      });
    }
  },
  handleSessionLongPress(event) {
    const { index } = event.currentTarget.dataset;
    const session = this.data.sessions[index];

    if (!session) {
      return;
    }

    wx.showActionSheet({
      itemList: [session.isPinned ? "取消置顶" : "置顶会话", "删除会话"],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.handleTogglePin(index);
          return;
        }

        if (res.tapIndex === 1) {
          this.handleDeleteSession(index);
        }
      }
    });
  }
});
