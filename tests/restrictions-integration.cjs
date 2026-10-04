const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const { load } = require("./load-ts.cjs");
const url = process.env.FEATURE_TEST_URL;
if (url !== "postgresql://browser_test@127.0.0.1:55440/postgres")
  throw Error("Only the isolated test database is allowed");
const db = new PrismaClient({ datasources: { db: { url } } });
const siteId = "kp_3554467a11f2440cbb959123e0f4b1e8";
let actor = siteId;
const auth = {
  getKindeServerSession: () => ({
    getUser: async () => (actor ? { id: actor } : null),
  }),
};
const validation = load("app/lib/validation.ts");
const restrictions = require("./load-restrictions.cjs")(db, validation);
const moderation = load("app/lib/moderation.ts", { "server-only": {} });
const actions = load("app/moderation/actions.ts", {
  "@kinde-oss/kinde-auth-nextjs/server": auth,
  "../lib/db": db,
  "../lib/validation": validation,
  "../lib/moderation": moderation,
  "../lib/restrictions": restrictions,
  "next/cache": { revalidatePath() {} },
});
const content = load("app/actions.ts", {
  "@kinde-oss/kinde-auth-nextjs/server": auth,
  "./lib/db": db,
  "./lib/validation": validation,
  "./lib/moderation": moderation,
  "./lib/restrictions": restrictions,
  "./lib/rate-limit": load("app/lib/rate-limit.ts", {
    "./db": db,
    "./restrictions": restrictions,
  }),
  "next/cache": { revalidatePath() {} },
  "next/navigation": {
    redirect(path) {
      throw Error("redirect:" + path);
    },
  },
});
const f = (values) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
};
const target = "restriction-target",
  owner = "restriction-owner";
const ban = (scope, duration = "24h") =>
  actions.restrictUser(
    f({
      scope,
      username: target,
      duration,
      reason: "Isolated QA moderation test",
    }),
  );
async function main() {
  for (const id of [siteId, target, owner])
    await db.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        email: "qa@example.invalid",
        firstName: "QA",
        lastName: "Test",
        userName: id === siteId ? "qa-site-owner" : id,
      },
    });
  const community = await db.subreddit.upsert({
    where: { name: "restriction-qa" },
    update: { removedAt: null },
    create: { name: "restriction-qa", userId: owner },
  });
  await db.userRestriction.deleteMany({ where: { userId: target } });
  const post = await db.post.create({
    data: {
      title: "QA retained post",
      subName: community.name,
      userId: target,
    },
  });
  const comment = await db.comment.create({
    data: { text: "QA retained comment", postId: post.id, userId: target },
  });
  actor = target;
  assert.match((await ban("@site")).error, /yourself/);
  actor = owner;
  assert.match((await ban("@site")).error, /do not moderate/);
  assert.match((await ban("unknown")).error, /do not moderate/);
  assert.ok((await ban(community.name)).message);
  actor = target;
  assert.equal(await restrictions.participationProblem(target), null);
  assert.match(
    await restrictions.participationProblem(target, community.name),
    /community/,
  );
  assert.match(
    (
      await content.createPost(
        { jsonContent: null },
        f({ title: "blocked", subName: community.name }),
      )
    ).error,
    /restricted/,
  );
  assert.match(
    (
      await content.editPost(
        { jsonContent: null },
        f({ postId: post.id, title: "blocked" }),
      )
    ).error,
    /restricted/,
  );
  assert.match(
    (await content.createComment(f({ postId: post.id, comment: "blocked" })))
      .error,
    /restricted/,
  );
  assert.match(
    (await content.editComment(f({ id: comment.id, comment: "blocked" })))
      .error,
    /restricted/,
  );
  await assert.rejects(
    () => content.handleVote(f({ postId: post.id, voteDirection: "UP" })),
    /restricted/,
  );
  await assert.rejects(
    () => content.setMembership(f({ subredditId: community.id, join: "true" })),
    /restricted/,
  );
  let active = await db.userRestriction.findFirst({
    where: { userId: target, liftedAt: null },
  });
  actor = target;
  assert.match(
    (
      await actions.liftRestriction(
        f({ restrictionId: active.id, reason: "tampering" }),
      )
    ).error,
    /cannot lift/,
  );
  actor = owner;
  assert.ok(
    (
      await actions.liftRestriction(
        f({ restrictionId: active.id, reason: "QA lift" }),
      )
    ).message,
  );
  assert.equal(
    await restrictions.participationProblem(target, community.name),
    null,
  );
  actor = siteId;
  assert.ok((await ban("@site", "permanent")).message);
  actor = owner;
  active = await db.userRestriction.findFirst({
    where: { userId: target, subredditId: null, liftedAt: null },
  });
  assert.match(
    (
      await actions.liftRestriction(
        f({ restrictionId: active.id, reason: "tampering" }),
      )
    ).error,
    /cannot lift/,
  );
  actor = target;
  await assert.rejects(
    () => content.createCommunity({}, f({ name: "blocked-site" })),
    /restricted/,
  );
  assert.match(
    (
      await content.createPost(
        { jsonContent: null },
        f({ title: "blocked", subName: community.name }),
      )
    ).error,
    /restricted/,
  );
  await assert.rejects(
    () => content.handleVote(f({ postId: post.id, voteDirection: "UP" })),
    /restricted/,
  );
  // An already signed-in identity is rechecked, without changing its session.
  await assert.rejects(
    () => restrictions.assertParticipation(target),
    /restricted/,
  );
  let uploadGuard, parser;
  load("app/api/uploadthing/core.ts", {
    "@kinde-oss/kinde-auth-nextjs/server": auth,
    "@/app/lib/restrictions": restrictions,
    "uploadthing/server": { UploadThingError: class extends Error {} },
    "uploadthing/next": {
      createUploadthing: () => () => ({
        input(p) {
          parser = p;
          return this;
        },
        middleware(fn) {
          uploadGuard = fn;
          return this;
        },
        onUploadComplete() {
          return this;
        },
      }),
    },
  });
  assert.throws(() => parser.parse({ subName: "" }));
  await assert.rejects(
    () =>
      uploadGuard({
        files: [{ type: "image/png" }],
        input: parser.parse({ subName: community.name }),
      }),
    /restricted/,
  );
  actor = siteId;
  assert.ok(
    (
      await actions.liftRestriction(
        f({ restrictionId: active.id, reason: "QA lift" }),
      )
    ).message,
  );
  assert.ok((await ban("@site", "1h")).message);
  active = await db.userRestriction.findFirst({
    where: { userId: target, subredditId: null, liftedAt: null },
  });
  await db.userRestriction.update({
    where: { id: active.id },
    data: {
      createdAt: new Date(Date.now() - 7200000),
      expiresAt: new Date(Date.now() - 3600000),
    },
  });
  assert.equal(
    await restrictions.participationProblem(target),
    null,
    "Expiry works without a scheduled job",
  );
  assert.match(
    (
      await actions.restrictUser(
        f({ scope: "@site", username: target, reason: "", duration: "24h" }),
      )
    ).error,
    /Invalid reason/,
  );
  actor = owner;
  assert.match(
    (
      await actions.setCommunityAvailability(
        f({ name: community.name, reason: "tampering", decision: "remove" }),
      )
    ).error,
    /Only the site moderator/,
  );
  actor = siteId;
  assert.ok(
    (
      await actions.setCommunityAvailability(
        f({ name: community.name, reason: "QA remove", decision: "remove" }),
      )
    ).message,
  );
  assert.match(
    await restrictions.participationProblem(target, community.name),
    /unavailable/,
  );
  const { getFeed } = load("app/lib/feed.ts", {
    "./db": db,
    "./validation": validation,
  });
  assert.equal((await getFeed({}, { subName: community.name })).count, 0);
  assert.equal(
    await db.subreddit.count({
      where: { name: community.name, removedAt: null },
    }),
    0,
  );
  assert.equal(
    await db.post.count({ where: { id: post.id } }),
    1,
    "Community removal preserves posts",
  );
  actor = target;
  assert.match(
    (
      await content.createPost(
        { jsonContent: null },
        f({ title: "blocked", subName: community.name }),
      )
    ).error,
    /community/,
  );
  await assert.rejects(
    () =>
      uploadGuard({
        files: [{ type: "image/png" }],
        input: { subName: community.name },
      }),
    /removed/,
  );
  // A restricted user can still erase their own content, but never someone else's.
  await content.deleteContent(f({ id: comment.id, kind: "comment" }));
  await assert.rejects(
    () => content.deleteContent(f({ id: "not-owned", kind: "post" })),
    /author/,
  );
  actor = siteId;
  assert.ok(
    (
      await actions.setCommunityAvailability(
        f({ name: community.name, reason: "QA restore", decision: "restore" }),
      )
    ).message,
  );
  assert.equal(
    (await getFeed({}, { subName: community.name })).count > 0,
    true,
  );
  assert.ok(
    (await db.moderationEvent.count({
      where: { subredditId: community.id },
    })) >= 4,
  );
  // Do not allow username changes to grant the site role.
  assert.equal(moderation.isSiteModerator(target), false);
  assert.equal(moderation.isSiteModerator("un1on"), false);
  console.log(
    "Moderation integration passed: scopes, tampering, expiry, session enforcement, uploads, removal/restoration, preserved content and audit history.",
  );
}
main()
  .finally(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
