const { query } = require("./index");

const GRANULARITY_CONFIG = {
  day: {
    unit: "day",
    count: 1
  },
  week: {
    unit: "day",
    count: 7
  },
  month: {
    unit: "day",
    count: 0
  },
  year: {
    unit: "month",
    count: 12
  }
};

function parseDateTime(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  const text = String(value).trim();
  const matched = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (matched) {
    const [, year, month, day, hour = "00", minute = "00", second = "00"] = matched;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cloneDate(date) {
  return new Date(date.getTime());
}

function startOfDay(date) {
  const target = cloneDate(date);
  target.setHours(0, 0, 0, 0);
  return target;
}

function startOfWeek(date) {
  const target = startOfDay(date);
  const day = target.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  target.setDate(target.getDate() + offset);
  return target;
}

function startOfMonth(date) {
  const target = startOfDay(date);
  target.setDate(1);
  return target;
}

function startOfYear(date) {
  const target = startOfDay(date);
  target.setMonth(0, 1);
  return target;
}

function addUnits(date, unit, amount) {
  const target = cloneDate(date);

  if (unit === "day") {
    target.setDate(target.getDate() + amount);
    return target;
  }

  if (unit === "week") {
    target.setDate(target.getDate() + amount * 7);
    return target;
  }

  if (unit === "month") {
    target.setMonth(target.getMonth() + amount);
    return target;
  }

  target.setFullYear(target.getFullYear() + amount);
  return target;
}

function startOfUnit(date, unit) {
  if (unit === "day") {
    return startOfDay(date);
  }

  if (unit === "week") {
    return startOfWeek(date);
  }

  if (unit === "month") {
    return startOfMonth(date);
  }

  return startOfYear(date);
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatMonthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function formatWeekLabel(startDate) {
  const endDate = addUnits(startDate, "day", 6);
  return `${startDate.getMonth() + 1}/${startDate.getDate()}-${endDate.getMonth() + 1}/${endDate.getDate()}`;
}

function formatBucketKey(date, unit) {
  if (unit === "day") {
    return formatDateKey(date);
  }

  if (unit === "week") {
    return formatDateKey(date);
  }

  if (unit === "month") {
    return formatMonthKey(date);
  }

  return String(date.getFullYear());
}

function formatBucketLabel(date, unit) {
  if (unit === "day") {
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  if (unit === "week") {
    return formatWeekLabel(date);
  }

  if (unit === "month") {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  return `${date.getFullYear()}年`;
}

function resolveTargetDate(value) {
  const date = parseDateTime(value);
  return date || new Date();
}

function createRangeLabel(granularity, targetDate, buckets) {
  if (granularity === "day") {
    return `${formatDateKey(startOfDay(targetDate))}`;
  }

  if (granularity === "week") {
    const start = buckets[0].start;
    const end = addUnits(buckets[buckets.length - 1].end, "day", -1);
    return `${formatDateKey(start)} 至 ${formatDateKey(end)}`;
  }

  if (granularity === "month") {
    return `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}`;
  }

  return `${targetDate.getFullYear()}年`;
}

function createBuckets(granularity, targetValue) {
  const config = GRANULARITY_CONFIG[granularity] || GRANULARITY_CONFIG.day;
  const targetDate = resolveTargetDate(targetValue);
  const bucketUnit = config.unit;
  const count = granularity === "month"
    ? new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate()
    : config.count;
  let firstBucketStart = startOfUnit(targetDate, bucketUnit);

  if (granularity === "week") {
    firstBucketStart = startOfWeek(targetDate);
  } else if (granularity === "month") {
    firstBucketStart = startOfMonth(targetDate);
  } else if (granularity === "year") {
    firstBucketStart = startOfYear(targetDate);
  }
  const buckets = [];

  for (let index = 0; index < count; index += 1) {
    const bucketStart = addUnits(firstBucketStart, bucketUnit, index);
    const bucketEnd = addUnits(bucketStart, bucketUnit, 1);

    buckets.push({
      key: formatBucketKey(bucketStart, bucketUnit),
      label: formatBucketLabel(bucketStart, bucketUnit),
      start: bucketStart,
      end: bucketEnd
    });
  }

  return {
    ...config,
    unit: bucketUnit,
    count,
    label: createRangeLabel(granularity, targetDate, buckets),
    targetDate: formatDateKey(startOfDay(targetDate)),
    start: buckets[0].start,
    end: buckets[buckets.length - 1].end,
    buckets
  };
}

function createNumberSeries(length) {
  return Array.from({ length }, () => 0);
}

function getBucketIndex(bucketIndexMap, dateValue, unit) {
  const date = parseDateTime(dateValue);
  if (!date) {
    return -1;
  }

  const key = formatBucketKey(startOfUnit(date, unit), unit);
  return bucketIndexMap.has(key) ? bucketIndexMap.get(key) : -1;
}

function createBacklogBucketConfig(range, rows) {
  const hasBeforeRange = rows.some((row) => {
    const date = parseDateTime(row.create_time);
    return date && date < range.start;
  });
  const hasAfterRange = rows.some((row) => {
    const date = parseDateTime(row.create_time);
    return date && date >= range.end;
  });
  const labels = [
    ...(hasBeforeRange ? ["\u65e9\u4e8e\u672c\u671f"] : []),
    ...range.buckets.map((bucket) => bucket.label),
    ...(hasAfterRange ? ["\u665a\u4e8e\u672c\u671f"] : [])
  ];

  return {
    hasBeforeRange,
    hasAfterRange,
    rangeOffset: hasBeforeRange ? 1 : 0,
    labels
  };
}

function getBacklogBucketIndex(bucketIndexMap, dateValue, range, config) {
  const date = parseDateTime(dateValue);
  if (!date) {
    return -1;
  }

  if (date < range.start) {
    return config.hasBeforeRange ? 0 : -1;
  }

  if (date >= range.end) {
    return config.hasAfterRange ? config.rangeOffset + range.buckets.length : -1;
  }

  const bucketIndex = getBucketIndex(bucketIndexMap, dateValue, range.unit);
  return bucketIndex === -1 ? -1 : bucketIndex + config.rangeOffset;
}

function summarizeCurrentBacklog(currentPendingRows, pendingReportRows) {
  return {
    idlePending: currentPendingRows.filter((row) => row.business_type === "idle").length,
    errandPending: currentPendingRows.filter((row) => row.business_type === "errand").length,
    reportPending: pendingReportRows.length
  };
}

async function queryContentRows(start, end) {
  return query(
    `
      SELECT 'idle' AS business_type, goods_id AS business_id, user_id AS publisher_id, status, create_time
      FROM idle_goods
      WHERE create_time >= ? AND create_time < ?

      UNION ALL

      SELECT 'errand' AS business_type, order_id AS business_id, publisher_id AS publisher_id, status, create_time
      FROM errand_order
      WHERE create_time >= ? AND create_time < ?
    `,
    [start, end, start, end]
  );
}

async function queryCurrentPendingContentRows() {
  return query(
    `
      SELECT 'idle' AS business_type, goods_id AS business_id, user_id AS publisher_id, status, create_time
      FROM idle_goods
      WHERE status = 0

      UNION ALL

      SELECT 'errand' AS business_type, order_id AS business_id, publisher_id AS publisher_id, status, create_time
      FROM errand_order
      WHERE status = 0
    `
  );
}

async function queryAuditRows(start, end) {
  return query(
    `
      SELECT business_type, business_id, audit_result, audit_reason, create_time
      FROM audit_log
      WHERE create_time >= ? AND create_time < ?
        AND business_type IN ('idle', 'errand', 'user')
    `,
    [start, end]
  );
}

async function queryIdleConsultRows(start, end) {
  return query(
    `
      SELECT related_id, sender_id, receiver_id, create_time
      FROM chat_message
      WHERE related_type = 'idle'
        AND COALESCE(related_id, 0) > 0
        AND create_time >= ? AND create_time < ?
    `,
    [start, end]
  );
}

async function queryErrandCompleteRows(start, end) {
  return query(
    `
      SELECT order_id, finish_time
      FROM errand_order
      WHERE status = 4
        AND finish_time IS NOT NULL
        AND finish_time >= ? AND finish_time < ?
    `,
    [start, end]
  );
}

async function queryPendingReportRows() {
  return query(
    `
      SELECT business_type,
             business_id,
             report_count,
             latest_reason,
             latest_report_time,
             latest_report_time AS create_time,
             is_handled
      FROM content_report
      WHERE is_handled = 0
        AND business_type IN ('idle', 'errand')
    `
  );
}

async function queryCurrentStatusSummary() {
  const bannedUserRows = await query("SELECT COUNT(*) AS total FROM `user` WHERE status <> 1");

  return {
    bannedUsers: Number(bannedUserRows[0]?.total || 0)
  };
}

async function getDashboardAnalytics(granularity = "day", targetDate = "") {
  const range = createBuckets(granularity, targetDate);
  const startText = `${formatDateKey(range.start)} 00:00:00`;
  const endText = `${formatDateKey(range.end)} 00:00:00`;
  const bucketIndexMap = new Map(range.buckets.map((bucket, index) => [bucket.key, index]));
  const bucketCount = range.buckets.length;

  const [contentRows, currentPendingRows, auditRows, idleConsultRows, errandCompleteRows, pendingReportRows, currentStatus] =
    await Promise.all([
      queryContentRows(startText, endText),
      queryCurrentPendingContentRows(),
      queryAuditRows(startText, endText),
      queryIdleConsultRows(startText, endText),
      queryErrandCompleteRows(startText, endText),
      queryPendingReportRows(),
      queryCurrentStatusSummary()
    ]);
  const backlogBucketConfig = createBacklogBucketConfig(range, [
    ...currentPendingRows,
    ...pendingReportRows
  ]);
  const currentBacklog = summarizeCurrentBacklog(currentPendingRows, pendingReportRows);

  const publishTrend = {
    labels: range.buckets.map((bucket) => bucket.label),
    idlePublished: createNumberSeries(bucketCount),
    errandPublished: createNumberSeries(bucketCount)
  };

  const pendingBacklog = {
    labels: backlogBucketConfig.labels,
    idlePending: createNumberSeries(backlogBucketConfig.labels.length),
    errandPending: createNumberSeries(backlogBucketConfig.labels.length),
    reportPending: createNumberSeries(backlogBucketConfig.labels.length)
  };

  const auditResult = {
    labels: range.buckets.map((bucket) => bucket.label),
    idleApprove: createNumberSeries(bucketCount),
    idleReject: createNumberSeries(bucketCount),
    idleRemove: createNumberSeries(bucketCount),
    errandApprove: createNumberSeries(bucketCount),
    errandReject: createNumberSeries(bucketCount),
    errandRemove: createNumberSeries(bucketCount)
  };

  const businessSummary = {
    idle: {
      published: 0,
      pendingCurrent: currentBacklog.idlePending,
      approved: 0,
      rejected: 0,
      removed: 0,
      violations: 0,
      consultations: 0
    },
    errand: {
      published: 0,
      pendingCurrent: currentBacklog.errandPending,
      approved: 0,
      rejected: 0,
      removed: 0,
      violations: 0,
      completed: 0
    }
  };

  const periodPublishUsers = new Set();
  const periodIdleConsultations = new Set();

  contentRows.forEach((row) => {
    const bucketIndex = getBucketIndex(bucketIndexMap, row.create_time, range.unit);
    const businessType = row.business_type;

    if (bucketIndex !== -1) {
      periodPublishUsers.add(String(row.publisher_id));

      if (businessSummary[businessType]) {
        businessSummary[businessType].published += 1;
      }

      if (businessType === "idle") {
        publishTrend.idlePublished[bucketIndex] += 1;
      } else if (businessType === "errand") {
        publishTrend.errandPublished[bucketIndex] += 1;
      }
    }
  });

  currentPendingRows.forEach((row) => {
    const bucketIndex = getBacklogBucketIndex(
      bucketIndexMap,
      row.create_time,
      range,
      backlogBucketConfig
    );
    if (bucketIndex === -1) {
      return;
    }

    if (row.business_type === "idle") {
      pendingBacklog.idlePending[bucketIndex] += 1;
    } else if (row.business_type === "errand") {
      pendingBacklog.errandPending[bucketIndex] += 1;
    }
  });

  auditRows.forEach((row) => {
    const bucketIndex = getBucketIndex(bucketIndexMap, row.create_time, range.unit);
    if (bucketIndex === -1) {
      return;
    }

    if (row.business_type === "user") {
      return;
    }

    const businessSummaryItem = businessSummary[row.business_type];
    if (!businessSummaryItem) {
      return;
    }

    if (row.business_type === "idle") {
      if (Number(row.audit_result) === 1) {
        auditResult.idleApprove[bucketIndex] += 1;
        businessSummaryItem.approved += 1;
      } else if (Number(row.audit_result) === 2) {
        auditResult.idleReject[bucketIndex] += 1;
        businessSummaryItem.rejected += 1;
        businessSummaryItem.violations += 1;
      } else if (Number(row.audit_result) === 3) {
        auditResult.idleRemove[bucketIndex] += 1;
        businessSummaryItem.removed += 1;
        businessSummaryItem.violations += 1;
      }
    }

    if (row.business_type === "errand") {
      if (Number(row.audit_result) === 1) {
        auditResult.errandApprove[bucketIndex] += 1;
        businessSummaryItem.approved += 1;
      } else if (Number(row.audit_result) === 2) {
        auditResult.errandReject[bucketIndex] += 1;
        businessSummaryItem.rejected += 1;
        businessSummaryItem.violations += 1;
      } else if (Number(row.audit_result) === 3) {
        auditResult.errandRemove[bucketIndex] += 1;
        businessSummaryItem.removed += 1;
        businessSummaryItem.violations += 1;
      }
    }
  });

  idleConsultRows.forEach((row) => {
    const bucketIndex = getBucketIndex(bucketIndexMap, row.create_time, range.unit);
    if (bucketIndex === -1) {
      return;
    }

    const leftId = Math.min(Number(row.sender_id), Number(row.receiver_id));
    const rightId = Math.max(Number(row.sender_id), Number(row.receiver_id));
    const consultationKey = `${row.related_id}:${leftId}:${rightId}`;

    periodIdleConsultations.add(consultationKey);
  });

  errandCompleteRows.forEach((row) => {
    const bucketIndex = getBucketIndex(bucketIndexMap, row.finish_time, range.unit);
    if (bucketIndex === -1) {
      return;
    }

    businessSummary.errand.completed += 1;
  });

  pendingReportRows.forEach((row) => {
    const bucketIndex = getBacklogBucketIndex(
      bucketIndexMap,
      row.create_time,
      range,
      backlogBucketConfig
    );
    if (bucketIndex === -1) {
      return;
    }

    pendingBacklog.reportPending[bucketIndex] += 1;
  });

  businessSummary.idle.consultations = periodIdleConsultations.size;

  const approvalTotal =
    businessSummary.idle.approved + businessSummary.errand.approved;
  const violationTotal =
    businessSummary.idle.violations + businessSummary.errand.violations;
  const userBanTotal = auditRows.filter(
    (row) => row.business_type === "user" && Number(row.audit_result) === 4
  ).length;
  const processedAuditTotal =
    approvalTotal +
    businessSummary.idle.rejected +
    businessSummary.idle.removed +
    businessSummary.errand.rejected +
    businessSummary.errand.removed;

  return {
    granularity,
    targetDate: range.targetDate,
    rangeLabel: range.label,
    labels: range.buckets.map((bucket) => bucket.label),
    summaries: {
      auditEfficiency: {
        pendingAuditTotal: currentBacklog.idlePending + currentBacklog.errandPending,
        processedAuditTotal,
        approvalRate: processedAuditTotal > 0 ? Number((approvalTotal / processedAuditTotal).toFixed(4)) : 0,
        idlePending: currentBacklog.idlePending,
        errandPending: currentBacklog.errandPending
      },
      operationControl: {
        publishedTotal: contentRows.length,
        activePublisherTotal: periodPublishUsers.size,
        idlePublished: businessSummary.idle.published,
        errandPublished: businessSummary.errand.published
      },
      businessHealth: {
        idleConsultationTotal: periodIdleConsultations.size,
        errandCompletedTotal: businessSummary.errand.completed,
        idleApproved: businessSummary.idle.approved,
        errandApproved: businessSummary.errand.approved
      },
      riskControl: {
        violationTotal,
        currentBannedUsers: currentStatus.bannedUsers,
        userBanTotal,
        pendingReportTotal: currentBacklog.reportPending
      }
    },
    businessSummary,
    charts: {
      publishTrend: {
        labels: publishTrend.labels,
        series: [
          {
            key: "idlePublished",
            name: "闲置发布量",
            data: publishTrend.idlePublished
          },
          {
            key: "errandPublished",
            name: "代拿发布量",
            data: publishTrend.errandPublished
          }
        ]
      },
      pendingBacklog: {
        labels: pendingBacklog.labels,
        series: [
          {
            key: "idlePending",
            name: "闲置待审核量",
            stack: "backlog",
            data: pendingBacklog.idlePending
          },
          {
            key: "errandPending",
            name: "代拿待审核量",
            stack: "backlog",
            data: pendingBacklog.errandPending
          },
          {
            key: "reportPending",
            name: "举报待处理",
            stack: "backlog",
            data: pendingBacklog.reportPending
          }
        ]
      },
      auditResult: {
        labels: auditResult.labels,
        series: [
          {
            key: "idleApprove",
            name: "闲置通过",
            stack: "idle",
            data: auditResult.idleApprove
          },
          {
            key: "idleReject",
            name: "闲置驳回",
            stack: "idle",
            data: auditResult.idleReject
          },
          {
            key: "idleRemove",
            name: "闲置下架",
            stack: "idle",
            data: auditResult.idleRemove
          },
          {
            key: "errandApprove",
            name: "代拿通过",
            stack: "errand",
            data: auditResult.errandApprove
          },
          {
            key: "errandReject",
            name: "代拿驳回",
            stack: "errand",
            data: auditResult.errandReject
          },
          {
            key: "errandRemove",
            name: "代拿下架",
            stack: "errand",
            data: auditResult.errandRemove
          }
        ]
      }
    }
  };
}

module.exports = {
  getDashboardAnalytics
};
