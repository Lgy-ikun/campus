const multer = require("multer");
const path = require("path");
const systemSettingModel = require("../models/system-setting.model");

const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

function createMulterUploader(maxSizeMb) {
  const limits = {};

  if (maxSizeMb > 0) {
    limits.fileSize = maxSizeMb * 1024 * 1024;
  }

  return multer({
    storage: multer.memoryStorage(),
    limits,
    fileFilter(req, file, cb) {
      const extension = path.extname(file.originalname || "").toLowerCase();
      const mimeType = String(file.mimetype || "").toLowerCase();
      const isImageMime = mimeType.startsWith("image/");

      if (!allowedExtensions.includes(extension) || !isImageMime) {
        const error = new Error("仅支持 jpg、jpeg、png、webp、gif 图片格式");
        error.statusCode = 400;
        return cb(error);
      }

      return cb(null, true);
    }
  });
}

async function imageUpload(req, res, next) {
  try {
    const settings = await systemSettingModel.getSettings();
    req.uploadSettings = settings;

    const uploader = createMulterUploader(settings.uploadMaxSizeMb);
    uploader.single("file")(req, res, (error) => {
      if (!error) {
        return next();
      }

      if (error.code === "LIMIT_FILE_SIZE") {
        error.statusCode = 400;
        error.message = settings.uploadMaxSizeMb > 0
          ? `上传的图片不能大于 ${settings.uploadMaxSizeMb}MB`
          : "图片上传失败";
      }

      return next(error);
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  imageUpload
};
