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
import { Bookmark } from "lucide-react";
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
  return (
    <main className="page-grid">
      <div className="min-w-0">
        <Link
          href={`/r/${post.subName}`}
          className="mb-3 inline-flex min-h-11 items-center text-sm text-primary"
        >
          Back to {post.subName}
        </Link>
        <Card className="p-4 shadow-none sm:p-6">
          {available && (
            <VoteControls
              postId={id}
              {...getVoteSummary(post.Vote, user?.id)}
              className="mb-4 inline-flex items-center rounded-xl bg-muted text-sm font-semibold tabular-nums"
            />
          )}
          <div className="min-w-0 break-words">
            <p className="text-xs text-muted-foreground">
              {available ? (
                <Link href={`/u/${post.User?.userName}`}>
                  Posted by u/{post.User?.userName}
                </Link>
              ) : (
                "Content unavailable"
              )}
            </p>
            <time
              dateTime={post.createdAt.toISOString()}
              className="text-xs text-muted-foreground"
            >
              {post.createdAt.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}
            </time>
            <h1 className="my-3 text-2xl font-semibold leading-snug sm:text-3xl">
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
                    alt="Post image"
                    width={500}
                    height={400}
                    className="mt-4 max-h-[600px] w-full rounded-xl bg-muted object-contain"
                  />
                )}
                {post.textContent && <RenderToJson data={post.textContent} />}
                <div className="flex flex-wrap gap-4 items-center mt-3">
                  <span className="text-sm text-muted-foreground">
                    {
                      post.Comment.filter((c) => !c.deletedAt && !c.removedAt)
                        .length
                    }{" "}
                    {post.Comment.filter((c) => !c.deletedAt && !c.removedAt)
                      .length === 1
                      ? "Comment"
                      : "Comments"}
                  </span>
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
                  <div className="ml-auto">
                    <ContentActions
                      id={id}
                      kind="post"
                      owner={!!user && user.id === post.userId}
                    />
                  </div>
                </div>
                <RestrictionNotice subName={post.subName ?? undefined} />
                <CommentForm postId={id} />
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
        </Card>
      </div>
      <aside>
        <Card className="p-5 space-y-4 shadow-none xl:sticky xl:top-24">
          <h2 className="font-semibold">About Community</h2>
          <Link href={`/r/${post.subName}`} className="text-primary">
            r/{post.subName}
          </Link>
          <p className="text-sm">{post.Subreddit?.description}</p>
          <h3 className="font-medium">Rules</h3>
          <p className="text-sm whitespace-pre-wrap">
            {post.Subreddit?.rules || "Be respectful."}
          </p>
          <Link
            href={`/r/${post.subName}/create`}
            className="block text-primary underline"
          >
            Create Post
          </Link>
        </Card>
      </aside>
    </main>
  );
}
