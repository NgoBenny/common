const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { Prisma } = require("@prisma/client");

const { load } = require("./load-ts.cjs");
const validation = load("app/lib/validation.ts");
const form = (values) => {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
};

async function main() {
  const config = (await import("../next.config.mjs")).default;
  const headers = Object.fromEntries(
    (await config.headers())[0].headers.map(({ key, value }) => [key, value]),
  );
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(config.experimental.serverActions.bodySizeLimit, "1mb");
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.equal(config.poweredByHeader, false);
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { getVoteSummary } = load("app/lib/votes.ts");
  const sampleVotes = [
    { userId: "owner", voteType: "UP" },
    { userId: "other", voteType: "DOWN" },
  ];
  assert.equal(getVoteSummary(sampleVotes, "owner").voteCount, 0);
  assert.equal(getVoteSummary(sampleVotes, "owner").currentVote, "UP");
  assert.equal(getVoteSummary(sampleVotes).currentVote, undefined);
  assert.equal(getVoteSummary([]).voteCount, 0);
  let pending = false;
  const buttons = load("app/components/SubmitButtons.tsx", {
    "@/components/ui/button": {
      Button: (props) => React.createElement("button", props),
    },
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
    "react-dom": { useFormStatus: () => ({ pending }) },
  });
  for (const direction of ["UP", "DOWN"]) {
    const html = renderToStaticMarkup(
      React.createElement(buttons.VoteButton, { direction, active: true }),
    );
    assert.match(
      html,
      new RegExp(`aria-label="${direction.toLowerCase()}vote"`),
    );
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /fill-primary\/20/);
  }
  pending = true;
  assert.match(
    renderToStaticMarkup(
      React.createElement(buttons.VoteButton, { direction: "UP" }),
    ),
    /disabled/,
  );
  assert.match(
    renderToStaticMarkup(
      React.createElement(buttons.SubmitButton, { text: "Save" }),
    ),
    /Please wait/,
  );
  const { VoteControls } = load("app/components/VoteControls.tsx", {
    "../actions": { handleVote: "/vote" },
    "./SubmitButtons": buttons,
  });
  const controls = renderToStaticMarkup(
    React.createElement(VoteControls, {
      postId: "post-123",
      voteCount: 5,
      currentVote: "UP",
      className: "votes",
    }),
  );
  assert.equal(
    (controls.match(/name="postId" value="post-123"/g) || []).length,
    2,
  );
  assert.match(controls, /name="voteDirection" value="UP"/);
  assert.match(controls, /name="voteDirection" value="DOWN"/);
  assert.match(controls, /<\/form>5<form/);
  const notifications = [];
  let commentError;
  let commentResult;
  let refs;
  let commentClears = 0;
  const { ActionForm } = load("app/components/ActionForm.tsx", {
    react: {
      ...React,
      useState: () => ["", () => {}],
      useRef: (value) => {
        const ref = { current: value };
        refs.push(ref);
        return ref;
      },
    },
    "@/components/ui/use-toast": {
      useToast: () => ({ toast: (notice) => notifications.push(notice) }),
    },
  });
  refs = [];
  for (const status of ["", "green", "error"]) {
    const legacyForm = ActionForm({
      action: async () => ({ status, message: status ? "test" : "" }),
    });
    await legacyForm.props.action(new FormData());
  }
  assert.equal(notifications.length, 2);
  assert.equal(notifications[0].title, "test");
  assert.equal(notifications[1].variant, "destructive");
  const { CommentForm } = load("app/components/CommentForm.tsx", {
    react: { ...React, useState: () => ["Draft", () => commentClears++] },
    "@/components/ui/label": { Label: "label" },
    "@/components/ui/textarea": { Textarea: "textarea" },
    "./SubmitButtons": buttons,
    "./ActionForm": { ActionForm },
    "../actions": {
      createComment: async () => {
        if (commentError) throw commentError;
        return commentResult;
      },
    },
    "@/components/ui/use-toast": {
      useToast: () => ({ toast: (notice) => notifications.push(notice) }),
    },
  });
  refs = [];
  const sharedForm = ActionForm(CommentForm({ postId: "post" }).props);
  const commentAction = sharedForm.props.action;
  await commentAction(new FormData());
  assert.equal(commentClears, 1, "Successful comments clear the draft");
  commentError = (() => {
    try {
      require("next/navigation").redirect("/api/auth/login");
    } catch (error) {
      return error;
    }
  })();
  await assert.rejects(
    () => commentAction(new FormData()),
    (error) => error === commentError,
  );
  assert.equal(notifications.length, 2);
  commentError = new Error("Database unavailable");
  await commentAction(new FormData());
  assert.equal(notifications.length, 3);
  assert.equal(commentClears, 1, "Failed comments must preserve the draft");
  commentError = undefined;
  commentResult = { error: "Please try again shortly" };
  await commentAction(new FormData());
  assert.equal(
    commentClears,
    1,
    "Rate-limited comments must preserve the draft",
  );
  assert.equal(notifications.at(-1).description, commentResult.error);
  // Exercise the actual composer handler: redirects must not show failure toasts.
  const source = ts.createSourceFile(
    "composer.tsx",
    fs.readFileSync("app/components/PostComposer.tsx", "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let handler;
  function findHandler(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "submitPost")
      handler = node.getText(source);
    ts.forEachChild(node, findHandler);
  }
  findHandler(source);
  assert.ok(handler);
  let notices = 0;
  const { unstable_rethrow, redirect } = require("next/navigation");
  const successRedirect = (() => {
    try {
      redirect("/post/test");
    } catch (error) {
      return error;
    }
  })();
  const composer = vm.runInNewContext(
    ts.transpileModule(`(${handler})`, {}).outputText,
    {
      createPost: async () => {
        throw successRedirect;
      },
      unstable_rethrow,
      serializeEditorContent: load("app/lib/editor-content.ts").serializeEditorContent,
      toast: () => notices++,
      json: null,
      post: undefined,
      setError: () => {},
    },
  );
  await assert.rejects(
    () => composer(new FormData()),
    (error) => error === successRedirect,
  );
  assert.equal(notices, 0);
  const failedComposer = vm.runInNewContext(
    ts.transpileModule(`(${handler})`, {}).outputText,
    {
      createPost: async () => {
        throw new Error("Database unavailable");
      },
      unstable_rethrow,
      serializeEditorContent: load("app/lib/editor-content.ts").serializeEditorContent,
      toast: () => notices++,
      json: null,
      post: undefined,
      setError: () => {},
    },
  );
  await failedComposer(new FormData());
  assert.equal(notices, 1);
  for (const value of [
    undefined,
    "",
    "0",
    "-1",
    "1.5",
    "NaN",
    "Infinity",
    "100001",
    ["2"],
  ])
    assert.equal(validation.pageNumber(value), 1);
  assert.equal(validation.pageNumber("3"), 3);
  assert.equal(validation.validName("test_community"), true);
  assert.equal(validation.validName("../create"), false);
  assert.equal(validation.validImage("https://utfs.io/f/image.png"), true);
  assert.equal(
    validation.validImage("https://utfs.io.evil.test/f/image.png"),
    false,
  );
  assert.throws(() =>
    validation.formText(form({ comment: "  " }), "comment", 5000),
  );
  assert.throws(() =>
    validation.formText(form({ title: "x".repeat(301) }), "title", 300),
  );
  const doc = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2, onclick: "alert(1)" },
        content: [
          {
            type: "text",
            text: "<script>bad</script>",
            marks: [{ type: "bold" }],
          },
        ],
      },
    ],
  };
  assert.equal(validation.validRichText(doc), true);
  const sanitized = validation.postBody(doc);
  assert.equal(
    JSON.stringify(sanitized.textContent).includes("onclick"),
    false,
  );
  assert.equal(sanitized.bodyText, "<script>bad</script>");
  assert.equal(sanitized.textContent.content[0].attrs.level, 2);
  assert.equal(
    validation.validRichText({ type: "doc", content: "invalid" }),
    false,
  );
  assert.equal(validation.validRichText({ type: "script" }), false);
  assert.equal(
    validation.validRichText({
      type: "text",
      text: "x",
      marks: [{ type: "constructor" }],
    }),
    false,
  );
  let deep = { type: "text", text: "x" };
  for (let i = 0; i < 22; i++) deep = { type: "doc", content: [deep] };
  assert.equal(validation.validRichText(deep), false);
  const { RenderToJson } = load("app/components/RendertoJson.tsx", {
    "../lib/validation": validation,
  });
  const html = require("react-dom/server").renderToStaticMarkup(
    require("react").createElement(RenderToJson, { data: doc }),
  );
  assert.match(html, /<h2><strong>&lt;script&gt;/);
  assert.ok(!html.includes("onclick"));
  assert.equal(RenderToJson({ data: null }), null);

  let user = { id: "owner" },
    votes = [],
    writes = 0,
    failures = 0;
  const invalidations = [];
  const recentCounts = { post: 0, comment: 0, subreddit: 0 };
  const countRecent =
    (kind) =>
    async ({ where }) => {
      assert.equal(where.userId, user.id);
      assert.equal(typeof where.createdAt.gte.getTime, "function");
      return recentCounts[kind];
    };
  const prisma = {
    subreddit: {
      findUnique: async () => ({ flairs: [] }),
      count: countRecent("subreddit"),
      updateMany: async ({ where }) => {
        assert.equal(where.userId, user.id);
        if (where.userId === "owner") {
          writes++;
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    post: {
      findFirst: async () => ({ id: "post", userId: "owner" }),
      count: countRecent("post"),
      create: async () => {
        writes++;
        return { id: "post" };
      },
    },
    comment: {
      count: countRecent("comment"),
      create: async () => {
        writes++;
        return { id: "comment" };
      },
    },
    vote: {
      findFirst: async ({ where }) =>
        votes.find(
          (vote) =>
            vote.postId === where.postId && vote.userId === where.userId,
        ),
      deleteMany: async ({ where }) => {
        votes = votes.filter(
          (vote) =>
            vote.postId !== where.postId || vote.userId !== where.userId,
        );
      },
      create: async ({ data }) => {
        votes.push(data);
      },
    },
    $executeRaw: async (sql, key) => {
      assert.match(sql.join("?"), /pg_advisory_xact_lock/);
      assert.ok(key.endsWith(`:${user.id}`));
    },
    $transaction: async (fn, options) => {
      assert.ok(
        ["Serializable", "ReadCommitted"].includes(options.isolationLevel),
      );
      if (options.isolationLevel === "Serializable" && failures-- > 0)
        throw new Prisma.PrismaClientKnownRequestError("conflict", {
          code: "P2034",
          clientVersion: "5.13.0",
        });
      return fn(prisma);
    },
  };
  const rateLimit = load("app/lib/rate-limit.ts", {
    "./db": { __esModule: true, default: prisma },
  });
  const actions = load("app/actions.ts", {
    "./lib/moderation": load("app/lib/moderation.ts", { "server-only": {} }),
    "./lib/rate-limit": rateLimit,
    "./lib/validation": validation,
    "./lib/db": { __esModule: true, default: prisma },
    "@kinde-oss/kinde-auth-nextjs/server": {
      getKindeServerSession: () => ({ getUser: async () => user }),
    },
    "next/navigation": {
      redirect: (url) => {
        throw new Error(`REDIRECT:${url}`);
      },
    },
    "next/cache": { revalidatePath: (...args) => invalidations.push(args) },
  });
  user = { id: "intruder" };
  assert.equal(
    (
      await actions.updateSubDescription(
        {},
        form({ subName: "test", description: "changed" }),
      )
    ).status,
    "error",
  );
  assert.equal(writes, 0);
  user = { id: "owner" };
  assert.equal(
    (
      await actions.updateSubDescription(
        {},
        form({ subName: "test", description: "changed" }),
      )
    ).status,
    "green",
  );
  const vote = (voteDirection) =>
    actions.handleVote(form({ postId: "post", voteDirection }));
  votes = [{ postId: "other", userId: "owner", voteType: "UP" }];
  await vote("UP");
  assert.equal(votes.length, 2);
  await vote("DOWN");
  assert.equal(votes.find((v) => v.postId === "post").voteType, "DOWN");
  await vote("DOWN");
  assert.equal(votes.length, 1);
  failures = 1;
  await vote("UP");
  assert.equal(votes.length, 2);
  votes.push({ postId: "post", userId: "owner", voteType: "UP" });
  await vote("DOWN");
  assert.equal(votes.length, 2);
  assert.deepEqual(invalidations.at(-1), ["/", "layout"]);
  await assert.rejects(() => vote("INVALID"), /Invalid vote direction/);
  assert.match(
    (await actions.createComment(form({ postId: "post", comment: "  " })))
      .error,
    /Invalid comment/,
  );
  assert.match(
    (
      await actions.createPost(
        { jsonContent: null },
        form({
          title: "x",
          subName: "test",
          imageUrl: "https://evil.test/image",
        }),
      )
    ).error,
    /Invalid image URL/,
  );
  assert.match(
    (
      await actions.createPost(
        { jsonContent: { type: "doc", content: "broken" } },
        form({ title: "x", subName: "test" }),
      )
    ).error,
    /Invalid or oversized/,
  );
  for (const [kind, limit] of [
    ["post", 3],
    ["comment", 10],
    ["subreddit", 2],
  ]) {
    recentCounts[kind] = limit;
    const before = writes;
    await assert.rejects(
      () => rateLimit.createLimited(user.id, kind, async () => writes++),
      /creating content too quickly/,
    );
    assert.equal(writes, before, "Rate-limited writes must not execute");
    recentCounts[kind] = limit - 1;
    await rateLimit.createLimited(user.id, kind, async () => writes++);
    assert.equal(writes, before + 1);
    recentCounts[kind] = 0;
  }
  recentCounts.comment = 10;
  assert.match(
    (await actions.createComment(form({ postId: "post", comment: "valid" })))
      .error,
    /creating content too quickly/,
  );
  recentCounts.post = 3;
  assert.match(
    (
      await actions.createPost(
        { jsonContent: null },
        form({ title: "valid", subName: "test" }),
      )
    ).error,
    /creating content too quickly/,
  );
  recentCounts.subreddit = 2;
  assert.equal(
    (await actions.createCommunity({}, form({ name: "test" }))).status,
    "error",
  );
  let uploadGuard;
  let uploadComplete;
  load("app/api/uploadthing/core.ts", {
    "@kinde-oss/kinde-auth-nextjs/server": {
      getKindeServerSession: () => ({ getUser: async () => user }),
    },
    "uploadthing/server": { UploadThingError: class extends Error {} },
    "uploadthing/next": {
      createUploadthing: () => () => ({
        middleware(fn) {
          uploadGuard = fn;
          return this;
        },
        onUploadComplete(fn) {
          uploadComplete = fn;
          return this;
        },
      }),
    },
  });
  await uploadGuard({ files: [{ type: "image/png" }] });
  for (const type of ["image/svg+xml", "text/html", "application/javascript"]) {
    await assert.rejects(
      () => uploadGuard({ files: [{ type }] }),
      /JPEG, PNG, WebP or GIF/,
    );
  }
  assert.equal(Object.keys(await uploadComplete()).length, 0);
  user = null;
  await assert.rejects(
    () => uploadGuard({ files: [{ type: "image/png" }] }),
    /Please log in/,
  );
  const beforeUnauthenticated = writes;
  for (const attempt of [
    () => vote("UP"),
    () => actions.updateUsername({}, form({})),
    () => actions.createCommunity({}, form({})),
    () => actions.updateSubDescription({}, form({})),
    () => actions.createPost({ jsonContent: null }, form({})),
    () => actions.createComment(form({})),
  ])
    await assert.rejects(attempt, /REDIRECT:\/api\/auth\/login/);
  assert.equal(writes, beforeUnauthenticated);
  console.log(
    "Regression checks passed: validation, safe rich text, ownership, vote toggle/repair/retry, and authentication.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
