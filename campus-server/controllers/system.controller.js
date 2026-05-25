const systemSettingModel = require("../models/system-setting.model");
const { success } = require("../utils/response");

async function getPublicSettings(req, res) {
  const settings = await systemSettingModel.getSettings();
  return res.json(
    success({
      uploadMaxSizeMb: settings.uploadMaxSizeMb,
      idleMaxImages: settings.idleMaxImages,
      errandMaxImages: settings.errandMaxImages
    })
  );
}

module.exports = {
  getPublicSettings
};
