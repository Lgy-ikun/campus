const { query } = require("./index");

async function create(data) {
  const result = await query(
    `
      INSERT INTO errand_order
      (publisher_id, receiver_id, title, description, pick_address, pick_latitude, pick_longitude, deliver_address, deliver_latitude, deliver_longitude, reward, images, contact_info, expect_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.publisher_id,
      data.receiver_id || null,
      data.title,
      data.description || "",
      data.pick_address,
      data.pick_latitude,
      data.pick_longitude,
      data.deliver_address,
      data.deliver_latitude,
      data.deliver_longitude,
      data.reward,
      data.images || "",
      data.contact_info,
      data.expect_time || "",
      data.status || 0
    ]
  );

  return findById(result.insertId);
}

async function findById(orderId) {
  const rows = await query(
    `
      SELECT e.*,
             publisher.nickname AS publisher_name,
             receiver.nickname AS receiver_name
      FROM errand_order e
      LEFT JOIN \`user\` publisher ON publisher.user_id = e.publisher_id
      LEFT JOIN \`user\` receiver ON receiver.user_id = e.receiver_id
      WHERE e.order_id = ?
      LIMIT 1
    `,
    [orderId]
  );

  return rows[0] || null;
}

async function list(filters, pagination, includePending = false) {
  const where = [];
  const params = [];

  if (!includePending) {
    where.push("e.status = 1");
  } else if (filters.status !== undefined && filters.status !== "") {
    where.push("e.status = ?");
    params.push(Number(filters.status));
  }

  if (filters.keyword) {
    where.push("(e.title LIKE ? OR e.description LIKE ?)");
    params.push(`%${filters.keyword}%`, `%${filters.keyword}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const countRows = await query(
    `
      SELECT COUNT(*) AS total
      FROM errand_order e
      ${whereSql}
    `,
    params
  );
  const total = Number(countRows[0]?.total || 0);

  const rows = await query(
    `
      SELECT e.*,
             publisher.nickname AS publisher_name,
             receiver.nickname AS receiver_name
      FROM errand_order e
      LEFT JOIN \`user\` publisher ON publisher.user_id = e.publisher_id
      LEFT JOIN \`user\` receiver ON receiver.user_id = e.receiver_id
      ${whereSql}
      ORDER BY e.order_id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, pagination.pageSize, pagination.offset]
  );

  return {
    list: rows,
    total
  };
}

async function myList(userId) {
  return query(
    `
      SELECT e.*,
             publisher.nickname AS publisher_name,
             receiver.nickname AS receiver_name
      FROM errand_order e
      LEFT JOIN \`user\` publisher ON publisher.user_id = e.publisher_id
      LEFT JOIN \`user\` receiver ON receiver.user_id = e.receiver_id
      WHERE e.publisher_id = ? OR e.receiver_id = ?
      ORDER BY e.order_id DESC
    `,
    [userId, userId]
  );
}

async function receive(orderId, receiverId) {
  const result = await query(
    `
      UPDATE errand_order
      SET receiver_id = ?, status = 2
      WHERE order_id = ? AND receiver_id IS NULL AND status = 1
    `,
    [receiverId, orderId]
  );
  return result.affectedRows > 0;
}

async function release(orderId, publisherId) {
  const result = await query(
    `
      UPDATE errand_order
      SET receiver_id = NULL,
          status = 1,
          finish_time = NULL
      WHERE order_id = ? AND publisher_id = ? AND receiver_id IS NOT NULL AND status = 2
    `,
    [orderId, publisherId]
  );
  return result.affectedRows > 0;
}

async function cancelByPublisher(orderId, publisherId) {
  const result = await query(
    `
      UPDATE errand_order
      SET receiver_id = NULL,
          status = 5,
          finish_time = NULL,
          reject_reason = '用户主动取消'
      WHERE order_id = ?
        AND publisher_id = ?
        AND receiver_id IS NULL
        AND status IN (0, 1, 6, 7)
    `,
    [orderId, publisherId]
  );
  return result.affectedRows > 0;
}

async function updateStatus(orderId, status, extra = {}) {
  const fields = ["status = ?"];
  const params = [status];

  if (extra.reject_reason !== undefined) {
    fields.push("reject_reason = ?");
    params.push(extra.reject_reason);
  }

  if (extra.finish_time !== undefined) {
    fields.push("finish_time = ?");
    params.push(extra.finish_time);
  }

  if (extra.receiver_id !== undefined) {
    fields.push("receiver_id = ?");
    params.push(extra.receiver_id);
  }

  const result = await query(
    `UPDATE errand_order SET ${fields.join(", ")} WHERE order_id = ?`,
    [...params, orderId]
  );
  return result.affectedRows > 0;
}

async function updateForResubmit(orderId, userId, data) {
  const result = await query(
    `
      UPDATE errand_order
      SET title = ?,
          description = ?,
          pick_address = ?,
          pick_latitude = ?,
          pick_longitude = ?,
          deliver_address = ?,
          deliver_latitude = ?,
          deliver_longitude = ?,
          reward = ?,
          images = ?,
          contact_info = ?,
          expect_time = ?,
          receiver_id = NULL,
          finish_time = NULL,
          status = 0,
          reject_reason = ''
      WHERE order_id = ? AND publisher_id = ?
    `,
    [
      data.title,
      data.description || "",
      data.pick_address,
      data.pick_latitude,
      data.pick_longitude,
      data.deliver_address,
      data.deliver_latitude,
      data.deliver_longitude,
      data.reward,
      data.images || "",
      data.contact_info,
      data.expect_time || "",
      orderId,
      userId
    ]
  );

  return result.affectedRows > 0;
}

async function autoCompletePendingConfirm(timeoutHours = 24) {
  const parsedHours = Number(timeoutHours);
  const safeHours = Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : 24;
  const cutoff = new Date(Date.now() - safeHours * 60 * 60 * 1000);
  const result = await query(
    `
      UPDATE errand_order
      SET status = 4,
          finish_time = NOW()
      WHERE status = 3 AND update_time <= ?
    `,
    [cutoff]
  );

  return Number(result.affectedRows || 0);
}

async function countPending() {
  const rows = await query("SELECT COUNT(*) AS total FROM errand_order WHERE status = 0");
  return Number(rows[0]?.total || 0);
}

async function deleteById(orderId) {
  const result = await query("DELETE FROM errand_order WHERE order_id = ?", [orderId]);
  return result.affectedRows > 0;
}

module.exports = {
  create,
  findById,
  list,
  myList,
  receive,
  release,
  cancelByPublisher,
  updateStatus,
  updateForResubmit,
  autoCompletePendingConfirm,
  deleteById,
  countPending
};
