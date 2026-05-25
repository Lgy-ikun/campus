const adminModel = require("../models/admin.model");
const userModel = require("../models/user.model");
const smsCodeModel = require("../models/sms-code.model");
const { comparePassword, hashPassword } = require("../utils/password");
const { signToken } = require("../utils/jwt");
const { success, failure } = require("../utils/response");
const { sendSmsCode } = require("../services/sms.service");
const { fetchWechatSession, fetchPhoneOneClickInfo } = require("../services/wechat.service");
const { DISABLED_USER_MESSAGE, DISABLED_ADMIN_MESSAGE } = require("../utils/account-status");

const INTERNAL_CODE_LETTERS = "abcdefghijklmnopqrstuvwxyz";

function buildTokenPayload(role, profile) {
  if (role === "admin") {
    return {
      role,
      id: profile.admin_id
    };
  }

  return {
    role: "user",
    id: profile.user_id
  };
}

function normalizeUserProfile(profile) {
  if (!profile) {
    return null;
  }

  const { password, openid, ...userInfo } = profile;
  return {
    ...userInfo,
    internal_code: userInfo.student_id || ""
  };
}

function isValidPhone(phone) {
  return /^1\d{10}$/.test(String(phone || "").trim());
}

function generateSmsCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function buildSyntheticOpenidByPhone(phone) {
  return `phone_${phone}`;
}

function generateInternalCode() {
  let code = "";

  for (let index = 0; index < 5; index += 1) {
    const randomIndex = Math.floor(Math.random() * INTERNAL_CODE_LETTERS.length);
    code += INTERNAL_CODE_LETTERS[randomIndex];
  }

  code += Math.floor(Math.random() * 10);
  return code;
}

async function allocateInternalCode() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = generateInternalCode();
    const existing = await userModel.findByStudentId(candidate);

    if (!existing) {
      return candidate;
    }
  }

  throw new Error("生成用户内部编号失败，请稍后重试");
}

async function ensureInternalCode(profile) {
  const currentCode = String(profile?.student_id || "").trim();

  if (currentCode) {
    return profile;
  }

  const nextCode = await allocateInternalCode();
  await userModel.update(profile.user_id, {
    student_id: nextCode
  });

  return userModel.findById(profile.user_id);
}

async function getCurrentProfile(role, id) {
  if (role === "admin") {
    const admin = await adminModel.findById(id);
    return admin ? { role, profile: admin } : null;
  }

  const user = await userModel.findById(id);
  return user ? { role: "user", profile: user } : null;
}

async function sendLoginSmsCode(req, res) {
  const phone = String(req.body.phone || "").trim();
  if (!isValidPhone(phone)) {
    return res.status(400).json(failure("请输入正确的手机号"));
  }

  const latestCode = await smsCodeModel.findLatest(phone, "login");
  const resendIntervalSeconds = Number(process.env.SMS_RESEND_INTERVAL_SECONDS || 60);

  if (latestCode?.create_time) {
    const latestTime = new Date(latestCode.create_time).getTime();
    if (!Number.isNaN(latestTime)) {
      const diffSeconds = Math.floor((Date.now() - latestTime) / 1000);
      if (diffSeconds < resendIntervalSeconds) {
        return res
          .status(400)
          .json(failure(`验证码发送过于频繁，请 ${resendIntervalSeconds - diffSeconds} 秒后再试`));
      }
    }
  }

  const code = generateSmsCode();
  const expireMinutes = Number(process.env.SMS_CODE_EXPIRE_MINUTES || 5);
  const expireTime = new Date(Date.now() + expireMinutes * 60 * 1000);
  const sendResult = await sendSmsCode({ phone, code });

  await smsCodeModel.create({
    phone,
    scene: "login",
    code,
    expire_time: expireTime,
    send_channel: sendResult.channel,
    send_result: sendResult.resultText
  });

  return res.json(
    success(
      {
        expireMinutes,
        resendIntervalSeconds,
        mockCode: String(process.env.SMS_ENABLE_MOCK || "true") === "true" ? code : ""
      },
      "验证码发送成功"
    )
  );
}

async function phoneLogin(req, res) {
  const phone = String(req.body.phone || "").trim();
  const code = String(req.body.code || "").trim();

  if (!isValidPhone(phone) || !/^\d{6}$/.test(code)) {
    return res.status(400).json(failure("手机号或验证码格式不正确"));
  }

  const smsCode = await smsCodeModel.findLatestValid(phone, "login");
  if (!smsCode || String(smsCode.code) !== code) {
    return res.status(400).json(failure("验证码错误或已过期"));
  }

  await smsCodeModel.markUsed(smsCode.sms_id);

  let profile = await userModel.findByPhone(phone);
  if (!profile) {
    const password = await hashPassword(code);
    profile = await userModel.create({
      openid: buildSyntheticOpenidByPhone(phone),
      nickname: `手机用户${phone.slice(-4)}`,
      avatar: "",
      phone,
      password
    });
  }

  profile = await ensureInternalCode(profile);

  if (!profile || Number(profile.status) !== 1) {
    return res.status(403).json(failure(DISABLED_USER_MESSAGE, 403));
  }

  const token = signToken(buildTokenPayload("user", profile));
  return res.json(
    success(
      {
        token,
        role: "user",
        userInfo: normalizeUserProfile(profile)
      },
      "登录成功"
    )
  );
}

async function phoneOneClickLogin(req, res) {
  const code = String(req.body.code || "").trim();

  if (!code) {
    return res.status(400).json(failure("本机号码一键登录 code 不能为空"));
  }

  const verifyInfo = await fetchPhoneOneClickInfo(code);
  const phone = verifyInfo.phone;

  if (!isValidPhone(phone)) {
    return res.status(400).json(failure("未获取到有效手机号"));
  }

  let profile = await userModel.findByPhone(phone);

  if (!profile && verifyInfo.openid) {
    profile = await userModel.findByOpenid(verifyInfo.openid);
  }

  if (!profile) {
    profile = await userModel.create({
      openid: verifyInfo.openid || buildSyntheticOpenidByPhone(phone),
      nickname: `手机用户${phone.slice(-4)}`,
      avatar: "",
      phone,
      password: ""
    });
  } else if (!profile.phone) {
    await userModel.update(profile.user_id, {
      phone
    });
    profile = await userModel.findById(profile.user_id);
  }

  profile = await ensureInternalCode(profile);

  if (!profile || Number(profile.status) !== 1) {
    return res.status(403).json(failure(DISABLED_USER_MESSAGE, 403));
  }

  const token = signToken(buildTokenPayload("user", profile));
  return res.json(
    success(
      {
        token,
        role: "user",
        userInfo: normalizeUserProfile(profile)
      },
      "登录成功"
    )
  );
}

async function wxLogin(req, res) {
  const code = String(req.body.code || "").trim();
  const nickname = String(req.body.nickname || "").trim();
  const avatar = String(req.body.avatar || "").trim();

  if (!code) {
    return res.status(400).json(failure("微信登录 code 不能为空"));
  }

  const sessionData = await fetchWechatSession(code);

  let profile = await userModel.findByOpenid(sessionData.openid);
  if (!profile) {
    profile = await userModel.create({
      openid: sessionData.openid,
      nickname: nickname || `微信用户${sessionData.openid.slice(-4)}`,
      avatar,
      password: "",
      phone: ""
    });
  }

  profile = await ensureInternalCode(profile);

  if (!profile || Number(profile.status) !== 1) {
    return res.status(403).json(failure(DISABLED_USER_MESSAGE, 403));
  }

  const token = signToken(buildTokenPayload("user", profile));
  return res.json(
    success(
      {
        token,
        role: "user",
        userInfo: normalizeUserProfile(profile)
      },
      "登录成功"
    )
  );
}

async function adminLogin(req, res) {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!username || !password) {
    return res.status(400).json(failure("账号和密码不能为空"));
  }

  const admin = await adminModel.findByUsername(username);
  if (!admin) {
    return res.status(400).json(failure("账号或密码错误"));
  }

  if (Number(admin.status) !== 1) {
    return res.status(403).json(failure(DISABLED_ADMIN_MESSAGE, 403));
  }

  const matched = await comparePassword(password, admin.password);
  if (!matched) {
    return res.status(400).json(failure("账号或密码错误"));
  }

  const token = signToken(buildTokenPayload("admin", admin));
  const { password: _, ...adminInfo } = admin;

  return res.json(
    success(
      {
        token,
        role: "admin",
        userInfo: adminInfo
      },
      "登录成功"
    )
  );
}

async function updatePassword(req, res) {
  const oldPassword = String(req.body.oldPassword || "");
  const newPassword = String(req.body.newPassword || "");

  if (!newPassword) {
    return res.status(400).json(failure("新密码不能为空"));
  }

  const current = await getCurrentProfile(req.user.role, req.user.id);
  if (!current) {
    return res.status(404).json(failure("用户不存在", 404));
  }

  let currentPassword = "";

  if (current.role === "admin") {
    const admin = await adminModel.findByUsername(current.profile.username);
    currentPassword = admin?.password || "";
  } else if (current.profile.phone) {
    const user = await userModel.findByPhone(current.profile.phone);
    currentPassword = user?.password || "";
  } else {
    const user = await userModel.findByOpenid(current.profile.openid);
    currentPassword = user?.password || "";
  }

  if (currentPassword) {
    const matched = await comparePassword(oldPassword, currentPassword);
    if (!matched) {
      return res.status(400).json(failure("原密码错误"));
    }
  }

  const password = await hashPassword(newPassword);

  if (req.user.role === "admin") {
    await adminModel.updatePassword(req.user.id, password);
  } else {
    await userModel.updatePassword(req.user.id, password);
  }

  return res.json(success(null, "密码修改成功"));
}

async function userInfo(req, res) {
  const result = await getCurrentProfile(req.user.role, req.user.id);
  if (!result) {
    return res.status(404).json(failure("用户不存在", 404));
  }

  return res.json(
    success({
      role: result.role,
      userInfo: normalizeUserProfile(result.profile)
    })
  );
}

module.exports = {
  sendLoginSmsCode,
  phoneLogin,
  phoneOneClickLogin,
  wxLogin,
  adminLogin,
  updatePassword,
  userInfo
};
