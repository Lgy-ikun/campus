const { query } = require("./index");

async function findById(noticeId, receiverId, receiverRole) {
  const params = [noticeId];
  let whereSql = "notice_id = ?";

  if (receiverId && receiverRole) {
    whereSql += " AND receiver_id = ? AND receiver_role = ?";
    params.push(receiverId, receiverRole);
  }

  const rows = await query(
    `
      SELECT *
      FROM system_notice
      WHERE ${whereSql}
      LIMIT 1
    `,
    params
  );

  return rows[0] || null;
}

async function create(data) {
  const result = await query(
    `
      INSERT INTO system_notice
      (receiver_id, receiver_role, title, content, notice_type, related_type, related_id, extra_json, is_read)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `,
    [
      data.receiver_id,
      data.receiver_role,
      data.title,
      data.content,
      data.notice_type || "system",
      data.related_type || "",
      Number(data.related_id || 0),
      data.extra_json || ""
    ]
  );

  return findById(result.insertId);
}

async function listByReceiver({ receiverId, receiverRole, isRead }, pagination) {
  const where = ["receiver_id = ?", "receiver_role = ?"];
  const params = [receiverId, receiverRole];

  if (isRead !== undefined) {
    where.push("is_read = ?");
    params.push(Number(isRead));
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const countRows = await query(
    `
      SELECT COUNT(*) AS total
      FROM system_notice
      ${whereSql}
    `,
    params
  );
  const total = countRows[0]?.total || 0;

  const rows = await query(
    `
      SELECT *
      FROM system_notice
      ${whereSql}
      ORDER BY is_read ASC, notice_id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, pagination.pageSize, pagination.offset]
  );

  return {
    list: rows,
    total
  };
}

async function unreadCount(receiverId, receiverRole) {
  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM system_notice
      WHERE receiver_id = ?
        AND receiver_role = ?
        AND is_read = 0
    `,
    [receiverId, receiverRole]
  );

  return rows[0]?.total || 0;
}

async function markRead(noticeId, receiverId, receiverRole) {
  const current = await findById(noticeId, receiverId, receiverRole);
  if (!current) {
    return null;
  }

  await query(
    `
      UPDATE system_notice
      SET is_read = 1,
          read_time = IFNULL(read_time, CURRENT_TIMESTAMP)
      WHERE notice_id = ?
    `,
    [noticeId]
  );

  return findById(noticeId, receiverId, receiverRole);
}

async function markAllRead(receiverId, receiverRole) {
  const result = await query(
    `
      UPDATE system_notice
      SET is_read = 1,
          read_time = IFNULL(read_time, CURRENT_TIMESTAMP)
      WHERE receiver_id = ?
        AND receiver_role = ?
        AND is_read = 0
    `,
    [receiverId, receiverRole]
  );

  return result.affectedRows || 0;
}

module.exports = {
  findById,
  create,
  listByReceiver,
  unreadCount,
  markRead,
  markAllRead
};
