const idleApi = require("../../../api/idle");
const reportApi = require("../../../api/report");
const { requireRole } = require("../../../utils/auth");
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
  1: "在售",
  2: "已驳回",
  3: "已下架",
  4: "已售出"
};

const REPORT_OPTIONS = ["虚假商品信息", "违规引流内容", "涉嫌欺诈", "其他违规内容"];

function buildLocationMarkers(detail) {
  if (!hasCoordinate(detail.trade_latitude, detail.trade_longitude)) {
    return [];
  }

  return [
    {
      id: 1,
      latitude: Number(detail.trade_latitude),
      longitude: Number(detail.trade_longitude),
      title: detail.trade_address || "交易地点",
      width: 28,
      height: 28
    }
  ];
}

function normalizeDetail(detail, currentLocation) {
  const distance = currentLocation
    ? calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        detail.trade_latitude,
        detail.trade_longitude
      )
    : null;

  const images = normalizeImageList(detail.images);

  return {
    ...detail,
    images,
    otherImages: images.slice(1),
    coverImage: images[0] || "",
    statusText: statusMapper[detail.status] || `状态 ${detail.status}`,
    distanceText: formatDistance(distance),
    canNavigate: hasCoordinate(detail.trade_latitude, detail.trade_longitude),
    canEdit: true
  };
}

Page({
  data: {
    detail: null,
    locationMarkers: [],
    isOwner: false,
    locationReady: false
  },
  onLoad(query) {
    this.goodsId = query.id;
  },
  onShow() {
    if (!requireRole("user")) {
      return;
    }
    this.loadData(true);
  },
  async loadData(silentLocationFail = true) {
    const detail = await idleApi.getIdleDetail(this.goodsId);
    const userId = getApp().globalData.userInfo?.user_id;
    let currentLocation = null;

    try {
      currentLocation = await getCurrentLocation();
    } catch (error) {
      currentLocation = null;
      if (!silentLocationFail) {
        wx.showToast({
          title: "暂未获取到你的定位",
          icon: "none"
        });
      }
    }

    const normalized = normalizeDetail(detail, currentLocation);

    this.setData({
      detail: normalized,
      locationMarkers: buildLocationMarkers(normalized),
      isOwner: Number(userId) === Number(detail.user_id),
      locationReady: Boolean(currentLocation)
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
    logImageError("idle-detail", event);
  },
  handleRefreshDistance() {
    this.loadData(false);
  },
  handleNavigate() {
    const detail = this.data.detail || {};
    openLocation({
      latitude: detail.trade_latitude,
      longitude: detail.trade_longitude,
      name: "闲置交易点",
      address: detail.trade_address
    });
  },
  async handleDown() {
    await idleApi.downIdle(this.goodsId);
    wx.showToast({
      title: "商品已下架",
      icon: "success"
    });
    this.loadData();
  },
  handleEdit() {
    wx.navigateTo({
      url: `/pages/idle/publish/publish?id=${this.goodsId}`
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
          businessType: "idle",
          businessId: Number(this.goodsId),
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
    if (this.data.isOwner) {
      wx.showToast({
        title: "这是你自己发布的商品",
        icon: "none"
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/chat/detail/detail?targetId=${this.data.detail.user_id}&targetType=1&partnerName=${encodeURIComponent(this.data.detail.nickname || "卖家")}&relatedType=idle&relatedId=${this.data.detail.goods_id}`
    });
  }
});
