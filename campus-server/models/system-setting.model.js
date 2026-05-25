const { query } = require("./index");

const DEFAULT_SETTINGS = {
  uploadMaxSizeMb: 5,
  idleMaxImages: 20,
  errandMaxImages: 20
};

const SETTING_KEYS = {
  uploadMaxSizeMb: "upload_max_size_mb",
  idleMaxImages: "idle_max_images",
  errandMaxImages: "errand_max_images"
};

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSettings(rows = []) {
  const map = rows.reduce((result, row) => {
    result[row.setting_key] = row.setting_value;
    return result;
  }, {});

  return {
    uploadMaxSizeMb: normalizeNumber(map[SETTING_KEYS.uploadMaxSizeMb], DEFAULT_SETTINGS.uploadMaxSizeMb),
    idleMaxImages: normalizeNumber(map[SETTING_KEYS.idleMaxImages], DEFAULT_SETTINGS.idleMaxImages),
    errandMaxImages: normalizeNumber(map[SETTING_KEYS.errandMaxImages], DEFAULT_SETTINGS.errandMaxImages)
  };
}

async function ensureDefaults() {
  await query(
    `
    INSERT INTO system_setting (setting_key, setting_value, setting_desc)
    VALUES
      (?, ?, ?),
      (?, ?, ?),
      (?, ?, ?)
    ON DUPLICATE KEY UPDATE setting_key = setting_key
    `,
    [
      SETTING_KEYS.uploadMaxSizeMb,
      String(DEFAULT_SETTINGS.uploadMaxSizeMb),
      "单张图片最大上传大小，单位 MB，0 表示不限制",
      SETTING_KEYS.idleMaxImages,
      String(DEFAULT_SETTINGS.idleMaxImages),
      "闲置物品最多上传图片数量",
      SETTING_KEYS.errandMaxImages,
      String(DEFAULT_SETTINGS.errandMaxImages),
      "代拿订单最多上传图片数量"
    ]
  );
}

async function getSettings() {
  await ensureDefaults();
  const rows = await query(
    "SELECT setting_key, setting_value FROM system_setting WHERE setting_key IN (?, ?, ?)",
    [
      SETTING_KEYS.uploadMaxSizeMb,
      SETTING_KEYS.idleMaxImages,
      SETTING_KEYS.errandMaxImages
    ]
  );
  return normalizeSettings(rows);
}

async function updateSettings(settings) {
  const entries = [
    [SETTING_KEYS.uploadMaxSizeMb, String(settings.uploadMaxSizeMb)],
    [SETTING_KEYS.idleMaxImages, String(settings.idleMaxImages)],
    [SETTING_KEYS.errandMaxImages, String(settings.errandMaxImages)]
  ];

  for (const [key, value] of entries) {
    await query(
      `
      INSERT INTO system_setting (setting_key, setting_value)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
      `,
      [key, value]
    );
  }

  return getSettings();
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  updateSettings
};
