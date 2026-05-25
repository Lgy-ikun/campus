const { query } = require("./index");

function normalizeSessionIdentity({ relatedType, relatedId }) {
  return {
    relatedType: String(relatedType || "").trim(),
    relatedId: Number(relatedId || 0)
  };
}

async function getSessionPreference({
  ownerId,
  ownerType,
  partnerId,
  partnerType,
  relatedType,
  relatedId
}) {
  const identity = normalizeSessionIdentity({ relatedType, relatedId });
  const rows = await query(
    `
      SELECT *
      FROM chat_session_preference
      WHERE owner_id = ?
        AND owner_type = ?
        AND partner_id = ?
        AND partner_type = ?
        AND related_type = ?
        AND related_id = ?
      LIMIT 1
    `,
    [
      ownerId,
      ownerType,
      partnerId,
      partnerType,
      identity.relatedType,
      identity.relatedId
    ]
  );

  return rows[0] || null;
}

async function getRecords({
  currentId,
  currentType,
  targetId,
  targetType,
  relatedType,
  relatedId
}) {
  const identity = normalizeSessionIdentity({ relatedType, relatedId });
  const preference = await getSessionPreference({
    ownerId: currentId,
    ownerType: currentType,
    partnerId: targetId,
    partnerType: targetType,
    relatedType: identity.relatedType,
    relatedId: identity.relatedId
  });
  const hiddenBeforeMessageId = Number(preference?.hidden_before_message_id || 0);
  const params = [currentId, currentType, targetId, targetType, targetId, targetType, currentId, currentType];
  const conditions = [];

  if (identity.relatedType) {
    conditions.push("COALESCE(related_type, '') = ?");
    params.push(identity.relatedType);
    conditions.push("COALESCE(related_id, 0) = ?");
    params.push(identity.relatedId);
  } else {
    conditions.push("COALESCE(related_type, '') = ''");
    conditions.push("COALESCE(related_id, 0) = 0");
  }

  if (hiddenBeforeMessageId > 0) {
    conditions.push("message_id > ?");
    params.push(hiddenBeforeMessageId);
  }

  const whereRelated = conditions.length ? ` AND ${conditions.join(" AND ")}` : "";

  return query(
    `
      SELECT *
      FROM chat_message
      WHERE (
        (sender_id = ? AND sender_type = ? AND receiver_id = ? AND receiver_type = ?)
        OR
        (sender_id = ? AND sender_type = ? AND receiver_id = ? AND receiver_type = ?)
      )
      ${whereRelated}
      ORDER BY message_id ASC
    `,
    params
  );
}

async function send(data) {
  const identity = normalizeSessionIdentity({
    relatedType: data.related_type,
    relatedId: data.related_id
  });

  const result = await query(
    `
      INSERT INTO chat_message
      (sender_id, sender_type, receiver_id, receiver_type, content, message_type, is_read, related_type, related_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.sender_id,
      data.sender_type,
      data.receiver_id,
      data.receiver_type,
      data.content,
      data.message_type || 1,
      0,
      identity.relatedType,
      identity.relatedType ? identity.relatedId : null
    ]
  );

  const rows = await query("SELECT * FROM chat_message WHERE message_id = ? LIMIT 1", [
    result.insertId
  ]);

  return rows[0] || null;
}

async function unreadCount(receiverId, receiverType) {
  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM chat_message
      WHERE receiver_id = ? AND receiver_type = ? AND is_read = 0
    `,
    [receiverId, receiverType]
  );

  return rows[0]?.total || 0;
}

async function getSessions(currentId, currentType) {
  return query(
    `
      SELECT
        session.partner_id,
        session.partner_type,
        session.related_type,
        session.related_id,
        COALESCE(pref.is_pinned, 0) AS is_pinned,
        COALESCE(pref.hidden_before_message_id, 0) AS hidden_before_message_id,
        (
          SELECT COUNT(*)
          FROM chat_message unread_msg
          WHERE unread_msg.receiver_id = ?
            AND unread_msg.receiver_type = ?
            AND unread_msg.is_read = 0
            AND unread_msg.sender_id = session.partner_id
            AND unread_msg.sender_type = session.partner_type
            AND COALESCE(unread_msg.related_type, '') = session.related_type
            AND COALESCE(unread_msg.related_id, 0) = session.related_id
            AND unread_msg.message_id > COALESCE(pref.hidden_before_message_id, 0)
        ) AS unread_count,
        msg.content AS last_content,
        msg.message_type AS last_message_type,
        msg.create_time AS last_time,
        CASE
          WHEN session.partner_type = 1 THEN u.nickname
          ELSE '未知用户'
        END AS partner_name,
        CASE
          WHEN session.partner_type = 1 THEN u.avatar
          ELSE ''
        END AS partner_avatar
      FROM (
        SELECT
          CASE
            WHEN sender_id = ? AND sender_type = ? THEN receiver_id
            ELSE sender_id
          END AS partner_id,
          CASE
            WHEN sender_id = ? AND sender_type = ? THEN receiver_type
            ELSE sender_type
          END AS partner_type,
          COALESCE(related_type, '') AS related_type,
          COALESCE(related_id, 0) AS related_id,
          MAX(message_id) AS latest_message_id
        FROM chat_message
        WHERE (
          sender_id = ? AND sender_type = ?
        ) OR (
          receiver_id = ? AND receiver_type = ?
        )
        GROUP BY partner_id, partner_type, related_type, related_id
      ) session
      LEFT JOIN chat_session_preference pref
        ON pref.owner_id = ?
       AND pref.owner_type = ?
       AND pref.partner_id = session.partner_id
       AND pref.partner_type = session.partner_type
       AND pref.related_type = session.related_type
       AND pref.related_id = session.related_id
      LEFT JOIN chat_message msg ON msg.message_id = session.latest_message_id
      LEFT JOIN \`user\` u ON session.partner_type = 1 AND u.user_id = session.partner_id
      WHERE session.latest_message_id > COALESCE(pref.hidden_before_message_id, 0)
      ORDER BY COALESCE(pref.is_pinned, 0) DESC, msg.create_time DESC, msg.message_id DESC
    `,
    [
      currentId,
      currentType,
      currentId,
      currentType,
      currentId,
      currentType,
      currentId,
      currentType,
      currentId,
      currentType,
      currentId,
      currentType
    ]
  );
}

async function setSessionPinned({
  ownerId,
  ownerType,
  partnerId,
  partnerType,
  relatedType,
  relatedId,
  isPinned
}) {
  const identity = normalizeSessionIdentity({ relatedType, relatedId });
  const pinnedValue = Number(Boolean(isPinned));

  await query(
    `
      INSERT INTO chat_session_preference
      (owner_id, owner_type, partner_id, partner_type, related_type, related_id, is_pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        is_pinned = VALUES(is_pinned),
        update_time = CURRENT_TIMESTAMP
    `,
    [
      ownerId,
      ownerType,
      partnerId,
      partnerType,
      identity.relatedType,
      identity.relatedId,
      pinnedValue
    ]
  );

  return {
    owner_id: ownerId,
    owner_type: ownerType,
    partner_id: partnerId,
    partner_type: partnerType,
    related_type: identity.relatedType,
    related_id: identity.relatedId,
    is_pinned: pinnedValue
  };
}

async function deleteSession({
  ownerId,
  ownerType,
  partnerId,
  partnerType,
  relatedType,
  relatedId
}) {
  const identity = normalizeSessionIdentity({ relatedType, relatedId });
  const latestRows = await query(
    `
      SELECT MAX(message_id) AS latest_message_id
      FROM chat_message
      WHERE (
        (sender_id = ? AND sender_type = ? AND receiver_id = ? AND receiver_type = ?)
        OR
        (sender_id = ? AND sender_type = ? AND receiver_id = ? AND receiver_type = ?)
      )
      AND COALESCE(related_type, '') = ?
      AND COALESCE(related_id, 0) = ?
    `,
    [
      ownerId,
      ownerType,
      partnerId,
      partnerType,
      partnerId,
      partnerType,
      ownerId,
      ownerType,
      identity.relatedType,
      identity.relatedId
    ]
  );
  const latestMessageId = Number(latestRows[0]?.latest_message_id || 0);

  await query(
    `
      INSERT INTO chat_session_preference
      (owner_id, owner_type, partner_id, partner_type, related_type, related_id, is_pinned, hidden_before_message_id)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      ON DUPLICATE KEY UPDATE
        is_pinned = 0,
        hidden_before_message_id = VALUES(hidden_before_message_id),
        update_time = CURRENT_TIMESTAMP
    `,
    [
      ownerId,
      ownerType,
      partnerId,
      partnerType,
      identity.relatedType,
      identity.relatedId,
      latestMessageId
    ]
  );

  return {
    owner_id: ownerId,
    owner_type: ownerType,
    partner_id: partnerId,
    partner_type: partnerType,
    related_type: identity.relatedType,
    related_id: identity.relatedId,
    hidden_before_message_id: latestMessageId
  };
}

async function markRead({
  senderId,
  senderType,
  receiverId,
  receiverType,
  relatedType,
  relatedId
}) {
  const identity = normalizeSessionIdentity({ relatedType, relatedId });
  const result = await query(
    `
      UPDATE chat_message
      SET is_read = 1
      WHERE sender_id = ? AND sender_type = ? AND receiver_id = ? AND receiver_type = ?
        AND COALESCE(related_type, '') = ?
        AND COALESCE(related_id, 0) = ?
    `,
    [
      senderId,
      senderType,
      receiverId,
      receiverType,
      identity.relatedType,
      identity.relatedId
    ]
  );

  return result.affectedRows;
}

module.exports = {
  getRecords,
  send,
  getSessions,
  deleteSession,
  setSessionPinned,
  unreadCount,
  markRead
};
