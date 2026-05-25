const { success, failure } = require("../utils/response");
const { buildDownloadUrl, uploadBufferToQiniu } = require("../services/qiniu-upload.service");
const http = require("http");
const https = require("https");

function buildPublicOrigin(req) {
  const configuredBaseUrl = String(process.env.PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  if (configuredBaseUrl) {
    return configuredBaseUrl.endsWith("/api")
      ? configuredBaseUrl.slice(0, -4)
      : configuredBaseUrl;
  }

  const host = req.get("host");
  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const requestProtocol = String(forwardedProto || req.protocol || "https").replace(/:$/, "");
  const isLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
  const protocol = requestProtocol === "http" && !isLocalhost ? "https" : requestProtocol;

  return `${protocol}://${host}`;
}

function buildProxyUrl(req, key) {
  const encodedKey = encodeURIComponent(key);
  return `${buildPublicOrigin(req)}/api/upload/file?key=${encodedKey}`;
}

function pipeRemoteFile(url, res, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https://") ? https : http;

    const request = client.get(url, (remoteRes) => {
      const statusCode = Number(remoteRes.statusCode || 500);
      const redirectUrl = remoteRes.headers.location;

      if (statusCode >= 300 && statusCode < 400 && redirectUrl && redirectCount < 3) {
        remoteRes.resume();
        const nextUrl = new URL(redirectUrl, url).toString();
        pipeRemoteFile(nextUrl, res, redirectCount + 1).then(resolve).catch(reject);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        remoteRes.resume();
        reject(new Error("图片资源读取失败"));
        return;
      }

      res.setHeader("Content-Type", remoteRes.headers["content-type"] || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      remoteRes.pipe(res);
      remoteRes.on("end", resolve);
      remoteRes.on("error", reject);
    });

    request.on("error", reject);
  });
}

async function uploadImage(req, res) {
  if (!req.file) {
    return res.status(400).json(failure("请选择图片文件"));
  }

  const uploaded = await uploadBufferToQiniu(req.file);

  return res.json(
    success(
      {
        url: buildProxyUrl(req, uploaded.key),
        originUrl: uploaded.url,
        key: uploaded.key,
        hash: uploaded.hash
      },
      "图片上传成功"
    )
  );
}

async function previewImage(req, res) {
  const key = String(req.query.key || "").trim();
  if (!key) {
    return res.status(400).json(failure("缺少图片 key"));
  }

  const downloadUrl = buildDownloadUrl(key);
  await pipeRemoteFile(downloadUrl, res);
}

module.exports = {
  previewImage,
  uploadImage
};
