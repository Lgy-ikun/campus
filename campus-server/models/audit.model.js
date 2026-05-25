const { query } = require("./index");

function buildSourceSql() {
  return `
    SELECT
      'idle' AS business_type,
      g.goods_id AS business_id,
      g.user_id AS publisher_id,
      u.nickname AS publisher_name,
      u.avatar AS publisher_avatar,
      NULL AS receiver_id,
      '' AS receiver_name,
      g.title,
      g.description,
      g.images,
      g.contact_info,
      g.status,
      g.reject_reason,
      g.create_time,
      g.update_time
    FROM idle_goods g
    LEFT JOIN \`user\` u ON u.user_id = g.user_id

    UNION ALL

    SELECT
      'errand' AS business_type,
      e.order_id AS business_id,
      e.publisher_id AS publisher_id,
      publisher.nickname AS publisher_name,
      publisher.avatar AS publisher_avatar,
      e.receiver_id AS receiver_id,
      receiver.nickname AS receiver_name,
      e.title,
      e.description,
      e.images,
      e.contact_info,
      e.status,
      e.reject_reason,
      e.create_time,
      e.update_time
    FROM errand_order e
    LEFT JOIN \`user\` publisher ON publisher.user_id = e.publisher_id
    LEFT JOIN \`user\` receiver ON receiver.user_id = e.receiver_id
  `;
}

function buildLatestLogSql() {
  return `
    SELECT
      log.audit_id,
      log.admin_id,
      log.business_type,
      log.business_id,
      log.audit_result,
      log.audit_reason,
      log.create_time,
      COALESCE(admin.real_name, admin.username, '') AS admin_name,
      admin.username AS admin_username
    FROM audit_log log
    INNER JOIN (
      SELECT business_type, business_id, MAX(audit_id) AS latest_audit_id
      FROM audit_log
      GROUP BY business_type, business_id
    ) latest
      ON latest.latest_audit_id = log.audit_id
    LEFT JOIN admin
      ON admin.admin_id = log.admin_id
  `;
}

function buildReportSql() {
  return `
    SELECT
      report_id,
      business_type,
      business_id,
      report_count,
      latest_reason,
      latest_reporter_id,
      latest_report_time,
      is_handled,
      handle_admin_id,
      handle_note,
      handle_time
    FROM content_report
  `;
}

function buildOperationTypeSql(sourceAlias = "source", logAlias = "audit") {
  return `
    CASE
      WHEN ${sourceAlias}.status = 0 THEN 'pending'
      WHEN ${logAlias}.audit_result = 4 THEN 'delete'
      WHEN ${logAlias}.audit_result = 3 THEN 'remove'
      WHEN ${logAlias}.audit_result = 2 THEN 'reject'
      WHEN ${logAlias}.audit_result = 1 THEN 'approve'
      WHEN ${sourceAlias}.business_type = 'idle' AND ${sourceAlias}.status = 2 THEN 'reject'
      WHEN ${sourceAlias}.business_type = 'idle' AND ${sourceAlias}.status = 3 THEN 'remove'
      WHEN ${sourceAlias}.business_type = 'idle' AND ${sourceAlias}.status IN (1, 4) THEN 'approve'
      WHEN ${sourceAlias}.business_type = 'errand' AND ${sourceAlias}.status = 6 THEN 'reject'
      WHEN ${sourceAlias}.business_type = 'errand' AND ${sourceAlias}.status = 7 THEN 'remove'
      WHEN ${sourceAlias}.business_type = 'errand' AND ${sourceAlias}.status IN (1, 2, 3, 4, 5) THEN 'approve'
      ELSE 'unknown'
    END
  `;
}

function buildContentBaseSql() {
  const sourceSql = buildSourceSql();
  const latestLogSql = buildLatestLogSql();
  const reportSql = buildReportSql();

  return `
    SELECT
      source.*,
      audit.audit_result AS latest_audit_result,
      audit.audit_reason AS latest_audit_reason,
      audit.create_time AS latest_audit_time,
      audit.admin_id AS latest_admin_id,
      audit.admin_name AS latest_admin_name,
      audit.admin_username AS latest_admin_username,
      ${buildOperationTypeSql()} AS operation_type,
      report.report_id,
      COALESCE(report.report_count, 0) AS report_count,
      report.latest_reason AS latest_report_reason,
      report.latest_reporter_id,
      report.latest_report_time,
      COALESCE(report.is_handled, 1) AS report_is_handled,
      CASE
        WHEN report.report_id IS NOT NULL AND COALESCE(report.is_handled, 0) = 0 THEN 1
        ELSE 0
      END AS is_reported
    FROM (${sourceSql}) source
    LEFT JOIN (${latestLogSql}) audit
      ON audit.business_type = source.business_type
      AND audit.business_id = source.business_id
    LEFT JOIN (${reportSql}) report
      ON report.business_type = source.business_type
      AND report.business_id = source.business_id
  `;
}

async function addLog(data) {
  const result = await query(
    `
      INSERT INTO audit_log (admin_id, business_type, business_id, audit_result, audit_reason)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      data.admin_id,
      data.business_type,
      data.business_id,
      data.audit_result,
      data.audit_reason || ""
    ]
  );

  return result.insertId;
}

async function listContents(filters, pagination) {
  const params = [];
  const conditions = [];

  if (filters.businessType) {
    conditions.push("content.business_type = ?");
    params.push(filters.businessType);
  }

  if (filters.keyword) {
    conditions.push(
      "(CAST(content.business_id AS CHAR) LIKE ? OR content.publisher_name LIKE ? OR content.title LIKE ?)"
    );
    params.push(`%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`);
  }

  if (filters.userId !== undefined && filters.userId !== "") {
    const parsedUserId = Number(filters.userId);
    if (!Number.isNaN(parsedUserId)) {
      conditions.push("content.publisher_id = ?");
      params.push(parsedUserId);
    }
  }

  if (filters.operationType) {
    conditions.push("content.operation_type = ?");
    params.push(filters.operationType);
  }

  if (String(filters.reportOnly || "") === "1" || String(filters.reportOnly || "").toLowerCase() === "true") {
    conditions.push("content.is_reported = 1");
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const baseSql = buildContentBaseSql();

  const countRows = await query(
    `
      SELECT COUNT(*) AS total
      FROM (${baseSql}) content
      ${whereSql}
    `,
    params
  );
  const total = Number(countRows[0]?.total || 0);

  const rows = await query(
    `
      SELECT *
      FROM (${baseSql}) content
      ${whereSql}
      ORDER BY content.is_reported DESC, content.latest_report_time DESC, content.create_time DESC, content.business_id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, pagination.pageSize, pagination.offset]
  );

  return {
    list: rows,
    total
  };
}

async function findLatestLog(businessType, businessId) {
  const rows = await query(
    `
      SELECT
        log.audit_id,
        log.admin_id,
        log.business_type,
        log.business_id,
        log.audit_result,
        log.audit_reason,
        log.create_time,
        COALESCE(admin.real_name, admin.username, '') AS admin_name,
        admin.username AS admin_username
      FROM audit_log log
      LEFT JOIN admin ON admin.admin_id = log.admin_id
      WHERE log.business_type = ? AND log.business_id = ?
      ORDER BY log.audit_id DESC
      LIMIT 1
    `,
    [businessType, businessId]
  );

  return rows[0] || null;
}

module.exports = {
  addLog,
  listContents,
  findLatestLog
};
