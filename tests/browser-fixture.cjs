// Create another user's interactions in the isolated database; browsers still use real Kinde sessions.
const { PrismaClient } = require("@prisma/client");
const { load } = require("./load-ts.cjs");
if (
  process.env.FEATURE_TEST_URL !==
  "postgresql://browser_test@127.0.0.1:55440/postgres"
)
  throw new Error("Isolated database required");
const db = new PrismaClient({
  datasources: { db: { url: process.env.FEATURE_TEST_URL } },
});
const actions = load("app/actions.ts", {
  "./lib/moderation": load("app/lib/moderation.ts", { "server-only": {} }),
  "./lib/restrictions": require("./load-restrictions.cjs")(db),
  "@kinde-oss/kinde-auth-nextjs/server": {
    getKindeServerSession: () => ({
      getUser: async () => ({ id: "browser-member" }),
    }),
  },
  "./lib/db": db,
  "./lib/validation": load("app/lib/validation.ts"),
  "./lib/rate-limit": load("app/lib/rate-limit.ts", { "./db": db, "./restrictions": require("./load-restrictions.cjs")(db) }),
  "next/cache": { revalidatePath() {} },
  "next/navigation": {
    redirect: () => {
      throw new Error("Sign in required");
    },
  },
});
async function main() {
  const post = await db.post.findFirstOrThrow({
    where: {
      title: "Edited browser walkthrough",
      deletedAt: null,
      removedAt: null,
    },
    select: { id: true, userId: true },
  });
  const parent = await db.comment.findFirstOrThrow({
    where: { postId: post.id, userId: post.userId, deletedAt: null },
    select: { id: true },
  });
  for (const [text, parentId] of [
    ["Member comment for moderation", ""],
    ["A member replied to your comment", parent.id],
  ]) {
    const form = new FormData();
    form.set("postId", post.id);
    form.set("comment", text);
    form.set("parentId", parentId);
    await actions.createComment(form);
  }
  console.log(
    "Two fictional-member interactions created through actual server actions in the isolated database.",
  );
}
main()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
