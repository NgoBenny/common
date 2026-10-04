const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const { load } = require("./load-ts.cjs");
const url = process.env.FEATURE_TEST_URL;
if (url !== "postgresql://browser_test@127.0.0.1:55440/postgres")
  throw new Error("Feature tests require the isolated browser database");
const db = new PrismaClient({ datasources: { db: { url } } });
let actor = "browser-author";
const validation = load("app/lib/validation.ts");
const restrictions = require("./load-restrictions.cjs")(db, validation);
const limits = load("app/lib/rate-limit.ts", {
  "./db": db,
  "./restrictions": restrictions,
});
const moderation = load("app/lib/moderation.ts", { "server-only": {} });
const actions = load("app/actions.ts", {
  "./lib/restrictions": restrictions,
  "./lib/moderation": moderation,
  "@kinde-oss/kinde-auth-nextjs/server": {
    getKindeServerSession: () => ({
      getUser: async () => (actor ? { id: actor } : null),
    }),
  },
  "./lib/db": db,
  "./lib/validation": validation,
  "./lib/rate-limit": limits,
  "next/cache": { revalidatePath() {} },
  "next/navigation": {
    redirect: (path) => {
      throw new Error("redirect:" + path);
    },
  },
});
const form = (values) => {
  const f = new FormData();
  Object.entries(values).forEach(([k, v]) => f.set(k, v));
  return f;
};
const body = (text) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
async function main() {
  for (const id of ["browser-author", "browser-member", "browser-moderator"])
    await db.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        email: `${id}@example.invalid`,
        firstName: "Browser",
        lastName: "Test",
        userName: id,
      },
    });
  await db.subreddit.upsert({
    where: { name: "browser-test" },
    update: {},
    create: {
      name: "browser-test",
      userId: "browser-moderator",
      description: "Isolated browser tests",
    },
  });
  await db.notification.deleteMany();
  await db.report.deleteMany();
  await db.comment.deleteMany();
  await db.vote.deleteMany();
  await db.savedPost.deleteMany();
  await db.membership.deleteMany();
  await db.post.deleteMany();
  actor = "browser-moderator";
  await actions.updateCommunityRules(
    form({
      subName: "browser-test",
      rules: "Be kind",
      flairs: "Discussion\nQuestion",
    }),
  );
  actor = "browser-author";
  await assert.rejects(
    () =>
      actions.createPost(
        { jsonContent: body("First body") },
        form({
          subName: "browser-test",
          title: "Feature test post",
          flair: "Question",
        }),
      ),
    /redirect:/,
  );
  const post = await db.post.findFirst({
    where: { userId: actor },
    orderBy: { createdAt: "desc" },
  });
  assert.equal(post.flair, "Question");
  assert.equal(post.bodyText, "First body");
  assert.match(
    (
      await actions.createPost(
        { jsonContent: null },
        form({
          subName: "browser-test",
          title: "Invalid flair",
          flair: "Fake",
        }),
      )
    ).error,
    /flair/,
  );
  actor = "browser-member";
  await assert.rejects(
    () =>
      actions.editPost(
        { jsonContent: body("Hijacked") },
        form({ postId: post.id, title: "Hijacked" }),
      ),
    /author/,
  );
  await assert.rejects(
    () => actions.deleteContent(form({ kind: "post", id: post.id })),
    /author/,
  );
  await assert.rejects(
    () =>
      actions.updateCommunityRules(
        form({ subName: "browser-test", rules: "Hijacked", flairs: "" }),
      ),
    /moderator/,
  );
  await actions.createComment(
    form({ postId: post.id, comment: "First comment" }),
  );
  const comment = await db.comment.findFirst({ where: { postId: post.id } });
  actor = "browser-author";
  await actions.createComment(
    form({ postId: post.id, comment: "Nested reply", parentId: comment.id }),
  );
  assert.match(
    (
      await actions.createComment(
        form({
          postId: post.id,
          comment: "Invalid reply",
          parentId: "missing-parent",
        }),
      )
    ).error,
    /belong/,
  );
  assert.equal(await db.notification.count({ where: { userId: actor } }), 1);
  assert.equal(
    await db.notification.count({
      where: { userId: "browser-member", kind: "REPLY" },
    }),
    1,
  );
  await assert.rejects(
    () => actions.editComment(form({ id: comment.id, comment: "Hijacked" })),
    /author/,
  );
  actor = "browser-member";
  await actions.editComment(
    form({ id: comment.id, comment: "Edited comment" }),
  );
  await actions.deleteContent(form({ id: comment.id, kind: "comment" }));
  const deleted = await db.comment.findUnique({
    where: { id: comment.id },
    include: { replies: true },
  });
  assert.equal(deleted.text, "");
  assert.equal(deleted.replies.length, 1);
  const community = await db.subreddit.findUnique({
    where: { name: "browser-test" },
  });
  await actions.setMembership(
    form({ subredditId: community.id, join: "true", userId: "browser-author" }),
  );
  await actions.setMembership(
    form({ subredditId: community.id, join: "true" }),
  );
  assert.equal(await db.membership.count(), 1);
  await actions.setMembership(
    form({ subredditId: community.id, join: "false" }),
  );
  assert.equal(await db.membership.count(), 0);
  await actions.setSavedPost(form({ postId: post.id, save: "true" }));
  await actions.setSavedPost(form({ postId: post.id, save: "true" }));
  assert.equal(await db.savedPost.count(), 1);
  await actions.setSavedPost(form({ postId: post.id, save: "false" }));
  assert.equal(await db.savedPost.count(), 0);
  await actions.reportContent(
    form({ kind: "post", id: post.id, reason: "Spam" }),
  );
  assert.match(
    (
      await actions.reportContent(
        form({ kind: "post", id: post.id, reason: "Spam twice" }),
      )
    ).message,
    /awaiting moderator review/,
  );
  const report = await db.report.findFirst({ where: { postId: post.id } });
  assert.equal(await db.report.count({ where: { postId: post.id } }), 1);
  await assert.rejects(
    () =>
      actions.resolveReport(form({ reportId: report.id, decision: "remove" })),
    /moderator/,
  );
  actor = "browser-moderator";
  assert.match(
    (
      await actions.updateCommunityRules(
        form({
          subName: "browser-test",
          rules: "Draft",
          flairs: "Question\nQuestion",
        }),
      )
    ).error,
    /unique flair/,
  );
  assert.match(
    (await actions.createComment(form({ postId: post.id, comment: "   " })))
      .error,
    /Invalid comment/,
  );
  // The site moderator can manage a community owned by a different account.
  actor = "kp_3554467a11f2440cbb959123e0f4b1e8";
  await actions.updateCommunityRules(
    form({
      subName: "browser-test",
      rules: "Site moderation",
      flairs: "Question",
    }),
  );
  assert.equal(
    (await db.subreddit.findUnique({ where: { name: "browser-test" } })).rules,
    "Site moderation",
  );
  assert.equal(
    (
      await actions.updateSubDescription(
        {},
        form({
          subName: "browser-test",
          description: "Site-reviewed community",
        }),
      )
    ).status,
    "green",
  );
  await assert.rejects(
    () =>
      actions.editPost(
        { jsonContent: body("Moderator cannot impersonate author") },
        form({ postId: post.id, title: "Changed" }),
      ),
    /author/,
  );
  await actions.resolveReport(
    form({ reportId: report.id, decision: "dismiss" }),
  );
  actor = "browser-member";
  assert.match(
    (
      await actions.reportContent(
        form({ kind: "post", id: post.id, reason: "Again" }),
      )
    ).message,
    /has reviewed/,
  );
  assert.equal(
    await db.report.count({ where: { postId: post.id, resolvedAt: null } }),
    0,
  );
  actor = "browser-author";
  await actions.reportContent(
    form({ kind: "post", id: post.id, reason: "New reporter" }),
  );
  const openReport = await db.report.findFirst({
    where: { postId: post.id, resolvedAt: null },
  });
  actor = "kp_3554467a11f2440cbb959123e0f4b1e8";
  await actions.resolveReport(
    form({ reportId: openReport.id, decision: "remove" }),
  );
  assert.ok((await db.post.findUnique({ where: { id: post.id } })).removedAt);
  await assert.rejects(
    () =>
      actions.resolveReport(form({ reportId: report.id, decision: "remove" })),
    /moderator/,
  );
  actor = "browser-member";
  await actions.markNotificationsRead(form({ userId: "browser-author" }));
  assert.equal(
    await db.notification.count({ where: { userId: actor, readAt: null } }),
    0,
  );
  assert.equal(
    await db.notification.count({
      where: { userId: "browser-author", readAt: null },
    }),
    1,
  );
  actor = null;
  await assert.rejects(
    () => actions.setSavedPost(form({ postId: post.id, save: "true" })),
    /redirect:\/api\/auth\/login/,
  );
  const { getFeed } = load("app/lib/feed.ts", {
    "./db": db,
    "./validation": validation,
  });
  const a = await db.post.create({
    data: {
      title: "Older top",
      bodyText: "SearchableBody",
      subName: community.name,
      userId: "browser-author",
      createdAt: new Date(Date.now() - 172800000),
    },
  });
  const b = await db.post.create({
    data: {
      title: "Newest",
      subName: community.name,
      userId: "browser-author",
    },
  });
  await db.vote.create({
    data: { postId: a.id, userId: "browser-member", voteType: "UP" },
  });
  assert.equal((await getFeed({ sort: "top" })).posts[0].id, a.id);
  assert.equal((await getFeed({ sort: "new" })).posts[0].id, b.id);
  assert.equal((await getFeed({ q: "SearchableBody" })).count, 1);
  assert.equal((await getFeed({ q: "%", sort: "top" })).count, 0);
  assert.equal((await getFeed({ time: "day" })).count, 1);
  assert.equal(
    (await getFeed({ feed: "home" }, { userId: "browser-member" })).count,
    0,
  );
  await db.membership.create({
    data: { userId: "browser-member", subredditId: community.id },
  });
  assert.equal(
    (await getFeed({ feed: "home" }, { userId: "browser-member" })).count,
    2,
  );
  assert.equal((await getFeed({ q: "'; DROP TABLE Post; --" })).count, 0);
  actor = "browser-author";
  await db.post.updateMany({
    where: { userId: actor },
    data: { createdAt: new Date(Date.now() - 120000) },
  });
  for (let i = 0; i < 3; i++) {
    await assert.rejects(
      () =>
        actions.createPost(
          { jsonContent: body("Rate check") },
          form({ subName: community.name, title: `Rate check ${i}` }),
        ),
      /redirect:/,
    );
  }
  const recentPost = await db.post.findFirst({
    where: { title: "Rate check 0", userId: actor },
  });
  await actions.deleteContent(form({ id: recentPost.id, kind: "post" }));
  assert.match(
    (
      await actions.createPost(
        { jsonContent: null },
        form({ subName: community.name, title: "Fourth post" }),
      )
    ).error,
    /too quickly/,
  );
  assert.match(
    (
      await actions.createComment(
        form({
          postId: recentPost.id,
          comment: "Cannot reply to deleted post",
        }),
      )
    ).error,
    /unavailable/,
  );
  await assert.rejects(
    () =>
      actions.handleVote(form({ postId: recentPost.id, voteDirection: "UP" })),
    /unavailable/,
  );
  await db.post.update({
    where: { id: a.id },
    data: { createdAt: new Date(Date.now() - 172800000) },
  });
  console.log(
    "Real PostgreSQL feature checks passed: ownership, edits/deletion, threads, subscriptions, saves, reports/moderation, rules/flair and notification privacy.",
  );
}
main()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
