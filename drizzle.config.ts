import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { getDatabaseUrl } from "./lib/db/env";

// Load .env.local when running drizzle-kit (e.g. npm run db:push) so local URL is used if unset
config({ path: ".env.local" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
});
