const { query } = require("./index");

async function upsert(data) {
  await query(
    `
      INSERT INTO content_report
      (business_type, business_id, report_count, latest_reason, latest_reporter_id, latest_report_time, is_handled, handle_admin_id, handle_note, handle_time)
      VALUES (?, ?, 1, ?, ?, NOW(), 0, NULL, '', NULL)
      ON DUPLICATE KEY UPDATE
        report_count = report_count + 1,
        latest_reason = VALUES(latest_reason),
        latest_reporter_id = VALUES(latest_reporter_id),
        latest_report_time = NOW(),
        is_handled = 0,
        handle_admin_id = NULL,
        handle_note = '',
        handle_time = NULL
    `,
    [
      data.business_type,
      data.business_id,
      data.latest_reason,
      data.latest_reporter_id
    ]
  );

  return findByBusiness(data.business_type, data.business_id);
}

async function findByBusiness(businessType, businessId) {
  const rows = await query(
    `
      SELECT *
      FROM content_report
      WHERE business_type = ? AND business_id = ?
      LIMIT 1
    `,
    [businessType, businessId]
  );

  return rows[0] || null;
}

async function markHandled({ businessType, businessId, adminId, handleNote }) {
  const result = await query(
    `
      UPDATE content_report
      SET is_handled = 1,
          handle_admin_id = ?,
          handle_note = ?,
          handle_time = NOW()
      WHERE business_type = ? AND business_id = ? AND is_handled = 0
    `,
    [adminId, handleNote || "", businessType, businessId]
  );

  return result.affectedRows > 0;
}

async function removeByBusiness(businessType, businessId) {
  const result = await query(
    "DELETE FROM content_report WHERE business_type = ? AND business_id = ?",
    [businessType, businessId]
  );

  return result.affectedRows > 0;
}

module.exports = {
  upsert,
  findByBusiness,
  markHandled,
  removeByBusiness
};
