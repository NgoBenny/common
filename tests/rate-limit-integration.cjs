const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("node:crypto");
const { load } = require("./load-ts.cjs");

async function main() {
  const url = new URL(process.env.RATE_LIMIT_TEST_URL || "http://invalid");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55439");
  assert.equal(url.username, "restore_check");
  assert.equal(url.pathname, "/postgres");
  const db = new PrismaClient({ datasources: { db: { url: url.href } } });
  try {
    const { createLimited, RateLimitError } = load("app/lib/rate-limit.ts", {
      "./restrictions": require("./load-restrictions.cjs")(db),
      "./db": { __esModule: true, default: db },
    });
    const userId = `rate-test-${randomUUID()}`;
    await db.user.create({ data: { id: userId, email: "test@example.invalid", firstName: "Rate", lastName: "Test" } });
    const results = await Promise.allSettled(Array.from({ length: 15 }, () =>
      createLimited(userId, "comment", (tx) => tx.comment.create({ data: { userId, text: "Isolated concurrency test" } })),
    ));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 10);
    assert.ok(results.filter((result) => result.status === "rejected").every((result) => result.reason instanceof RateLimitError));
    assert.equal(await db.comment.count({ where: { userId } }), 10);
    console.log("Isolated PostgreSQL test passed: 15 concurrent requests produced exactly 10 comments.");
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error("Isolated rate-limit test failed; no production writes were permitted."); process.exitCode = 1; });
