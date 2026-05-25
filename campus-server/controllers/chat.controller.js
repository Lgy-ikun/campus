const chatModel = require("../models/chat.model");
const { success, failure } = require("../utils/response");

function getCurrentChatType() {
  return 1;
}

function hasBusinessContext(relatedType, relatedId) {
  return Boolean(String(relatedType || "").trim() && Number(relatedId || 0) > 0);
}

async function record(req, res) {
  const { targetId, targetType, relatedType, relatedId } = req.query;

  if (!targetId || !targetType) {
    return res.status(400).json(failure("targetId 和 targetType 不能为空"));
  }

  const rows = await chatModel.getRecords({
    currentId: req.user.id,
    currentType: getCurrentChatType(),
    targetId: Number(targetId),
    targetType: Number(targetType),
    relatedType,
    relatedId
  });

  return res.json(success(rows));
}

async function send(req, res) {
  const { receiver_id, receiver_type, content, message_type, related_type, related_id } = req.body;

  if (!receiver_id || !receiver_type || !content) {
    return res.status(400).json(failure("消息参数不完整"));
  }

  if (Number(receiver_id) === Number(req.user.id) && Number(receiver_type) === getCurrentChatType()) {
    return res.status(400).json(failure("不能给自己发送消息"));
  }

  if (["idle", "errand"].includes(String(related_type || "")) && !hasBusinessContext(related_type, related_id)) {
    return res.status(400).json(failure("业务会话缺少关联信息"));
  }

  const message = await chatModel.send({
    sender_id: req.user.id,
    sender_type: getCurrentChatType(),
    receiver_id,
    receiver_type,
    content,
    message_type,
    related_type,
    related_id
  });

  return res.json(success(message, "消息发送成功"));
}

async function unreadCount(req, res) {
  const list = await chatModel.getSessions(req.user.id, getCurrentChatType());
  const total = list.reduce((sum, item) => sum + Number(item.unread_count || 0), 0);

  return res.json(success({ unreadCount: total }));
}

async function sessionList(req, res) {
  const list = await chatModel.getSessions(req.user.id, getCurrentChatType());
  return res.json(success(list));
}

async function pin(req, res) {
  const { partnerId, partnerType, relatedType, relatedId, isPinned } = req.body;

  if (!partnerId || !partnerType) {
    return res.status(400).json(failure("partnerId 和 partnerType 不能为空"));
  }

  const result = await chatModel.setSessionPinned({
    ownerId: req.user.id,
    ownerType: getCurrentChatType(),
    partnerId: Number(partnerId),
    partnerType: Number(partnerType),
    relatedType,
    relatedId,
    isPinned
  });

  return res.json(success(result, Number(isPinned) ? "会话已置顶" : "会话已取消置顶"));
}

async function deleteSession(req, res) {
  const { partnerId, partnerType, relatedType, relatedId } = req.body;

  if (!partnerId || !partnerType) {
    return res.status(400).json(failure("partnerId 和 partnerType 不能为空"));
  }

  const result = await chatModel.deleteSession({
    ownerId: req.user.id,
    ownerType: getCurrentChatType(),
    partnerId: Number(partnerId),
    partnerType: Number(partnerType),
    relatedType,
    relatedId
  });

  return res.json(success(result, "会话已删除"));
}

async function read(req, res) {
  const { senderId, senderType, relatedType, relatedId } = req.body;

  if (!senderId || !senderType) {
    return res.status(400).json(failure("senderId 和 senderType 不能为空"));
  }

  const count = await chatModel.markRead({
    senderId: Number(senderId),
    senderType: Number(senderType),
    receiverId: req.user.id,
    receiverType: getCurrentChatType(),
    relatedType,
    relatedId
  });

  return res.json(success({ updated: count }, "消息已读状态更新成功"));
}

module.exports = {
  record,
  send,
  sessionList,
  pin,
  deleteSession,
  unreadCount,
  read
};
