const errandApi = require("../../../api/errand");
const systemApi = require("../../../api/system");
const { requireRole } = require("../../../utils/auth");
const { normalizeImageList } = require("../../../utils/image");

function normalizeLocation(address, latitude, longitude) {
  return {
    address: address || "",
    latitude: latitude === undefined || latitude === null ? "" : String(latitude),
    longitude: longitude === undefined || longitude === null ? "" : String(longitude)
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
    pageTitle: "发布代拿订单",
    submitText: "提交审核",
    form: {
      title: "",
      description: "",
      reward: "",
      contact_info: "",
      expect_time: "",
      images: [],
      pickLocation: {
        address: "",
        latitude: "",
        longitude: ""
      },
      deliverLocation: {
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
        pageTitle: "修改代拿订单",
        submitText: "重新提交审核"
      });
    }
  },
  async loadUploadSettings() {
    try {
      const settings = await systemApi.getPublicSettings();
      getApp().updateSettings(settings);
      this.setData({
        uploadSettings: {
          maxImages: Number(settings.errandMaxImages || 20),
          maxSizeMb: Number(settings.uploadMaxSizeMb || 0)
        }
      });
    } catch (error) {
      const appSettings = getApp().globalData.settings || {};
      this.setData({
        uploadSettings: {
          maxImages: Number(appSettings.errandMaxImages || 20),
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
    const detail = await errandApi.getErrandDetail(this.data.editingId);
    this.detailLoaded = true;
    this.setData({
      form: {
        title: detail.title || "",
        description: detail.description || "",
        reward: detail.reward || "",
        contact_info: detail.contact_info || "",
        expect_time: detail.expect_time || "",
        images: normalizeImageList(detail.images),
        pickLocation: normalizeLocation(detail.pick_address, detail.pick_latitude, detail.pick_longitude),
        deliverLocation: normalizeLocation(detail.deliver_address, detail.deliver_latitude, detail.deliver_longitude)
      }
    });
  },
  handleInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({
      [`form.${field}`]: event.detail.value
    });
  },
  handlePickLocationChange(event) {
    this.setData({
      "form.pickLocation": event.detail || normalizeLocation()
    });
  },
  handleDeliverLocationChange(event) {
    this.setData({
      "form.deliverLocation": event.detail || normalizeLocation()
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

    const {
      title,
      description,
      reward,
      contact_info,
      expect_time,
      images,
      pickLocation,
      deliverLocation
    } = this.data.form;
    const maxImages = Number(this.data.uploadSettings.maxImages || 20);

    if (
      !title ||
      !reward ||
      !contact_info ||
      !pickLocation.address ||
      !pickLocation.latitude ||
      !pickLocation.longitude ||
      !deliverLocation.address ||
      !deliverLocation.latitude ||
      !deliverLocation.longitude
    ) {
      wx.showToast({
        title: "请完整填写代拿信息",
        icon: "none"
      });
      return;
    }

    const rewardResult = validateMoney(reward, "赏金");
    if (!rewardResult.valid) {
      wx.showToast({
        title: rewardResult.message,
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
        description,
        reward: rewardResult.value,
        contact_info,
        expect_time: expect_time || "",
        images,
        pick_address: pickLocation.address,
        pick_latitude: pickLocation.latitude,
        pick_longitude: pickLocation.longitude,
        deliver_address: deliverLocation.address,
        deliver_latitude: deliverLocation.latitude,
        deliver_longitude: deliverLocation.longitude
      };

      if (this.data.editingId) {
        await errandApi.updateErrand(this.data.editingId, payload);
      } else {
        await errandApi.addErrand(payload);
      }

      wx.showToast({
        title: this.data.editingId ? "已重新提交" : "发布成功",
        icon: "success"
      });

      setTimeout(() => {
        wx.redirectTo({
          url: "/pages/errand/my-order/my-order"
        });
      }, 600);
    } finally {
      this.setData({
        submitting: false
      });
    }
  }
});
