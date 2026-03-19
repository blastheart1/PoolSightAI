/**
 * Resolves database URL: explicit env wins; on local (non-Vercel) defaults to
 * postgresql://localhost/calimingopoolsight so you don't need .env.local for dev.
 * On Vercel/prod set DATABASE_URL or NEON_DATABASE_URL to your Neon connection string.
 */
export function getDatabaseUrl(): string {
  const explicit =
    process.env.DATABASE_URL?.trim() ?? process.env.NEON_DATABASE_URL?.trim();
  if (explicit) return explicit;

  // Not on Vercel → treat as local; use default local Postgres URL
  if (process.env.VERCEL !== "1") {
    const user = process.env.USER || "postgres";
    return `postgresql://${user}@localhost/calimingopoolsight`;
  }

  return "";
}
