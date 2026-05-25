const { query } = require("./index");

function buildUserSelectSql(includePassword = false) {
  const fields = [
    "user_id",
    "openid",
    "student_id",
    "nickname",
    "avatar",
    "phone",
    "status",
    "create_time",
    "update_time"
  ];

  if (includePassword) {
    fields.splice(6, 0, "password");
  }

  return fields.join(", ");
}

async function findByOpenid(openid) {
  const rows = await query(
    `SELECT ${buildUserSelectSql(true)} FROM \`user\` WHERE openid = ? LIMIT 1`,
    [openid]
  );

  return rows[0] || null;
}

async function findByPhone(phone) {
  const rows = await query(
    `SELECT ${buildUserSelectSql(true)} FROM \`user\` WHERE phone = ? LIMIT 1`,
    [phone]
  );

  return rows[0] || null;
}

async function findByStudentId(studentId) {
  const rows = await query(
    `SELECT ${buildUserSelectSql(false)} FROM \`user\` WHERE student_id = ? LIMIT 1`,
    [studentId]
  );

  return rows[0] || null;
}

async function findById(userId) {
  const rows = await query(
    `SELECT ${buildUserSelectSql(false)} FROM \`user\` WHERE user_id = ? LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function create(data) {
  const result = await query(
    `
      INSERT INTO \`user\` (openid, student_id, nickname, avatar, phone, password, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.openid,
      data.student_id || null,
      data.nickname,
      data.avatar || "",
      data.phone || "",
      data.password || "",
      data.status || 1
    ]
  );

  return findById(result.insertId);
}

async function list(filters, pagination) {
  const where = [];
  const params = [];

  if (filters.keyword) {
    where.push("(nickname LIKE ? OR phone LIKE ? OR student_id LIKE ?)");
    params.push(`%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`);
  }

  if (filters.status !== undefined && filters.status !== "") {
    where.push("status = ?");
    params.push(Number(filters.status));
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const countRows = await query(
    `SELECT COUNT(*) AS total FROM \`user\` ${whereSql}`,
    params
  );
  const total = Number(countRows[0]?.total || 0);

  const rows = await query(
    `
      SELECT ${buildUserSelectSql(false)}
      FROM \`user\`
      ${whereSql}
      ORDER BY user_id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, pagination.pageSize, pagination.offset]
  );

  return {
    list: rows,
    total
  };
}

async function update(userId, data) {
  const fields = [];
  const params = [];

  Object.entries(data).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    params.push(value);
  });

  if (!fields.length) {
    return false;
  }

  const result = await query(
    `UPDATE \`user\` SET ${fields.join(", ")} WHERE user_id = ?`,
    [...params, userId]
  );

  return result.affectedRows > 0;
}

async function updateStatus(userId, status) {
  const result = await query(
    "UPDATE `user` SET status = ? WHERE user_id = ?",
    [Number(status), userId]
  );

  return result.affectedRows > 0;
}

async function updatePassword(userId, password) {
  const result = await query(
    "UPDATE `user` SET password = ? WHERE user_id = ?",
    [password, userId]
  );

  return result.affectedRows > 0;
}

async function countAll() {
  const rows = await query("SELECT COUNT(*) AS total FROM `user`");
  return Number(rows[0]?.total || 0);
}

module.exports = {
  findByOpenid,
  findByPhone,
  findByStudentId,
  findById,
  create,
  list,
  update,
  updateStatus,
  updatePassword,
  countAll
};
