import { Prisma } from "@prisma/client";
import prisma from "./db";
import { pageNumber } from "./validation";

export type FeedQuery = {
  page?: string;
  q?: string;
  sort?: string;
  time?: string;
  feed?: string;
};
export const postSelect = {
  id: true,
  title: true,
  createdAt: true,
  bodyText: true,
  textContent: true,
  imageString: true,
  subName: true,
  flair: true,
  User: { select: { userName: true } },
  Vote: { select: { userId: true, voteType: true } },
  _count: {
    select: { Comment: { where: { deletedAt: null, removedAt: null } } },
  },
} satisfies Prisma.PostSelect;

export async function getFeed(
  query: FeedQuery,
  scope: {
    subName?: string;
    authorId?: string;
    savedBy?: string;
    userId?: string;
  } = {},
) {
  // ponytail: ILIKE scans post text; add a PostgreSQL search index if measured search latency grows.
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const since =
    query.time === "day"
      ? new Date(Date.now() - 86400000)
      : query.time === "week"
        ? new Date(Date.now() - 604800000)
        : new Date(0);
  const filters = Prisma.sql`EXISTS (SELECT 1 FROM "Subreddit" community WHERE community.name = p."subName" AND community."removedAt" IS NULL) AND p."deletedAt" IS NULL AND p."removedAt" IS NULL AND p."createdAt" >= ${since}
    AND (p.title ILIKE ${like} OR p."bodyText" ILIKE ${like})
    ${scope.subName ? Prisma.sql`AND p."subName" = ${scope.subName}` : Prisma.empty}
    ${scope.authorId ? Prisma.sql`AND p."userId" = ${scope.authorId}` : Prisma.empty}
    ${scope.savedBy ? Prisma.sql`AND EXISTS (SELECT 1 FROM "SavedPost" s WHERE s."postId" = p.id AND s."userId" = ${scope.savedBy})` : Prisma.empty}
    ${query.feed === "home" ? Prisma.sql`AND EXISTS (SELECT 1 FROM "Membership" m JOIN "Subreddit" r ON r.id = m."subredditId" WHERE r.name = p."subName" AND m."userId" = ${scope.userId || ""})` : Prisma.empty}`;
  const [totals, ids] = await prisma.$transaction([
    prisma.$queryRaw<
      { count: bigint }[]
    >`SELECT COUNT(*) AS count FROM "Post" p WHERE ${filters}`,
    prisma.$queryRaw<
      { id: string }[]
    >`SELECT p.id FROM "Post" p LEFT JOIN "Vote" v ON v."postId" = p.id WHERE ${filters}
      GROUP BY p.id ORDER BY ${query.sort === "top" ? Prisma.sql`COALESCE(SUM(CASE v."voteType" WHEN 'UP' THEN 1 WHEN 'DOWN' THEN -1 ELSE 0 END), 0) DESC,` : Prisma.empty}
      p."createdAt" DESC, p.id DESC LIMIT 10 OFFSET ${(pageNumber(query.page) - 1) * 10}`,
  ]);
  const posts = await prisma.post.findMany({
    where: {
      id: { in: ids.map((p) => p.id) },
      deletedAt: null,
      removedAt: null,
      Subreddit: { removedAt: null },
    },
    select: {
      ...postSelect,
      savedBy: {
        where: { userId: scope.userId || "" },
        select: { userId: true },
      },
    },
  });
  const byId = new Map(posts.map((post) => [post.id, post]));
  return {
    count: Number(totals[0].count),
    posts: ids.flatMap((p) => (byId.has(p.id) ? [byId.get(p.id)!] : [])),
  };
}
