const authApi = require("../../api/auth");
const { switchToRoleHome } = require("../../utils/auth");

const OPERATOR_AGREEMENTS = {
  1: {
    name: "中国移动认证服务条款",
    url: "https://wap.cmpassport.com/resources/html/contract.html"
  },
  2: {
    name: "联通统一认证服务条款",
    url: "https://opencloud.wostore.cn/authz/resource/html/disclaimer.html?fromsdk=true"
  },
  3: {
    name: "天翼账号提供认证服务与隐私协议",
    url: "https://e.189.cn/sdk/agreement/show.do?order=2&type=main&appKey=&hidetop=true&returnUrl="
  }
};

function getOperatorAgreement(operatorType) {
  return OPERATOR_AGREEMENTS[Number(operatorType)] || {
    name: "运营商认证服务条款",
    url: ""
  };
}

Page({
  data: {
    loginType: "wechat",
    loading: false,
    phoneMaskLoading: false,
    phoneMask: "",
    phoneMaskError: "",
    operatorType: 0,
    operatorAgreementName: "",
    operatorAgreementUrl: "",
    agreeProduct: false,
    agreeOperator: false,
    phoneLoginReady: false,
    phoneLoginHint: "当前暂不支持手机号登录，请先使用微信登录"
  },
  onLoad() {
    const app = getApp();
    if (app.globalData.token) {
      switchToRoleHome(app.globalData.role);
      return;
    }

    this.syncPhoneLoginState();
  },
  getPhoneLoginStatus(data = this.data) {
    if (data.loading) {
      return {
        ready: false,
        hint: "正在登录，请稍候"
      };
    }

    if (data.phoneMaskLoading) {
      return {
        ready: false,
        hint: "正在获取本机号码"
      };
    }

    if (!data.phoneMask) {
      return {
        ready: false,
        hint: data.phoneMaskError || "请先获取本机号码"
      };
    }

    if (!data.agreeProduct && !data.agreeOperator) {
      return {
        ready: false,
        hint: "请先勾选产品隐私协议和运营商协议"
      };
    }

    if (!data.agreeProduct) {
      return {
        ready: false,
        hint: "请先勾选产品隐私协议"
      };
    }

    if (!data.agreeOperator) {
      return {
        ready: false,
        hint: "请先勾选运营商协议"
      };
    }

    return {
      ready: true,
      hint: "已满足一键登录条件，请点击按钮继续"
    };
  },
  syncPhoneLoginState(partial = {}) {
    const nextData = {
      ...this.data,
      ...partial
    };
    const status = this.getPhoneLoginStatus(nextData);

    this.setData({
      ...partial,
      phoneLoginReady: status.ready,
      phoneLoginHint: status.hint
    });
  },
  handleSwitch(event) {
    const loginType = event.currentTarget.dataset.type;
    this.setData({ loginType });

    if (loginType === "phone" && !this.data.phoneMask && !this.data.phoneMaskLoading) {
      this.refreshPhoneMask();
    }
  },
  handleToggleAgreement(event) {
    const { field } = event.currentTarget.dataset;
    this.syncPhoneLoginState({
      [field]: !this.data[field]
    });
  },
  handleOpenProductAgreement() {
    if (typeof wx.openPrivacyContract === "function") {
      wx.openPrivacyContract({
        fail: () => {
          wx.showToast({
            title: "暂未配置产品隐私协议",
            icon: "none"
          });
        }
      });
      return;
    }

    wx.showToast({
      title: "当前微信版本暂不支持打开隐私协议",
      icon: "none"
    });
  },
  handleOpenOperatorAgreement() {
    const url = this.data.operatorAgreementUrl;
    const title = this.data.operatorAgreementName || "运营商认证服务条款";

    if (!url) {
      wx.showToast({
        title: "暂未获取到运营商协议",
        icon: "none"
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/auth/agreement/agreement?title=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
    });
  },
  refreshPhoneMask() {
    if (typeof wx.getPhoneMask !== "function") {
      console.warn("[auth] wx.getPhoneMask unavailable");
      this.syncPhoneLoginState({
        phoneMask: "",
        operatorType: 0,
        operatorAgreementName: "",
        operatorAgreementUrl: "",
        phoneMaskError: "当前账号暂未开通手机号一键登录，请先使用微信登录。"
      });
      return;
    }

    this.syncPhoneLoginState({
      phoneMaskLoading: true,
      phoneMaskError: "",
      phoneMask: "",
      operatorType: 0,
      operatorAgreementName: "",
      operatorAgreementUrl: ""
    });

    wx.getPhoneMask({
      success: (res) => {
        const agreement = getOperatorAgreement(res.operatorType);
        console.info("[auth] wx.getPhoneMask success", res);
        this.syncPhoneLoginState({
          phoneMask: res.phoneMask || "",
          operatorType: Number(res.operatorType || 0),
          operatorAgreementName: agreement.name,
          operatorAgreementUrl: agreement.url,
          phoneMaskError: res.phoneMask ? "" : "未获取到本机号码，请确认已开启蜂窝网络。"
        });
      },
      fail: (error) => {
        console.warn("[auth] wx.getPhoneMask fail", error);
        const message =
          Number(error.errCode) === 600006
            ? "请打开手机蜂窝网络后再获取本机号码。"
            : error.errMsg || "获取本机号码失败，请在真机上重试。";

        this.syncPhoneLoginState({
          phoneMaskError: message
        });
      },
      complete: () => {
        this.syncPhoneLoginState({
          phoneMaskLoading: false
        });
      }
    });
  },
  handlePhoneLoginGuard() {
    if (this.data.loading) {
      return;
    }

    if (this.data.phoneMaskLoading) {
      wx.showToast({
        title: "正在获取本机号码，请稍候",
        icon: "none"
      });
      return;
    }

    if (!this.data.phoneMask) {
      wx.showToast({
        title: this.data.phoneMaskError || "请先获取本机号码",
        icon: "none"
      });

      if (typeof wx.getPhoneMask === "function") {
        this.refreshPhoneMask();
      }
      return;
    }

    if (!this.data.agreeProduct && !this.data.agreeOperator) {
      wx.showToast({
        title: "请先勾选产品隐私协议和运营商协议",
        icon: "none"
      });
      return;
    }

    if (!this.data.agreeProduct) {
      wx.showToast({
        title: "请先勾选产品隐私协议",
        icon: "none"
      });
      return;
    }

    if (!this.data.agreeOperator) {
      wx.showToast({
        title: "请先勾选运营商协议",
        icon: "none"
      });
    }
  },
  async handlePhoneOneClickLogin(event) {
    if (this.data.loading) {
      return;
    }

    if (!this.data.phoneLoginReady) {
      this.handlePhoneLoginGuard();
      return;
    }

    if (!this.data.agreeProduct || !this.data.agreeOperator) {
      wx.showToast({
        title: "请先勾选产品隐私协议和运营商协议",
        icon: "none"
      });
      return;
    }

    const detail = event.detail || {};
    console.info("[auth] phoneOneClickLogin detail", detail);

    if (!detail.code) {
      const title =
        Number(detail.errCode) === 10001021
          ? "本次手机号登录已失效，请重新获取号码"
          : detail.errMsg || "手机号登录失败，请重新获取号码";

      wx.showToast({
        title,
        icon: "none"
      });
      this.refreshPhoneMask();
      return;
    }

    let loginSuccess = false;

    this.syncPhoneLoginState({
      loading: true
    });

    try {
      const data = await authApi.phoneOneClickLogin({
        code: detail.code,
        phoneMask: this.data.phoneMask,
        operatorType: this.data.operatorType
      });

      loginSuccess = true;
      getApp().setSession(data);
      wx.showToast({
        title: "登录成功",
        icon: "success"
      });

      switchToRoleHome(data.role);
    } finally {
      this.syncPhoneLoginState({
        loading: false
      });

      if (!loginSuccess) {
        this.refreshPhoneMask();
      }
    }
  },
  async handleWechatLogin() {
    this.syncPhoneLoginState({
      loading: true
    });

    try {
      const code = await new Promise((resolve, reject) => {
        wx.login({
          success(res) {
            if (res.code) {
              resolve(res.code);
              return;
            }

            reject(new Error("未获取到微信登录 code"));
          },
          fail: reject
        });
      });

      const data = await authApi.wxLogin({ code });

      getApp().setSession(data);
      wx.showToast({
        title: "登录成功",
        icon: "success"
      });

      switchToRoleHome(data.role);
    } finally {
      this.syncPhoneLoginState({
        loading: false
      });
    }
  }
});
