const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");

async function main() {
  const url = new URL(process.env.FEATURE_TEST_URL || "");
  assert.ok(
    ["localhost", "127.0.0.1"].includes(url.hostname) &&
      ["55440", "55441"].includes(url.port),
    "Only isolated local test databases are permitted",
  );
  const db = new PrismaClient({ datasources: { db: { url: url.href } } });
  try {
    // Supabase supplies these roles; the isolated PostgreSQL fixture may not.
    for (const name of ["anon", "authenticated"]) {
      await db.$executeRawUnsafe(
        `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${name}') THEN CREATE ROLE ${name} NOLOGIN; END IF; END $$`,
      );
    }
    const psql =
      process.platform === "win32"
        ? "C:/Program Files/PostgreSQL/18/bin/psql.exe"
        : "psql";
    const result = spawnSync(
      psql,
      ["--no-password", "-v", "ON_ERROR_STOP=1", "-f", "docs/runtime-role.sql"],
      {
        env: {
          ...process.env,
          PGHOST: url.hostname,
          PGPORT: url.port,
          PGDATABASE: url.pathname.slice(1),
          PGUSER: decodeURIComponent(url.username),
          PGPASSWORD: decodeURIComponent(url.password),
        },
        encoding: "utf8",
      },
    );
    assert.equal(
      result.status,
      0,
      "Role setup must succeed in the isolated database",
    );
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE common_app");
      const [rights] = await tx.$queryRaw`SELECT
        has_schema_privilege(current_user, 'public', 'CREATE') AS create_schema,
        has_table_privilege(current_user, 'public."_prisma_migrations"', 'SELECT') AS migrations,
        has_table_privilege(current_user, 'public."Post"', 'SELECT,INSERT,UPDATE,DELETE') AS post_dml`;
      assert.equal(rights.create_schema, false);
      assert.equal(rights.migrations, false);
      assert.equal(rights.post_dml, true);
      // Actual RLS-filtered access must work, not just the grant metadata.
      await tx.post.count();
      await tx.userRestriction.count();
      await tx.moderationEvent.count();
      const [audit] = await tx.$queryRaw`SELECT has_table_privilege(current_user, 'public."ModerationEvent"', 'INSERT') AS insert_allowed, has_table_privilege(current_user, 'public."ModerationEvent"', 'UPDATE') AS update_allowed, has_table_privilege(current_user, 'public."ModerationEvent"', 'DELETE') AS delete_allowed`;
      assert.equal(audit.insert_allowed, true);
      assert.equal(audit.update_allowed, false);
      assert.equal(audit.delete_allowed, false);
    });
    await assert.rejects(
      db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL ROLE common_app");
        await tx.$executeRawUnsafe(
          "CREATE TABLE public.qa_role_should_fail(id integer)",
        );
      }),
      (error) => error.meta?.code === "42501",
    );
    const grants =
      await db.$queryRaw`SELECT count(*)::int AS count FROM information_schema.table_privileges WHERE table_schema='public' AND grantee IN ('anon', 'authenticated')`;
    assert.equal(grants[0].count, 0);
    console.log(
      "Runtime role verified: app access works; DDL, migration-history access and Data API grants denied.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
