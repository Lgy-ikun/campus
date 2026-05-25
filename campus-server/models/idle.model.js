const { query } = require("./index");

function emptyToNull(value) {
  return value === undefined || value === null || value === "" ? null : value;
}

async function create(data) {
  const result = await query(
    "INSERT INTO idle_goods (user_id, title, price, description, images, contact_info, trade_address, trade_latitude, trade_longitude, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      data.user_id,
      data.title,
      data.price,
      data.description || "",
      data.images || "",
      data.contact_info || "",
      data.trade_address || "",
      emptyToNull(data.trade_latitude),
      emptyToNull(data.trade_longitude),
      data.status || 0
    ]
  );

  return findById(result.insertId);
}

async function findById(goodsId) {
  const rows = await query(
    `
      SELECT g.*, u.nickname, u.avatar
      FROM idle_goods g
      LEFT JOIN \`user\` u ON u.user_id = g.user_id
      WHERE g.goods_id = ?
      LIMIT 1
    `,
    [goodsId]
  );

  return rows[0] || null;
}

async function list(filters, pagination, includePending = false) {
  const where = [];
  const params = [];

  if (!includePending) {
    where.push("g.status = 1");
  } else if (filters.status !== undefined && filters.status !== "") {
    where.push("g.status = ?");
    params.push(Number(filters.status));
  }

  if (filters.keyword) {
    where.push("(g.title LIKE ? OR g.description LIKE ?)");
    params.push(`%${filters.keyword}%`, `%${filters.keyword}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const countRows = await query(
    `
      SELECT COUNT(*) AS total
      FROM idle_goods g
      ${whereSql}
    `,
    params
  );
  const total = Number(countRows[0]?.total || 0);

  const rows = await query(
    `
      SELECT g.*, u.nickname, u.avatar
      FROM idle_goods g
      LEFT JOIN \`user\` u ON u.user_id = g.user_id
      ${whereSql}
      ORDER BY g.goods_id DESC
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
      SELECT *
      FROM idle_goods
      WHERE user_id = ?
      ORDER BY goods_id DESC
    `,
    [userId]
  );
}

async function updateStatus(goodsId, status, rejectReason = "") {
  const result = await query(
    "UPDATE idle_goods SET status = ?, reject_reason = ? WHERE goods_id = ?",
    [status, rejectReason, goodsId]
  );
  return result.affectedRows > 0;
}

async function updateForResubmit(goodsId, userId, data) {
  const result = await query(
    `
      UPDATE idle_goods
      SET title = ?,
          price = ?,
          description = ?,
          images = ?,
          contact_info = ?,
          trade_address = ?,
          trade_latitude = ?,
          trade_longitude = ?,
          status = 0,
          reject_reason = ''
      WHERE goods_id = ? AND user_id = ?
    `,
    [
      data.title,
      data.price,
      data.description || "",
      data.images || "",
      data.contact_info || "",
      data.trade_address || "",
      emptyToNull(data.trade_latitude),
      emptyToNull(data.trade_longitude),
      goodsId,
      userId
    ]
  );

  return result.affectedRows > 0;
}

async function downByOwner(goodsId, userId) {
  const result = await query(
    "UPDATE idle_goods SET status = 3, reject_reason = '用户主动下架' WHERE goods_id = ? AND user_id = ? AND status = 1",
    [goodsId, userId]
  );
  return result.affectedRows > 0;
}

async function deleteById(goodsId) {
  const result = await query("DELETE FROM idle_goods WHERE goods_id = ?", [goodsId]);
  return result.affectedRows > 0;
}

async function countPending() {
  const rows = await query("SELECT COUNT(*) AS total FROM idle_goods WHERE status = 0");
  return Number(rows[0]?.total || 0);
}

module.exports = {
  create,
  findById,
  list,
  myList,
  updateStatus,
  updateForResubmit,
  downByOwner,
  deleteById,
  countPending
};
