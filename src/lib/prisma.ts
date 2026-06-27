import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Neon's serverless (free tier) compute suspends after inactivity. The first
// query after it has gone to sleep can fail while the compute wakes up
// (ETIMEDOUT, connection reset, dropped pooled socket, etc.). A full wake can
// take tens of seconds. We walk the error's `cause` chain and inspect Prisma
// error codes / Postgres SQLSTATEs to detect these transient errors so we can
// safely retry them instead of returning a 500.
function isTransientConnectionError(error: unknown): boolean {
  const parts: string[] = [];
  let current: unknown = error;
  for (let i = 0; current && i < 6; i++) {
    const e = current as { message?: unknown; code?: unknown; cause?: unknown };
    if (e.message) parts.push(String(e.message));
    if (e.code) parts.push(String(e.code));
    current = e.cause;
  }
  const text = parts.join(" ");
  return (
    // Node/socket level
    /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EPIPE|ENOTFOUND|EAI_AGAIN|fetch failed|socket hang up|Connection terminated|terminating connection|server closed the connection|Closed|timeout/i.test(
      text,
    ) ||
    // Prisma error codes: P1001 can't reach DB, P1002 timed out, P1017 closed
    /\bP100[127]\b/.test(text) ||
    // Postgres SQLSTATE connection-exception class (08xxx) + admin shutdown (57P0x)
    /\b08[0-9A-Z]{3}\b|\b57P0[123]\b/.test(text) ||
    /can't reach database|connection pool|connecting to database/i.test(text)
  );
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({
    connectionString,
    // Wait for a connection while Neon's compute wakes (instead of failing
    // fast), keep sockets alive to detect dead connections early, and recycle
    // idle connections before Neon silently drops them.
    connectionTimeoutMillis: 12000,
    idleTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
    max: 5,
  });

  return new PrismaClient({ adapter }).$extends({
    query: {
      // Retry every query on transient connection errors. The total retry
      // window (~30s of backoff plus the per-attempt connection timeout) is
      // sized to cover a Neon cold start, which can take tens of seconds.
      async $allOperations({ args, query }) {
        const backoffs = [500, 1000, 2000, 4000, 8000, 8000];
        let lastError: unknown;
        for (let attempt = 0; attempt <= backoffs.length; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            lastError = error;
            if (attempt < backoffs.length && isTransientConnectionError(error)) {
              await sleep(backoffs[attempt]);
              continue;
            }
            throw error;
          }
        }
        throw lastError;
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// Reuse a single PrismaClient across hot-reloads in development to avoid
// exhausting the database connection pool.
const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
