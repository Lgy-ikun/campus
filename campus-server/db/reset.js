const fs = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const baseConfig = {
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  dateStrings: true
};

const databaseName = process.env.MYSQL_DATABASE || "campus_service";

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, "``")}\``;
}

async function getSchemaStatements() {
  const schemaPath = path.join(__dirname, "init.sql");
  const schemaSql = await fs.readFile(schemaPath, "utf8");

  return schemaSql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .filter((statement) => !/^CREATE DATABASE\b/i.test(statement) && !/^USE\b/i.test(statement));
}

async function rebuildDatabase() {
  const connection = await mysql.createConnection(baseConfig);

  try {
    await connection.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(databaseName)} DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }

  const schemaConnection = await mysql.createConnection({
    ...baseConfig,
    database: databaseName
  });

  try {
    const statements = await getSchemaStatements();
    for (const statement of statements) {
      await schemaConnection.query(statement);
    }
  } finally {
    await schemaConnection.end();
  }
}

async function runSeedScript() {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, "seed.js")], {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`seed.js exited with code ${code}`));
    });
  });
}

async function main() {
  console.log(`[db:reset] Resetting database "${databaseName}"...`);
  await rebuildDatabase();
  console.log("[db:reset] Schema imported.");
  await runSeedScript();
  console.log("[db:reset] Database reset and seed completed.");
}

main().catch((error) => {
  console.error("[db:reset] Failed:", error);
  process.exit(1);
});
