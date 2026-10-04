import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/app/lib/db";
import { FeedFilters, PostFeed } from "@/app/components/PostFeed";
import Pagination from "@/app/components/Pagination";
import { pageNumber } from "@/app/lib/validation";
import type { FeedQuery } from "@/app/lib/feed";
export default async function Profile({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<FeedQuery & { tab?: string }>;
}) {
  const { name } = await params;
  const query = await searchParams;
  const viewer = await getKindeServerSession().getUser();
  const user = await prisma.user.findUnique({
    where: { userName: name },
    select: {
      id: true,
      userName: true,
      createdAt: true,
      _count: {
        select: {
          posts: {
            where: {
              deletedAt: null,
              removedAt: null,
              Subreddit: { removedAt: null },
            },
          },
          Comment: {
            where: {
              deletedAt: null,
              removedAt: null,
              Post: {
                deletedAt: null,
                removedAt: null,
                Subreddit: { removedAt: null },
              },
            },
          },
        },
      },
    },
  });
  if (!user) notFound();
  const comments =
    query.tab === "comments"
      ? await prisma.comment.findMany({
          where: {
            userId: user.id,
            deletedAt: null,
            removedAt: null,
            Post: {
              deletedAt: null,
              removedAt: null,
              Subreddit: { removedAt: null },
            },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 10,
          skip: (pageNumber(query.page) - 1) * 10,
          select: {
            id: true,
            text: true,
            postId: true,
            Post: { select: { title: true, subName: true } },
          },
        })
      : [];
  return (
    <main className="page-single space-y-4">
      <h1 className="text-2xl font-semibold">u/{user.userName}</h1>
      <p className="text-sm text-muted-foreground">
        Joined {user.createdAt.toLocaleDateString("en-US")} ·{" "}
        {user._count.posts} posts · {user._count.Comment} comments
      </p>
      <nav className="flex gap-4 border-b pb-3">
        <Link
          href={`/u/${name}`}
          aria-current={query.tab !== "comments" ? "page" : undefined}
        >
          Posts
        </Link>
        <Link
          href={`/u/${name}?tab=comments`}
          aria-current={query.tab === "comments" ? "page" : undefined}
        >
          Comments
        </Link>
      </nav>
      {query.tab === "comments" ? (
        <>
          {!comments.length && <p>No comments yet.</p>}
          {comments.map((comment) => (
            <article className="rounded border p-4" key={comment.id}>
              <Link
                className="text-primary underline"
                href={`/post/${comment.postId}#comment-${comment.id}`}
              >
                {comment.Post?.title} · r/{comment.Post?.subName}
              </Link>
              <p className="whitespace-pre-wrap break-words mt-2">
                {comment.text}
              </p>
            </article>
          ))}
          <Pagination totalPages={Math.ceil(user._count.Comment / 10)} />
        </>
      ) : (
        <>
          <FeedFilters key={JSON.stringify(query)} query={query} />
          <PostFeed query={query} authorId={user.id} userId={viewer?.id} />
        </>
      )}
    </main>
  );
}
