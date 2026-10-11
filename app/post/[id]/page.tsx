import { RestrictionNotice } from "@/app/components/RestrictionNotice";
import { getVoteSummary } from "@/app/lib/votes";
import { CommentForm } from "@/app/components/CommentForm";
import { CommentThread } from "@/app/components/CommentThread";
import { ContentActions } from "@/app/components/ContentActions";
import { CopyLink } from "@/app/components/CopyLink";
import { RenderToJson } from "@/app/components/RendertoJson";
import { VoteControls } from "@/app/components/VoteControls";
import { ActionForm } from "@/app/components/ActionForm";
import { SubmitButton } from "@/app/components/SubmitButtons";
import { setSavedPost } from "@/app/actions";
import prisma from "@/app/lib/db";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { ArrowLeft, Bookmark, MessageCircle } from "lucide-react";
export const dynamic = "force-dynamic";
export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getKindeServerSession().getUser();
  // ponytail: one post's complete thread; paginate root threads if discussions become large.
  const post = await prisma.post.findFirst({
    where: { id, Subreddit: { removedAt: null } },
    select: {
      id: true,
      title: true,
      imageString: true,
      textContent: true,
      subName: true,
      userId: true,
      deletedAt: true,
      removedAt: true,
      editedAt: true,
      flair: true,
      createdAt: true,
      User: { select: { userName: true } },
      Subreddit: { select: { name: true, description: true, rules: true } },
      Vote: { select: { voteType: true, userId: true } },
      savedBy: { where: { userId: user?.id || "" }, select: { userId: true } },
      Comment: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          text: true,
          userId: true,
          parentId: true,
          createdAt: true,
          editedAt: true,
          deletedAt: true,
          removedAt: true,
          User: { select: { userName: true } },
        },
      },
    },
  });
  if (!post) notFound();
  const available = !post.deletedAt && !post.removedAt;
  const commentCount = post.Comment.filter(
    (c) => !c.deletedAt && !c.removedAt,
  ).length;
  return (
    <main className="page-grid">
      <div className="min-w-0">
        <Link
          href={`/r/${post.subName}`}
          className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to {post.subName}
        </Link>
        <article className="min-w-0">
          <div className="min-w-0 break-words">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <Link
                href={`/r/${post.subName}`}
                className="font-semibold text-foreground hover:text-primary"
              >
                r/{post.subName}
              </Link>
              <span aria-hidden="true">·</span>
              {available ? (
                <Link
                  href={`/u/${post.User?.userName}`}
                  className="hover:text-primary"
                >
                  u/{post.User?.userName}
                </Link>
              ) : (
                "Content unavailable"
              )}
              <span aria-hidden="true">·</span>
              <time
                dateTime={post.createdAt.toISOString()}
                className="text-xs text-muted-foreground"
              >
                {post.createdAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </time>
              {available && (
                <div className="ml-auto">
                  <ContentActions
                    id={id}
                    kind="post"
                    owner={!!user && user.id === post.userId}
                  />
                </div>
              )}
            </div>
            <h1 className="mb-4 mt-2 text-2xl font-semibold leading-snug sm:text-3xl">
              {post.deletedAt
                ? "[deleted]"
                : post.removedAt
                  ? "Removed by moderator"
                  : post.title}
            </h1>
            {available && (
              <>
                {post.flair && (
                  <span className="text-xs rounded bg-muted px-2 py-1">
                    {post.flair}
                  </span>
                )}
                {post.editedAt && (
                  <span className="text-xs text-muted-foreground ml-2">
                    edited
                  </span>
                )}
                {post.imageString && (
                  <Image
                    src={post.imageString}
                    alt={post.title}
                    width={800}
                    height={600}
                    sizes="(max-width: 768px) 100vw, 800px"
                    className="mt-4 max-h-[600px] w-full rounded-xl bg-muted object-contain"
                  />
                )}
                {post.textContent && <RenderToJson data={post.textContent} />}
                <div
                  role="group"
                  aria-label="Post actions"
                  className="mt-5 flex flex-wrap items-center gap-1 sm:gap-2"
                >
                  <VoteControls
                    postId={id}
                    {...getVoteSummary(post.Vote, user?.id)}
                    className="inline-flex items-center rounded-full bg-muted text-sm font-semibold tabular-nums"
                  />
                  <Link
                    href="#comments"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-muted px-3 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    {commentCount}
                    <span className="sr-only">
                      {" "}
                      {commentCount === 1 ? "comment" : "comments"}
                    </span>
                  </Link>
                  <CopyLink id={id} />
                  <ActionForm action={setSavedPost}>
                    <input type="hidden" name="postId" value={id} />
                    <input
                      type="hidden"
                      name="save"
                      value={String(!post.savedBy.length)}
                    />
                    <SubmitButton
                      text={post.savedBy.length ? "Saved" : "Save"}
                      size="sm"
                      variant="ghost"
                      pressed={!!post.savedBy.length}
                      icon={
                        <Bookmark
                          className={`h-4 w-4 ${post.savedBy.length ? "fill-current text-primary" : ""}`}
                        />
                      }
                    />
                  </ActionForm>
                </div>
                <section
                  id="comments"
                  aria-label="Comments"
                  className="mt-6 scroll-mt-40 border-t pt-1"
                >
                  <RestrictionNotice subName={post.subName ?? undefined} />
                  <CommentForm postId={id} />
                </section>
              </>
            )}
            <h2 className="font-semibold mt-5 border-t pt-4">Discussion</h2>
            <CommentThread
              comments={post.Comment}
              postId={id}
              userId={user?.id}
              canReply={available}
            />
          </div>
        </article>
      </div>
      <aside>
        <Card className="p-5 space-y-4 shadow-none xl:sticky xl:top-24">
          <h2 className="font-semibold">
            <Link href={`/r/${post.subName}`} className="hover:text-primary">
              r/{post.subName}
            </Link>
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {post.Subreddit?.description}
          </p>
          <h3 className="font-medium">Rules</h3>
          <p className="text-sm whitespace-pre-wrap">
            {post.Subreddit?.rules || "Be respectful."}
          </p>
          <Link
            href={`/r/${post.subName}/create`}
            className="flex min-h-11 items-center justify-center rounded-xl border text-sm font-medium hover:bg-muted"
          >
            Create Post
          </Link>
        </Card>
      </aside>
    </main>
  );
}
