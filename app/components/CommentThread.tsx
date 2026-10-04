import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { CommentForm } from "./CommentForm";
import { ContentActions } from "./ContentActions";
type ThreadComment = {
  id: string;
  parentId: string | null;
  text: string;
  userId: string | null;
  deletedAt: Date | null;
  removedAt: Date | null;
  editedAt: Date | null;
  User: { userName: string | null } | null;
};

export function CommentThread({
  comments,
  postId,
  userId,
  canReply,
}: {
  comments: ThreadComment[];
  postId: string;
  userId?: string;
  canReply: boolean;
}) {
  const children = new Map<string | null, ThreadComment[]>();
  for (const comment of comments) {
    if (!children.has(comment.parentId)) children.set(comment.parentId, []);
    children.get(comment.parentId)!.push(comment);
  }
  function thread(parent: string | null, depth = 0): React.ReactNode {
    return children.get(parent)?.map((comment) => (
      <details
        key={comment.id}
        id={`comment-${comment.id}`}
        open
        className="thread my-4 min-w-0 border-l pl-3"
      >
        <summary>
          <ChevronDown
            className="thread-chevron h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="font-semibold">
            {comment.deletedAt ? (
              "[deleted]"
            ) : comment.removedAt ? (
              "[removed]"
            ) : (
              <Link
                href={`/u/${comment.User?.userName}`}
                className="hover:text-primary"
              >
                u/{comment.User?.userName || "deleted"}
              </Link>
            )}
          </span>
          {comment.editedAt && !comment.deletedAt && !comment.removedAt && (
            <span className="text-xs text-muted-foreground">edited</span>
          )}
          <span className="thread-collapsed hidden text-xs text-muted-foreground">
            Thread collapsed
          </span>
          <span className="sr-only">Toggle comment thread</span>
        </summary>
        <div className="min-w-0 break-words pl-2">
          <p className="my-2 whitespace-pre-wrap text-sm leading-relaxed">
            {comment.deletedAt
              ? "[deleted]"
              : comment.removedAt
                ? "Removed by moderator"
                : comment.text}
          </p>
          <div className="flex items-center gap-2">
            {!comment.deletedAt && !comment.removedAt && (
              <ContentActions
                id={comment.id}
                kind="comment"
                owner={!!userId && userId === comment.userId}
                text={comment.text}
              />
            )}
            {canReply && depth < 9 && (
              <details>
                <summary className="inline-flex min-h-11 items-center text-sm font-medium text-primary">
                  Reply
                </summary>
                <CommentForm postId={postId} parentId={comment.id} />
              </details>
            )}
          </div>
          <div className={depth < 3 ? "ml-1 sm:ml-3" : ""}>
            {thread(comment.id, depth + 1)}
          </div>
        </div>
      </details>
    ));
  }
  return (
    <div id="comments">
      {comments.length ? (
        thread(null)
      ) : (
        <p className="rounded-xl bg-muted p-5 text-sm text-muted-foreground">
          No replies yet. Be the first to share your perspective.
        </p>
      )}
    </div>
  );
}
