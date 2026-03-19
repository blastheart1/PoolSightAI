import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getDatabaseUrl } from "./env";
import * as schema from "./schema";

const url = getDatabaseUrl();
const isLocal = url.length > 0 && url.includes("localhost");

let db: ReturnType<typeof drizzleNeon<typeof schema>> | ReturnType<typeof drizzleNode<typeof schema>> | null = null;
let localUrlLogged = false;

if (!url) {
  console.warn(
    "[db] DATABASE_URL / NEON_DATABASE_URL not set; DB operations will fail."
  );
} else if (isLocal) {
  if (process.env.NODE_ENV !== "production" && !localUrlLogged) {
    localUrlLogged = true;
    const safe = url.replace(/:(?!\/\/)([^:@]+)@/, ":****@") ?? url;
    console.info("[db] Local Postgres URL:", safe);
  }
  db = drizzleNode({ client: new Pool({ connectionString: url }), schema });
} else {
  db = drizzleNeon(neon(url), { schema });
}

export { db };
export * from "./schema";
