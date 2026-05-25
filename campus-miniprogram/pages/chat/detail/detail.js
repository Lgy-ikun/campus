const chatApi = require("../../../api/chat");
const { requireLogin } = require("../../../utils/auth");
const { formatDateTime } = require("../../../utils/format");
const { uploadImage } = require("../../../utils/upload");

const POLL_INTERVAL = 3000;

function getCurrentType() {
  return 1;
}

function createLocalMessage(filePath) {
  const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    localId,
    renderKey: localId,
    message_id: 0,
    content: filePath,
    isSelf: true,
    isImage: true,
    message_type: 2,
    timeText: "发送中...",
    status: "sending",
    sortValue: Date.now()
  };
}

function buildRemoteMessage(item, currentUserId, currentType) {
  const messageId = Number(item.message_id || 0);

  return {
    ...item,
    message_id: messageId,
    renderKey: `server-${messageId}`,
    timeText: formatDateTime(item.create_time),
    isSelf: Number(item.sender_id) === Number(currentUserId) && Number(item.sender_type) === Number(currentType),
    isImage: Number(item.message_type) === 2,
    status: "sent",
    sortValue: messageId || Date.now()
  };
}

Page({
  data: {
    partnerName: "",
    relatedType: "",
    relatedId: "",
    targetId: "",
    targetType: "",
    isPinned: false,
    messages: [],
    content: "",
    scrollIntoView: "",
    sendingImage: false
  },
  onLoad(query) {
    const partnerName = decodeURIComponent(query.partnerName || "聊天对象");

    this.remoteMessages = [];
    this.pendingMessages = [];
    this.recordLoading = false;
    this.needsReload = false;
    this.reloadNeedsMarkRead = false;

    this.setData({
      partnerName,
      relatedType: query.relatedType || "",
      relatedId: query.relatedId || "",
      targetId: query.targetId || "",
      targetType: query.targetType || "",
      isPinned: Number(query.isPinned || 0) === 1
    });

    wx.setNavigationBarTitle({
      title: partnerName || "聊天详情"
    });
  },
  onShow() {
    if (!requireLogin()) {
      return;
    }

    this.loadSessionMeta();
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
      this.loadData(false);
    }, POLL_INTERVAL);
  },
  stopPolling() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },
  syncMessages() {
    const messages = [...this.remoteMessages, ...this.pendingMessages].sort((left, right) => {
      return Number(left.sortValue || 0) - Number(right.sortValue || 0);
    });
    const lastMessage = messages[messages.length - 1];

    this.setData({
      messages,
      scrollIntoView: lastMessage ? `msg-${lastMessage.renderKey}` : ""
    });
  },
  getReadPayload() {
    return {
      senderId: Number(this.data.targetId),
      senderType: Number(this.data.targetType),
      relatedType: this.data.relatedType || "",
      relatedId: this.data.relatedId ? Number(this.data.relatedId) : 0
    };
  },
  async markCurrentSessionRead() {
    await chatApi.markChatRead(this.getReadPayload());
  },
  upsertRemoteMessage(message) {
    const currentUserId = getApp().globalData.userInfo?.user_id;
    const currentType = getCurrentType();
    const nextMessage = buildRemoteMessage(message, currentUserId, currentType);
    const nextList = this.remoteMessages.filter((item) => Number(item.message_id) !== Number(nextMessage.message_id));

    nextList.push(nextMessage);
    nextList.sort((left, right) => Number(left.sortValue || 0) - Number(right.sortValue || 0));
    this.remoteMessages = nextList;
    this.syncMessages();
  },
  addPendingImageMessage(filePath) {
    const pendingMessage = createLocalMessage(filePath);

    this.pendingMessages = [...this.pendingMessages, pendingMessage];
    this.syncMessages();
    return pendingMessage.localId;
  },
  updatePendingMessage(localId, patch) {
    this.pendingMessages = this.pendingMessages.map((item) => {
      if (item.localId !== localId) {
        return item;
      }

      return {
        ...item,
        ...patch
      };
    });

    this.syncMessages();
  },
  removePendingMessage(localId) {
    this.pendingMessages = this.pendingMessages.filter((item) => item.localId !== localId);
    this.syncMessages();
  },
  handleInput(event) {
    this.setData({
      content: event.detail.value
    });
  },
  async loadSessionMeta() {
    const list = await chatApi.getSessionList();
    const matched = (list || []).find((item) => (
      Number(item.partner_id) === Number(this.data.targetId)
      && Number(item.partner_type) === Number(this.data.targetType)
      && String(item.related_type || "") === String(this.data.relatedType || "")
      && Number(item.related_id || 0) === Number(this.data.relatedId || 0)
    ));

    if (matched) {
      this.setData({
        isPinned: Number(matched.is_pinned || 0) === 1
      });
    }
  },
  async loadData(markRead = true) {
    if (this.recordLoading) {
      this.needsReload = true;
      this.reloadNeedsMarkRead = this.reloadNeedsMarkRead || markRead;
      return;
    }

    this.recordLoading = true;

    try {
      const currentUserId = getApp().globalData.userInfo?.user_id;
      const currentType = getCurrentType();
      const records = await chatApi.getChatRecord({
        targetId: this.data.targetId,
        targetType: this.data.targetType,
        relatedType: this.data.relatedType,
        relatedId: this.data.relatedId
      });
      const remoteMessages = (records || []).map((item) => buildRemoteMessage(item, currentUserId, currentType));
      const hasUnreadIncoming = remoteMessages.some((item) => !item.isSelf && Number(item.is_read || 0) === 0);

      this.remoteMessages = remoteMessages;
      this.syncMessages();

      if (markRead || hasUnreadIncoming) {
        await this.markCurrentSessionRead();
      }
    } finally {
      this.recordLoading = false;

      if (this.needsReload) {
        const nextMarkRead = this.reloadNeedsMarkRead;

        this.needsReload = false;
        this.reloadNeedsMarkRead = false;
        this.loadData(nextMarkRead);
      }
    }
  },
  async handleSend() {
    const content = this.data.content.trim();

    if (!content) {
      wx.showToast({
        title: "请输入消息内容",
        icon: "none"
      });
      return;
    }

    try {
      const message = await chatApi.sendMessage({
        receiver_id: Number(this.data.targetId),
        receiver_type: Number(this.data.targetType),
        content,
        related_type: this.data.relatedType || "",
        related_id: this.data.relatedId ? Number(this.data.relatedId) : null
      });

      this.setData({
        content: ""
      });

      if (message) {
        this.upsertRemoteMessage(message);
        return;
      }

      this.loadData(false);
    } catch (error) {
      wx.showToast({
        title: "消息发送失败",
        icon: "none"
      });
    }
  },
  handleSendImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      success: async (res) => {
        const filePath = res.tempFiles?.[0]?.tempFilePath;

        if (!filePath) {
          return;
        }

        const localId = this.addPendingImageMessage(filePath);

        this.setData({
          sendingImage: true
        });

        try {
          const imageUrl = await uploadImage(filePath);
          const message = await chatApi.sendMessage({
            receiver_id: Number(this.data.targetId),
            receiver_type: Number(this.data.targetType),
            content: imageUrl,
            message_type: 2,
            related_type: this.data.relatedType || "",
            related_id: this.data.relatedId ? Number(this.data.relatedId) : null
          });

          this.removePendingMessage(localId);

          if (message) {
            this.upsertRemoteMessage(message);
          } else {
            this.loadData(false);
          }
        } catch (error) {
          this.updatePendingMessage(localId, {
            status: "failed",
            timeText: "发送失败"
          });

          wx.showToast({
            title: "图片发送失败",
            icon: "none"
          });
        } finally {
          this.setData({
            sendingImage: false
          });
        }
      }
    });
  },
  previewImage(event) {
    const { current } = event.currentTarget.dataset;
    const urls = this.data.messages
      .filter((item) => item.isImage)
      .map((item) => item.content);

    wx.previewImage({
      current,
      urls
    });
  },
  async handleTogglePin() {
    const nextPinned = !this.data.isPinned;

    try {
      await chatApi.pinSession({
        partnerId: Number(this.data.targetId),
        partnerType: Number(this.data.targetType),
        relatedType: this.data.relatedType || "",
        relatedId: this.data.relatedId ? Number(this.data.relatedId) : 0,
        isPinned: nextPinned ? 1 : 0
      });

      this.setData({
        isPinned: nextPinned
      });

      wx.showToast({
        title: nextPinned ? "会话已置顶" : "已取消置顶",
        icon: "success"
      });
    } catch (error) {
      wx.showToast({
        title: "置顶操作失败",
        icon: "none"
      });
    }
  }
});
