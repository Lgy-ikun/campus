const idleApi = require("../../../api/idle");
const systemApi = require("../../../api/system");
const { requireRole } = require("../../../utils/auth");
const { normalizeImageList } = require("../../../utils/image");

function normalizeLocation(detail = {}) {
  return {
    address: detail.trade_address || "",
    latitude: detail.trade_latitude === undefined || detail.trade_latitude === null ? "" : String(detail.trade_latitude),
    longitude: detail.trade_longitude === undefined || detail.trade_longitude === null ? "" : String(detail.trade_longitude)
  };
}

function validateMoney(value, label) {
  const text = String(value || "").trim();

  if (!text) {
    return {
      valid: false,
      message: `请输入${label}`
    };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return {
      valid: false,
      message: `${label}请输入数字，最多保留两位小数`
    };
  }

  const amount = Number(text);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      valid: false,
      message: `${label}必须大于0`
    };
  }

  if (amount > 999999.99) {
    return {
      valid: false,
      message: `${label}不能超过999999.99`
    };
  }

  return {
    valid: true,
    value: amount.toFixed(2)
  };
}

Page({
  data: {
    submitting: false,
    imageUploading: false,
    uploadSettings: {
      maxImages: 20,
      maxSizeMb: 5
    },
    editingId: "",
    pageTitle: "发布闲置商品",
    submitText: "提交审核",
    form: {
      title: "",
      price: "",
      description: "",
      images: [],
      tradeLocation: {
        address: "",
        latitude: "",
        longitude: ""
      }
    }
  },
  onLoad(query) {
    this.loadUploadSettings();

    if (query.id) {
      this.setData({
        editingId: query.id,
        pageTitle: "编辑闲置商品",
        submitText: "提交审核"
      });
    }
  },
  async loadUploadSettings() {
    try {
      const settings = await systemApi.getPublicSettings();
      getApp().updateSettings(settings);
      this.setData({
        uploadSettings: {
          maxImages: Number(settings.idleMaxImages || 20),
          maxSizeMb: Number(settings.uploadMaxSizeMb || 0)
        }
      });
    } catch (error) {
      const appSettings = getApp().globalData.settings || {};
      this.setData({
        uploadSettings: {
          maxImages: Number(appSettings.idleMaxImages || 20),
          maxSizeMb: Number(appSettings.uploadMaxSizeMb || 5)
        }
      });
    }
  },
  onShow() {
    if (!requireRole("user")) {
      return;
    }

    if (this.data.editingId && !this.detailLoaded) {
      this.loadDetail();
    }
  },
  async loadDetail() {
    const detail = await idleApi.getIdleDetail(this.data.editingId);
    this.detailLoaded = true;
    this.setData({
      form: {
        title: detail.title || "",
        price: detail.price || "",
        description: detail.description || "",
        images: normalizeImageList(detail.images),
        tradeLocation: normalizeLocation(detail)
      }
    });
  },
  handleInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({
      [`form.${field}`]: event.detail.value
    });
  },
  handleImageChange(event) {
    this.setData({
      "form.images": event.detail.files || []
    });
  },
  handleImageUploadingChange(event) {
    this.setData({
      imageUploading: !!event.detail.uploading
    });
  },
  handleTradeLocationChange(event) {
    this.setData({
      "form.tradeLocation": event.detail || {
        address: "",
        latitude: "",
        longitude: ""
      }
    });
  },
  async handleSubmit() {
    if (this.data.submitting) {
      return;
    }

    if (this.data.imageUploading) {
      wx.showToast({
        title: "图片上传中，请稍后提交",
        icon: "none"
      });
      return;
    }

    const { title, price, description, images, tradeLocation } = this.data.form;
    const maxImages = Number(this.data.uploadSettings.maxImages || 20);

    if (!title || !price) {
      wx.showToast({
        title: "请填写标题和价格",
        icon: "none"
      });
      return;
    }

    const priceResult = validateMoney(price, "价格");
    if (!priceResult.valid) {
      wx.showToast({
        title: priceResult.message,
        icon: "none"
      });
      return;
    }

    if (!tradeLocation.address || !tradeLocation.latitude || !tradeLocation.longitude) {
      wx.showToast({
        title: "请选择交易地点",
        icon: "none"
      });
      return;
    }

    if (Array.isArray(images) && images.length > maxImages) {
      wx.showToast({
        title: `最多上传${maxImages}张图片`,
        icon: "none"
      });
      return;
    }

    this.setData({
      submitting: true
    });

    try {
      const payload = {
        title,
        price: priceResult.value,
        description,
        images,
        trade_address: tradeLocation.address,
        trade_latitude: tradeLocation.latitude,
        trade_longitude: tradeLocation.longitude
      };

      if (this.data.editingId) {
        await idleApi.updateIdle(this.data.editingId, payload);
      } else {
        await idleApi.addIdle(payload);
      }

      wx.showToast({
        title: this.data.editingId ? "已提交审核" : "发布成功",
        icon: "success"
      });

      setTimeout(() => {
        wx.redirectTo({
          url: "/pages/idle/my-goods/my-goods"
        });
      }, 600);
    } finally {
      this.setData({
        submitting: false
      });
    }
  }
});
