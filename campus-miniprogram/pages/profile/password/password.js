const authApi = require("../../../api/auth");
const { requireLogin } = require("../../../utils/auth");

Page({
  data: {
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
    saving: false
  },
  onShow() {
    requireLogin();
  },
  handleInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({
      [field]: event.detail.value
    });
  },
  async handleSubmit() {
    if (this.data.saving) {
      return;
    }

    const oldPassword = String(this.data.oldPassword || "").trim();
    const newPassword = String(this.data.newPassword || "").trim();
    const confirmPassword = String(this.data.confirmPassword || "").trim();

    if (!newPassword) {
      wx.showToast({
        title: "请输入新密码",
        icon: "none"
      });
      return;
    }

    if (newPassword.length < 6) {
      wx.showToast({
        title: "新密码至少 6 位",
        icon: "none"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      wx.showToast({
        title: "两次输入的新密码不一致",
        icon: "none"
      });
      return;
    }

    this.setData({
      saving: true
    });

    try {
      await authApi.updatePassword({
        oldPassword,
        newPassword
      });

      wx.showToast({
        title: "密码修改成功",
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