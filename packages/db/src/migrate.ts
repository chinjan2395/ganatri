import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { getDatabase } from "./db";

/**
 * Run pending migrations against the database.
 * Called during server startup (Phase 6d) or manually via `npm run db:migrate`.
 */
async function runMigrations() {
  const { db, pool } = getDatabase();

  console.log("Running migrations from", path.join(__dirname, "../migrations"));

  try {
    await migrate(db, {
      migrationsFolder: path.join(__dirname, "../migrations"),
    });
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error("Fatal migration error:", err);
  process.exit(1);
});
