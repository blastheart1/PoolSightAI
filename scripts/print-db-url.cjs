#!/usr/bin/env node
/**
 * Prints the resolved DATABASE_URL (for local dev or .env). Use: npm run db:url
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const explicit =
  process.env.DATABASE_URL?.trim() || process.env.NEON_DATABASE_URL?.trim();
const url =
  explicit ||
  (process.env.VERCEL !== "1"
    ? `postgresql://${process.env.USER || "postgres"}@localhost/calimingopoolsight`
    : "");

console.log(url || "(not set)");
