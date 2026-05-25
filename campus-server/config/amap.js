const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

module.exports = {
  key: process.env.AMAP_KEY || "",
  enableMock: (process.env.AMAP_ENABLE_MOCK || "true") === "true"
};
