const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

module.exports = {
  secret: process.env.JWT_SECRET || "campus-service-secret",
  expiresIn: process.env.JWT_EXPIRES_IN || "7d"
};
