import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma CLI configuration (Prisma 7).
// The `url` below is used by Prisma Migrate / Studio. We point it at the
// DIRECT (non-pooled) Neon connection because migrations should not run
// through the connection pooler.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
