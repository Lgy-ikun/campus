const { pool } = require("../config/db");

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function getConnection() {
  return pool.getConnection();
}

module.exports = {
  query,
  getConnection
};
