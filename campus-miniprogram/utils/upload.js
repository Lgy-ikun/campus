const { normalizeImageUrl } = require("./image");

function uploadImage(filePath) {
  const app = getApp();

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${app.globalData.baseUrl}/upload/image`,
      filePath,
      name: "file",
      header: {
        Authorization: `Bearer ${app.globalData.token}`
      },
      success(uploadRes) {
        try {
          if (uploadRes.statusCode && uploadRes.statusCode >= 400) {
            const errorData = JSON.parse(uploadRes.data || "{}");
            reject(new Error(errorData.msg || "上传失败"));
            return;
          }

          const data = JSON.parse(uploadRes.data || "{}");
          if (data.code === 200) {
            resolve(normalizeImageUrl(data.data.url));
            return;
          }

          reject(new Error(data.msg || "上传失败"));
        } catch (error) {
          reject(error);
        }
      },
      fail: reject
    });
  });
}

module.exports = {
  uploadImage
};
