const { query } = require("./index");

async function findByUsername(username) {
  const rows = await query(
    "SELECT admin_id, username, password, real_name, phone, status, create_time, update_time FROM admin WHERE username = ? LIMIT 1",
    [username]
  );

  return rows[0] || null;
}

async function findById(adminId) {
  const rows = await query(
    "SELECT admin_id, username, real_name, phone, status, create_time, update_time FROM admin WHERE admin_id = ? LIMIT 1",
    [adminId]
  );

  return rows[0] || null;
}

async function update(adminId, data) {
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
    `UPDATE admin SET ${fields.join(", ")} WHERE admin_id = ?`,
    [...params, adminId]
  );

  return result.affectedRows > 0;
}

async function updatePassword(adminId, password) {
  const result = await query("UPDATE admin SET password = ? WHERE admin_id = ?", [
    password,
    adminId
  ]);
  return result.affectedRows > 0;
}

module.exports = {
  findByUsername,
  findById,
  update,
  updatePassword
};