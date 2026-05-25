const path = require("path");
const fs = require("fs/promises");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

dotenv.config({ path: path.join(__dirname, ".env") });

const { pool, dbConfig } = require("./config/db");
const routes = require("./routes");
const { notFoundHandler, errorHandler } = require("./middlewares/error.middleware");
const { startErrandAutoCompleteJob } = require("./services/errand-auto-complete.service");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, process.env.UPLOAD_DIR || "uploads")));

app.get("/health", (req, res) => {
  res.json({
    code: 200,
    msg: "服务运行正常",
    data: {
      timestamp: new Date().toISOString()
    }
  });
});

app.use("/api", routes);
app.use(notFoundHandler);
app.use(errorHandler);

async function ensureDatabase() {
  const databaseName = String(dbConfig.database || "campus_service").replace(/`/g, "``");
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    dateStrings: true
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

async function ensureSchema() {
  await ensureDatabase();

  const schemaPath = path.join(__dirname, "db", "init.sql");
  const schemaSql = await fs.readFile(schemaPath, "utf8");
  const statements = schemaSql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .filter((statement) => !/^CREATE DATABASE\b/i.test(statement) && !/^USE\b/i.test(statement));

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") {
        throw error;
      }
    }
  }
}

async function start() {
  await ensureSchema();
  startErrandAutoCompleteJob();

  app.listen(port, () => {
    console.log(`campus-server started at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start campus-server", error);
  process.exitCode = 1;
});
