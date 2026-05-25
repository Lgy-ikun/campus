const errandApi = require("../../../api/errand");
const { requireRole } = require("../../../utils/auth");
const { formatDateTime } = require("../../../utils/format");
const {
  calculateDistance,
  formatDistance,
  getCurrentLocation
} = require("../../../utils/location");

const statusMapper = {
  1: "待接单",
  2: "进行中",
  3: "待确认",
  4: "已完成"
};

function normalizeList(list, currentLocation) {
  return (list || []).map((item) => {
    const pickDistance = currentLocation
      ? calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          item.pick_latitude,
          item.pick_longitude
        )
      : null;
    const deliverDistance = currentLocation
      ? calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          item.deliver_latitude,
          item.deliver_longitude
        )
      : null;

    return {
      ...item,
      statusText: statusMapper[item.status] || `状态 ${item.status}`,
      createTimeText: formatDateTime(item.create_time),
      pickDistanceText: formatDistance(pickDistance),
      deliverDistanceText: formatDistance(deliverDistance)
    };
  });
}

Page({
  data: {
    keyword: "",
    list: [],
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
    const data = await errandApi.getErrandList({
      keyword: this.data.keyword,
      pageNum: 1,
      pageSize: 20
    });

    let currentLocation = null;

    try {
      currentLocation = await getCurrentLocation();
    } catch (error) {
      currentLocation = null;
    }

    this.setData({
      list: normalizeList(data.list, currentLocation),
      locationReady: Boolean(currentLocation)
    });
  },
  goPublish() {
    wx.navigateTo({
      url: "/pages/errand/publish/publish"
    });
  },
  goMyOrder() {
    wx.navigateTo({
      url: "/pages/errand/my-order/my-order"
    });
  },
  goDetail(event) {
    wx.navigateTo({
      url: `/pages/errand/detail/detail?id=${event.currentTarget.dataset.id}`
    });
  }
});
