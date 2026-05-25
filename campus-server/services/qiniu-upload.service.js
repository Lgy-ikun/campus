const path = require("path");
const qiniu = require("qiniu");

const zoneMap = {
  z0: qiniu.zone.Zone_z0,
  z1: qiniu.zone.Zone_z1,
  z2: qiniu.zone.Zone_z2,
  na0: qiniu.zone.Zone_na0,
  as0: qiniu.zone.Zone_as0
};

function getRequiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`缺少七牛云配置：${name}`);
  }
  return value;
}

function normalizePublicDomain(domain) {
  const cleaned = String(domain || "").trim().replace(/\/+$/, "");
  if (!cleaned) {
    throw new Error("缺少七牛云配置：QINIU_DOMAIN");
  }

  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }

  return `https://${cleaned}`;
}

function buildConfig() {
  const zoneName = String(process.env.QINIU_ZONE || "z0").trim().toLowerCase();
  return new qiniu.conf.Config({
    useHttpsDomain: true,
    zone: zoneMap[zoneName] || qiniu.zone.Zone_z0
  });
}

function buildMac() {
  return new qiniu.auth.digest.Mac(
    getRequiredEnv("QINIU_ACCESS_KEY"),
    getRequiredEnv("QINIU_SECRET_KEY")
  );
}

function buildUploadToken(bucket) {
  const mac = buildMac();
  const putPolicy = new qiniu.rs.PutPolicy({
    scope: bucket
  });

  return putPolicy.uploadToken(mac);
}

function buildOriginUrl(key) {
  const domain = normalizePublicDomain(getRequiredEnv("QINIU_DOMAIN"));
  return `${domain}/${String(key || "").replace(/^\/+/, "")}`;
}

function buildDownloadUrl(key) {
  const safeKey = String(key || "").trim().replace(/^\/+/, "");
  if (!safeKey) {
    throw new Error("缺少图片资源 key");
  }

  const deadline = Math.floor(Date.now() / 1000) + Number(process.env.QINIU_URL_EXPIRE_SECONDS || 86400);
  const bucketManager = new qiniu.rs.BucketManager(buildMac(), buildConfig());
  const domain = normalizePublicDomain(getRequiredEnv("QINIU_DOMAIN"));

  return bucketManager.privateDownloadUrl(domain, safeKey, deadline);
}

function buildObjectKey(originalName = "") {
  const extension = path.extname(originalName || "").toLowerCase() || ".jpg";
  return `campus/${Date.now()}-${Math.round(Math.random() * 1e6)}${extension}`;
}

async function uploadBufferToQiniu(file) {
  const bucket = getRequiredEnv("QINIU_BUCKET");
  const uploadToken = buildUploadToken(bucket);
  const config = buildConfig();
  const formUploader = new qiniu.form_up.FormUploader(config);
  const putExtra = new qiniu.form_up.PutExtra();
  const objectKey = buildObjectKey(file.originalname);

  putExtra.fname = file.originalname || objectKey;
  putExtra.mimeType = file.mimetype || "image/jpeg";

  const result = await formUploader.put(uploadToken, objectKey, file.buffer, putExtra);
  const payload = result && result.data ? result.data : result;
  const statusCode = result && result.resp ? result.resp.statusCode : 200;

  if (!payload || statusCode >= 400 || !payload.key) {
    const errorMessage = payload && payload.error ? payload.error : "七牛云上传失败";
    throw new Error(errorMessage);
  }

  const url = buildOriginUrl(payload.key);

  return {
    url,
    key: payload.key,
    hash: payload.hash || ""
  };
}

module.exports = {
  buildDownloadUrl,
  buildOriginUrl,
  uploadBufferToQiniu,
  normalizePublicDomain
};
