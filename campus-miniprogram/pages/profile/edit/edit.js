const userApi = require("../../../api/user");
const { requireLogin } = require("../../../utils/auth");
const { uploadImage } = require("../../../utils/upload");

function trimText(value) {
  return String(value || "").trim();
}

function normalizeForm(userInfo) {
  return {
    avatar: userInfo.avatar || "",
    nickname: userInfo.nickname || "",
    phone: userInfo.phone || "",
    real_name: userInfo.real_name || ""
  };
}

function buildAvatarText(role, form) {
  const displayName = role === "admin" ? form.real_name : form.nickname;
  return String(displayName || "我").slice(0, 1);
}

function buildPayload(role, form) {
  if (role === "admin") {
    return {
      real_name: trimText(form.real_name),
      phone: trimText(form.phone)
    };
  }

  return {
    avatar: trimText(form.avatar),
    nickname: trimText(form.nickname),
    phone: trimText(form.phone)
  };
}

function chooseImage() {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success(res) {
        const filePath = res.tempFiles?.[0]?.tempFilePath;

        if (!filePath) {
          reject(new Error("未获取到图片文件"));
          return;
        }

        resolve(filePath);
      },
      fail: reject
    });
  });
}

Page({
  data: {
    role: "",
    form: normalizeForm({}),
    avatarText: "我",
    saving: false,
    uploading: false
  },
  onShow() {
    if (!requireLogin()) {
      return;
    }

    this.loadData();
  },
  async loadData() {
    const app = getApp();
    const role = app.globalData.role || "user";
    const userInfo = await userApi.getProfile();
    const form = normalizeForm(userInfo);

    app.updateUserInfo(userInfo);

    this.setData({
      role,
      form,
      avatarText: buildAvatarText(role, form)
    });
  },
  handleInput(event) {
    const { field } = event.currentTarget.dataset;
    const value = event.detail.value;
    const form = {
      ...this.data.form,
      [field]: value
    };

    this.setData({
      form,
      avatarText: buildAvatarText(this.data.role, form)
    });
  },
  async handleChooseAvatar() {
    if (this.data.uploading) {
      return;
    }

    this.setData({
      uploading: true
    });

    try {
      const filePath = await chooseImage();
      wx.showLoading({
        title: "上传中",
        mask: true
      });
      const avatar = await uploadImage(filePath);
      wx.hideLoading();

      this.setData({
        "form.avatar": avatar
      });
    } catch (error) {
      wx.hideLoading();

      if (String(error?.errMsg || error?.message || "").includes("cancel")) {
        return;
      }

      wx.showToast({
        title: "上传头像失败",
        icon: "none"
      });
    } finally {
      this.setData({
        uploading: false
      });
    }
  },
  async handleSave() {
    if (this.data.saving) {
      return;
    }

    const { role, form } = this.data;
    const payload = buildPayload(role, form);

    if (role === "admin" && !payload.real_name) {
      wx.showToast({
        title: "请填写姓名",
        icon: "none"
      });
      return;
    }

    if (role !== "admin" && !payload.nickname) {
      wx.showToast({
        title: "请填写昵称",
        icon: "none"
      });
      return;
    }

    if (payload.phone && !/^1\d{10}$/.test(payload.phone)) {
      wx.showToast({
        title: "手机号格式不正确",
        icon: "none"
      });
      return;
    }

    this.setData({
      saving: true
    });

    try {
      const userInfo = await userApi.updateProfile(payload);
      getApp().updateUserInfo(userInfo);

      wx.showToast({
        title: "保存成功",
        icon: "success"
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 600);
    } finally {
      this.setData({
        saving: false
      });
    }
  }
});
