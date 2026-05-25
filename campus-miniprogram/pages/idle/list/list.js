const idleApi = require("../../../api/idle");
const { requireRole } = require("../../../utils/auth");
const { normalizeImageList } = require("../../../utils/image");
const {
  calculateDistance,
  formatDistance,
  getCurrentLocation,
  hasCoordinate
} = require("../../../utils/location");

function normalizeImages(images) {
  return normalizeImageList(images);
}

function normalizeGoods(item, currentLocation) {
  const images = normalizeImages(item.images);
  const distance = currentLocation && hasCoordinate(item.trade_latitude, item.trade_longitude)
    ? calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        item.trade_latitude,
        item.trade_longitude
      )
    : null;

  return {
    ...item,
    images,
    coverImage: images[0] || "",
    statusText: "在售",
    distanceText: formatDistance(distance)
  };
}

Page({
  data: {
    keyword: "",
    list: [],
    loading: false,
    locationReady: false
  },
  onShow() {
    if (!requireRole("user")) {
      return;
    }
    this.loadData();
  },
  handleInput(event) {
    this.setData({
      keyword: event.detail.value
    });
  },
  async loadData() {
    if (this.data.loading) {
      return;
    }

    this.setData({
      loading: true
    });

    let currentLocation = null;

    try {
      currentLocation = await getCurrentLocation();
    } catch (error) {
      currentLocation = null;
    }

    try {
      const data = await idleApi.getIdleList({
        keyword: this.data.keyword,
        pageNum: 1,
        pageSize: 20
      });

      this.setData({
        list: (data.list || []).map((item) => normalizeGoods(item, currentLocation)),
        locationReady: Boolean(currentLocation)
      });
    } finally {
      this.setData({
        loading: false
      });
    }
  },
  goPublish() {
    wx.navigateTo({
      url: "/pages/idle/publish/publish"
    });
  },
  goMyGoods() {
    wx.navigateTo({
      url: "/pages/idle/my-goods/my-goods"
    });
  },
  goDetail(event) {
    wx.navigateTo({
      url: `/pages/idle/detail/detail?id=${event.currentTarget.dataset.id}`
    });
  }
});
