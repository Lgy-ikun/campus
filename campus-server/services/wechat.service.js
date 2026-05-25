const https = require("https");

let accessTokenCache = {
  token: "",
  expireAt: 0
};

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        let raw = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error("微信接口请求失败"));
            return;
          }

          try {
            resolve(JSON.parse(raw));
          } catch (error) {
            reject(new Error("微信接口响应解析失败"));
          }
        });
      })
      .on("error", reject);
  });
}

function requestJsonPost(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data || {});
    const targetUrl = new URL(url);

    const request = https.request(
      {
        hostname: targetUrl.hostname,
        port: targetUrl.port || 443,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (response) => {
        let raw = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error("微信接口请求失败"));
            return;
          }

          try {
            resolve(JSON.parse(raw || "{}"));
          } catch (error) {
            reject(new Error("微信接口响应解析失败"));
          }
        });
      }
    );

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function getWechatConfig() {
  const appId = String(process.env.WECHAT_APPID || "").trim();
  const appSecret = String(process.env.WECHAT_APP_SECRET || "").trim();

  if (!appId || !appSecret) {
    throw new Error("未配置微信小程序 APPID 或 APP SECRET");
  }

  return {
    appId,
    appSecret
  };
}

async function fetchWechatAccessToken() {
  if (accessTokenCache.token && accessTokenCache.expireAt > Date.now() + 60 * 1000) {
    return accessTokenCache.token;
  }

  const { appId, appSecret } = getWechatConfig();
  const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", appSecret);

  const result = await requestJson(url);

  if (result.errcode) {
    throw new Error(result.errmsg || "微信 access_token 获取失败");
  }

  accessTokenCache = {
    token: result.access_token,
    expireAt: Date.now() + Math.max(Number(result.expires_in || 7200) - 300, 60) * 1000
  };

  return accessTokenCache.token;
}

async function fetchWechatSession(code) {
  const { appId, appSecret } = getWechatConfig();

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", appSecret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const result = await requestJson(url);

  if (result.errcode) {
    throw new Error(result.errmsg || "微信登录失败");
  }

  return result;
}

function appendAccessToken(apiUrl, accessToken) {
  if (apiUrl.includes("ACCESS_TOKEN")) {
    return apiUrl.replace("ACCESS_TOKEN", encodeURIComponent(accessToken));
  }

  const url = new URL(apiUrl);
  if (!url.searchParams.has("access_token")) {
    url.searchParams.set("access_token", accessToken);
  }

  return url.toString();
}

function pickPhoneNumber(result = {}) {
  const candidates = [
    result.phoneNumber,
    result.purePhoneNumber,
    result.phone,
    result.mobile,
    result.phone_number,
    result.phone_info?.phoneNumber,
    result.phone_info?.purePhoneNumber,
    result.phone_info?.phone,
    result.phone_info?.mobile,
    result.verifyInfo?.phoneNumber,
    result.verifyInfo?.purePhoneNumber,
    result.verifyInfo?.phone,
    result.verifyInfo?.mobile,
    result.verify_info?.phoneNumber,
    result.verify_info?.purePhoneNumber,
    result.verify_info?.phone,
    result.verify_info?.mobile
  ];

  for (const candidate of candidates) {
    const phone = String(candidate || "").replace(/\D/g, "");
    if (/^1\d{10}$/.test(phone)) {
      return phone;
    }
  }

  return "";
}

function pickOpenid(result = {}) {
  return (
    result.openid ||
    result.openId ||
    result.user_openid ||
    result.verifyInfo?.openid ||
    result.verify_info?.openid ||
    ""
  );
}

async function fetchPhoneOneClickInfo(code) {
  const accessToken = await fetchWechatAccessToken();
  const apiUrl = String(
    process.env.WECHAT_PHONE_ONE_CLICK_API_URL ||
      "https://api.weixin.qq.com/wxa/business/code2verifyinfo"
  ).trim();
  const url = appendAccessToken(apiUrl, accessToken);
  const result = await requestJsonPost(url, { code });

  if (result.errcode) {
    throw new Error(result.errmsg || "本机号码一键登录验证失败");
  }

  const phone = pickPhoneNumber(result);
  if (!phone) {
    throw new Error("微信一键登录未返回有效手机号");
  }

  return {
    raw: result,
    phone,
    openid: pickOpenid(result)
  };
}

module.exports = {
  fetchWechatSession,
  fetchPhoneOneClickInfo
};
