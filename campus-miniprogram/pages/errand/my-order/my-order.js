const errandApi = require("../../../api/errand");
const { requireRole } = require("../../../utils/auth");
const { formatDateTime } = require("../../../utils/format");

const statusMapper = {
  0: "待审核",
  1: "待接单",
  2: "进行中",
  3: "待确认",
  4: "已完成",
  5: "已取消",
  6: "已驳回",
  7: "已下架"
};

Page({
  data: {
    list: [],
    currentFilter: "all"
  },
  onShow() {
    if (!requireRole("user")) {
      return;
    }
    this.loadData();
  },
  async loadData() {
    const currentUserId = getApp().globalData.userInfo?.user_id;
    const list = await errandApi.getErrandMyList();
    this.currentUserId = currentUserId;
    this.fullList = (list || []).map((item) => {
      const isPublisher = Number(item.publisher_id) === Number(currentUserId);
      const isReceiver = Number(item.receiver_id) === Number(currentUserId);

      return {
        ...item,
        statusText: statusMapper[item.status] || `状态 ${item.status}`,
        roleText: isPublisher ? "我发布的" : "我接单的",
        isPublisher,
        isReceiver,
        canEdit: Boolean(item.can_edit),
        canCancel: Boolean(item.can_cancel),
        createTimeText: formatDateTime(item.create_time)
      };
    });
    this.applyFilter();
  },
  applyFilter() {
    const filter = this.data.currentFilter;
    const list = (this.fullList || []).filter((item) => {
      if (filter === "all") return true;
      if (filter === "publish") return item.isPublisher;
      if (filter === "receive") return item.isReceiver;
      if (filter === "rejected") return item.isPublisher && Number(item.status) === 6;
      return true;
    });
    this.setData({ list });
  },
  handleFilterChange(event) {
    this.setData({
      currentFilter: event.currentTarget.dataset.value
    });
    this.applyFilter();
  },
  goDetail(event) {
    wx.navigateTo({
      url: `/pages/errand/detail/detail?id=${event.currentTarget.dataset.id}`
    });
  },
  goPublish() {
    wx.navigateTo({
      url: "/pages/errand/publish/publish"
    });
  },
  goEdit(event) {
    wx.navigateTo({
      url: `/pages/errand/publish/publish?id=${event.currentTarget.dataset.id}`
    });
  },
  handleCancel(event) {
    const { id } = event.currentTarget.dataset;
    wx.showModal({
      title: "取消订单",
      content: "取消后该订单不会继续展示给其他同学，你之后仍可以重新编辑再发布。",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        await errandApi.cancelErrand(id);
        wx.showToast({
          title: "订单已取消",
          icon: "success"
        });
        this.loadData();
      }
    });
  },
  async handleDelivered(event) {
    const { id } = event.currentTarget.dataset;
    await errandApi.updateErrandStatus(id, {
      status: 3
    });
    wx.showToast({
      title: "已送达，等待确认",
      icon: "success"
    });
    this.loadData();
  },
  async handleConfirm(event) {
    const { id } = event.currentTarget.dataset;
    await errandApi.updateErrandStatus(id, {
      status: 4
    });
    wx.showToast({
      title: "订单已完成",
      icon: "success"
    });
    this.loadData();
  },
  handleRelease(event) {
    const { id } = event.currentTarget.dataset;
    wx.showModal({
      title: "重新开放订单",
      content: "取消当前接单后，订单会重新回到待接单状态，是否继续？",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        await errandApi.releaseErrand(id);
        wx.showToast({
          title: "订单已重新开放",
          icon: "success"
        });
        this.loadData();
      }
    });
  },
  goChat(event) {
    const { index } = event.currentTarget.dataset;
    const item = this.data.list[index];
    let targetId = "";
    let partnerName = "";

    if (item.isPublisher && item.receiver_id) {
      targetId = item.receiver_id;
      partnerName = item.receiver_name || "接单同学";
    } else if (item.isReceiver) {
      targetId = item.publisher_id;
      partnerName = item.publisher_name || "发布方";
    }

    if (!targetId) {
      wx.showToast({
        title: "当前暂无聊天对象",
        icon: "none"
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/chat/detail/detail?targetId=${targetId}&targetType=1&partnerName=${encodeURIComponent(partnerName)}&relatedType=errand&relatedId=${item.order_id}`
    });
  }
});
