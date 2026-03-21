#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const { Client } = require("pg");

const rootDir = path.resolve(__dirname, "..");

async function readSql(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  return fs.readFile(fullPath, "utf8");
}

function parseDotEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eq = trimmed.indexOf("=");
  if (eq === -1) return null;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

async function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const envPath = path.join(rootDir, ".env.local");
  try {
    const content = await fs.readFile(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseDotEnvLine(line);
      if (parsed?.key === "DATABASE_URL" && parsed.value) {
        return parsed.value;
      }
    }
  } catch {
    // .env.local is optional for this script
  }

  return null;
}

async function run() {
  const databaseUrl = await getDatabaseUrl();
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Add it to your environment or .env.local.");
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    const initSql = await readSql("db/init.sql");
    const seedSql = await readSql("db/seed.sql");

    await client.query(initSql);
    await client.query(seedSql);

    console.log("Database initialized and seeded successfully.");
  } finally {
    await client.end().catch(() => undefined);
  }
}

run().catch((err) => {
  console.error("Failed to run db seed:", err?.message || err);
  process.exit(1);
});
