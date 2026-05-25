function normalizeImageUrl(url) {
  const value = String(url || "").trim();
  if (!value) {
    return "";
  }

  const httpsValue = /^http:\/\//i.test(value)
    ? value.replace(/^http:\/\//i, "https://")
    : value;

  const match = httpsValue.match(/^https:\/\/([^/]+)\/([^?#]+)/i);
  const qiniuHosts = ["img.wananfe.top", "tcys4zmh1.hn-bkt.clouddn.com"];

  if (match && qiniuHosts.includes(match[1])) {
    const app = getApp();
    const baseUrl = String(app.globalData.baseUrl || "").replace(/\/+$/, "");
    const key = decodeURIComponent(match[2]);
    return `${baseUrl}/upload/file?key=${encodeURIComponent(key)}`;
  }

  return httpsValue;
}

function normalizeImageList(images) {
  const list = Array.isArray(images)
    ? images
    : String(images || "")
      .split(",")
      .map((item) => item.trim());

  return list
    .filter(Boolean)
    .map(normalizeImageUrl)
    .filter(Boolean);
}

function logImageError(scene, event) {
  const src = event?.currentTarget?.dataset?.src || "";
  const errMsg = event?.detail?.errMsg || "";
  console.warn(`[image] ${scene} load failed`, {
    src,
    errMsg
  });
}

module.exports = {
  logImageError,
  normalizeImageList,
  normalizeImageUrl
};
