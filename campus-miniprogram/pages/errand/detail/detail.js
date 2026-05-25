const errandApi = require("../../../api/errand");
const reportApi = require("../../../api/report");
const { requireRole } = require("../../../utils/auth");
const { formatDateTime } = require("../../../utils/format");
const { logImageError, normalizeImageList } = require("../../../utils/image");
const {
  hasCoordinate,
  calculateDistance,
  formatDistance,
  getCurrentLocation,
  openLocation
} = require("../../../utils/location");

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

const REPORT_OPTIONS = ["虚假代拿信息", "违规引流内容", "涉嫌诈骗", "其他违规内容"];

function normalizeDetail(detail, currentLocation) {
  const pickDistance = currentLocation
    ? calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        detail.pick_latitude,
        detail.pick_longitude
      )
    : null;
  const deliverDistance = currentLocation
    ? calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        detail.deliver_latitude,
        detail.deliver_longitude
      )
    : null;

  return {
    ...detail,
    statusText: statusMapper[detail.status] || `状态 ${detail.status}`,
    createTimeText: formatDateTime(detail.create_time),
    finishTimeText: formatDateTime(detail.finish_time),
    images: normalizeImageList(detail.images),
    pickDistanceText: formatDistance(pickDistance),
    deliverDistanceText: formatDistance(deliverDistance),
    canNavigatePick: hasCoordinate(detail.pick_latitude, detail.pick_longitude),
    canNavigateDeliver: hasCoordinate(detail.deliver_latitude, detail.deliver_longitude),
    canEdit: Boolean(detail.can_edit),
    canCancel: Boolean(detail.can_cancel)
  };
}

Page({
  data: {
    detail: null,
    isPublisher: false,
    isReceiver: false,
    locationReady: false
  },
  onLoad(query) {
    this.orderId = query.id;
  },
  onShow() {
    if (!requireRole("user")) {
      return;
    }
    this.loadData(true);
  },
  async loadData(silentLocationFail = true) {
    const detail = await errandApi.getErrandDetail(this.orderId);
    const currentUserId = getApp().globalData.userInfo?.user_id;
    let currentLocation = null;

    try {
      currentLocation = await getCurrentLocation();
    } catch (error) {
      currentLocation = null;
      if (!silentLocationFail) {
        wx.showToast({
          title: "暂未获取到你的位置",
          icon: "none"
        });
      }
    }

    this.setData({
      detail: normalizeDetail(detail, currentLocation),
      isPublisher: Number(detail.publisher_id) === Number(currentUserId),
      isReceiver: Number(detail.receiver_id) === Number(currentUserId),
      locationReady: Boolean(currentLocation)
    });
  },
  async handleReceive() {
    await errandApi.receiveErrand(this.orderId);
    wx.showToast({
      title: "接单成功",
      icon: "success"
    });
    this.loadData();
  },
  async handleDelivered() {
    await errandApi.updateErrandStatus(this.orderId, {
      status: 3
    });
    wx.showToast({
      title: "已送达，等待确认",
      icon: "success"
    });
    this.loadData();
  },
  async handleConfirm() {
    await errandApi.updateErrandStatus(this.orderId, {
      status: 4
    });
    wx.showToast({
      title: "订单已完成",
      icon: "success"
    });
    this.loadData();
  },
  handleEdit() {
    wx.navigateTo({
      url: `/pages/errand/publish/publish?id=${this.orderId}`
    });
  },
  handleCancel() {
    wx.showModal({
      title: "取消订单",
      content: "取消后该订单不会继续展示给其他同学，你之后仍可以重新编辑再发布。",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        await errandApi.cancelErrand(this.orderId);
        wx.showToast({
          title: "订单已取消",
          icon: "success"
        });
        this.loadData();
      }
    });
  },
  handleCopy() {
    if (!this.data.detail?.contact_visible) {
      wx.showToast({
        title: "当前不可查看联系方式",
        icon: "none"
      });
      return;
    }

    wx.setClipboardData({
      data: this.data.detail.contact_info || ""
    });
  },
  handleRefreshDistance() {
    this.loadData(false);
  },
  handleNavigatePick() {
    const detail = this.data.detail || {};
    openLocation({
      latitude: detail.pick_latitude,
      longitude: detail.pick_longitude,
      name: "取件点",
      address: detail.pick_address
    });
  },
  handleNavigateDeliver() {
    const detail = this.data.detail || {};
    openLocation({
      latitude: detail.deliver_latitude,
      longitude: detail.deliver_longitude,
      name: "送达点",
      address: detail.deliver_address
    });
  },
  previewImage(event) {
    const { current } = event.currentTarget.dataset;
    wx.previewImage({
      current,
      urls: this.data.detail.images || []
    });
  },
  handleImageError(event) {
    logImageError("errand-detail", event);
  },
  handleRelease() {
    wx.showModal({
      title: "重新开放订单",
      content: "取消当前接单后，订单会重新回到待接单状态，是否继续？",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        await errandApi.releaseErrand(this.orderId);
        wx.showToast({
          title: "订单已重新开放",
          icon: "success"
        });
        this.loadData();
      }
    });
  },
  async handleReport() {
    wx.showActionSheet({
      itemList: REPORT_OPTIONS,
      success: async (res) => {
        const reason = REPORT_OPTIONS[res.tapIndex];
        if (!reason) {
          return;
        }

        await reportApi.submitReport({
          businessType: "errand",
          businessId: Number(this.orderId),
          reason
        });

        wx.showToast({
          title: "举报已提交",
          icon: "success"
        });
      }
    });
  },
  goChat() {
    const { detail, isPublisher } = this.data;
    let targetId = "";
    let partnerName = "";

    if (isPublisher && detail.receiver_id) {
      targetId = detail.receiver_id;
      partnerName = detail.receiver_name || "接单同学";
    } else if (!isPublisher) {
      targetId = detail.publisher_id;
      partnerName = detail.publisher_name || "发布方";
    }

    if (!targetId) {
      wx.showToast({
        title: "当前暂无聊天对象",
        icon: "none"
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/chat/detail/detail?targetId=${targetId}&targetType=1&partnerName=${encodeURIComponent(partnerName)}&relatedType=errand&relatedId=${detail.order_id}`
    });
  }
});
