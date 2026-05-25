const noticeModel = require("../models/notice.model");

function normalizeReceiverRole(role) {
  if (role === "admin") {
    return "admin";
  }

  return "user";
}

function serializeExtra(extra) {
  if (!extra) {
    return "";
  }

  return JSON.stringify(extra);
}

async function createSystemNotice(payload) {
  const receiverId = Number(payload.receiverId || 0);
  if (!receiverId || !payload.title || !payload.content) {
    return null;
  }

  return noticeModel.create({
    receiver_id: receiverId,
    receiver_role: normalizeReceiverRole(payload.receiverRole),
    title: payload.title,
    content: payload.content,
    notice_type: payload.noticeType || "system",
    related_type: payload.relatedType || "",
    related_id: Number(payload.relatedId || 0),
    extra_json: serializeExtra(payload.extra)
  });
}

async function safeCreateSystemNotice(payload) {
  try {
    return await createSystemNotice(payload);
  } catch (error) {
    console.error("Failed to create system notice", error);
    return null;
  }
}

module.exports = {
  normalizeReceiverRole,
  createSystemNotice,
  safeCreateSystemNotice
};
