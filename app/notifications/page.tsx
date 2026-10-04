import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "../lib/db";
import { pageNumber } from "../lib/validation";
import Pagination from "../components/Pagination";
import { ActionForm } from "../components/ActionForm";
import { SubmitButton } from "../components/SubmitButtons";
import { markNotificationsRead } from "../actions";
import { Bell } from "lucide-react";
export default async function Notifications({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getKindeServerSession().getUser();
  if (!user) redirect("/api/auth/login");
  const query = await searchParams;
  const [count, notices] = await prisma.$transaction([
    prisma.notification.count({
      where: { userId: user.id, Post: { Subreddit: { removedAt: null } } },
    }),
    prisma.notification.findMany({
      where: { userId: user.id, Post: { Subreddit: { removedAt: null } } },
      take: 20,
      skip: (pageNumber(query.page) - 1) * 20,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        kind: true,
        createdAt: true,
        readAt: true,
        postId: true,
        commentId: true,
        Post: { select: { title: true, deletedAt: true, removedAt: true } },
      },
    }),
  ]);
  return (
    <main className="page-single space-y-4">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      {count > 0 && (
        <ActionForm
          action={markNotificationsRead}
          success="All notifications marked as read"
        >
          <SubmitButton text="Mark all as read" />
        </ActionForm>
      )}
      {!notices.length && (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Bell className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-4 text-xl font-semibold">You’re all caught up</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Replies to your comments and conversations will appear here.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex min-h-11 items-center text-primary underline"
          >
            Explore conversations
          </Link>
        </div>
      )}
      {notices.map((n) => (
        <article
          key={n.id}
          className={`border rounded-2xl bg-card p-5 ${!n.readAt ? "border-primary" : ""}`}
        >
          <Link href={`/post/${n.postId}#comment-${n.commentId}`}>
            {!n.readAt && <strong>Unread · </strong>}
            {n.kind === "REPLY"
              ? "Someone replied to your comment"
              : "Someone commented on your post"}
            <span className="block text-sm text-muted-foreground">
              {n.Post.deletedAt || n.Post.removedAt
                ? "Content unavailable"
                : n.Post.title}
            </span>
            <time
              dateTime={n.createdAt.toISOString()}
              className="mt-2 block text-xs text-muted-foreground"
            >
              {n.createdAt.toLocaleDateString("en-US", { timeZone: "UTC" })}
            </time>
          </Link>
        </article>
      ))}
      <Pagination totalPages={Math.ceil(count / 20)} />
    </main>
  );
}
