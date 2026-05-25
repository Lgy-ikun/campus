const { query } = require("./index");

async function create(data) {
  const result = await query(
    `
      INSERT INTO login_sms_code (phone, scene, code, expire_time, send_channel, send_result)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      data.phone,
      data.scene || "login",
      data.code,
      data.expire_time,
      data.send_channel || "mock",
      data.send_result || ""
    ]
  );

  return result.insertId;
}

async function findLatest(phone, scene = "login") {
  const rows = await query(
    `
      SELECT *
      FROM login_sms_code
      WHERE phone = ? AND scene = ?
      ORDER BY sms_id DESC
      LIMIT 1
    `,
    [phone, scene]
  );

  return rows[0] || null;
}

async function findLatestValid(phone, scene = "login") {
  const rows = await query(
    `
      SELECT *
      FROM login_sms_code
      WHERE phone = ? AND scene = ? AND is_used = 0 AND expire_time > NOW()
      ORDER BY sms_id DESC
      LIMIT 1
    `,
    [phone, scene]
  );

  return rows[0] || null;
}

async function markUsed(smsId) {
  const result = await query(
    "UPDATE login_sms_code SET is_used = 1, used_time = NOW() WHERE sms_id = ?",
    [smsId]
  );

  return result.affectedRows > 0;
}

module.exports = {
  create,
  findLatest,
  findLatestValid,
  markUsed
};
