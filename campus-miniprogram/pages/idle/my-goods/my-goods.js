const idleApi = require("../../../api/idle");
const { requireRole } = require("../../../utils/auth");
const { logImageError, normalizeImageList } = require("../../../utils/image");

const statusMapper = {
  0: "待审核",
  1: "已上架",
  2: "已驳回",
  3: "已下架",
  4: "已售出"
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
    const list = await idleApi.getIdleMyList();
    this.fullList = (list || []).map((item) => {
      const images = normalizeImageList(item.images);
      return {
        ...item,
        images,
        coverImage: images[0] || "",
        statusText: statusMapper[item.status] || `状态 ${item.status}`,
        canEdit: true,
        editText: Number(item.status) === 0 ? "编辑并提交审核" : "重新编辑并提交"
      };
    });
    this.applyFilter();
  },
  applyFilter() {
    const filter = this.data.currentFilter;
    const list = (this.fullList || []).filter((item) => {
      if (filter === "all") return true;
      return String(item.status) === String(filter);
    });
    this.setData({ list });
  },
  handleFilterChange(event) {
    this.setData({
      currentFilter: event.currentTarget.dataset.value
    });
    this.applyFilter();
  },
  goPublish() {
    wx.navigateTo({
      url: "/pages/idle/publish/publish"
    });
  },
  goEdit(event) {
    wx.navigateTo({
      url: `/pages/idle/publish/publish?id=${event.currentTarget.dataset.id}`
    });
  },
  goDetail(event) {
    wx.navigateTo({
      url: `/pages/idle/detail/detail?id=${event.currentTarget.dataset.id}`
    });
  },
  handleImageError(event) {
    logImageError("idle-my-goods", event);
  },
  async handleDown(event) {
    const { id } = event.currentTarget.dataset;
    await idleApi.downIdle(id);
    wx.showToast({
      title: "商品已下架",
      icon: "success"
    });
    this.loadData();
  }
});
