function normalizePhone(phone) {
  return String(phone || "").trim();
}

function buildMockMessage(phone, code) {
  return `SMS mock send to ${phone}: code=${code}`;
}

async function sendSmsCode({ phone, code }) {
  const normalizedPhone = normalizePhone(phone);
  const provider = String(process.env.SMS_PROVIDER || "mock").trim().toLowerCase();
  const enableMock = String(process.env.SMS_ENABLE_MOCK || "true") === "true";

  if (!normalizedPhone || !code) {
    throw new Error("短信发送参数不完整");
  }

  if (provider === "mock" || enableMock) {
    const message = buildMockMessage(normalizedPhone, code);
    console.log(message);
    return {
      channel: "mock",
      resultText: message
    };
  }

  const url = String(process.env.SMS_API_URL || "").trim();
  if (!url) {
    throw new Error("未配置 SMS_API_URL，无法发送短信验证码");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.SMS_API_KEY
        ? { Authorization: `Bearer ${process.env.SMS_API_KEY}` }
        : {})
    },
    body: JSON.stringify({
      phone: normalizedPhone,
      code,
      signName: process.env.SMS_SIGN_NAME || "",
      templateId: process.env.SMS_TEMPLATE_ID || "",
      apiSecret: process.env.SMS_API_SECRET || ""
    })
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || "短信发送失败");
  }

  return {
    channel: provider || "http",
    resultText: text
  };
}

module.exports = {
  sendSmsCode
};
