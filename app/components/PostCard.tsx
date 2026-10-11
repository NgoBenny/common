import { Card } from "@/components/ui/card";
import { Bookmark, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CopyLink } from "./CopyLink";
import { VoteControls } from "./VoteControls";
import { RenderToJson } from "./RendertoJson";
import { ActionForm } from "./ActionForm";
import { setSavedPost } from "../actions";
import { SubmitButton } from "./SubmitButtons";

interface PostCardProps {
  title: string;
  jsonContent: unknown;
  bodyText?: string;
  id: string;
  subName: string;
  userName: string;
  imageString: string | null;
  voteCount: number;
  commentAmount: number;
  createdAt?: Date;
  currentVote?: "UP" | "DOWN";
  flair?: string | null;
  saved?: boolean;
}

export function PostCard({
  id,
  imageString,
  jsonContent,
  bodyText,
  subName,
  title,
  userName,
  voteCount,
  commentAmount,
  currentVote,
  flair,
  createdAt,
  saved = false,
}: PostCardProps) {
  return (
    <Card className="overflow-hidden shadow-none">
      <article className="min-w-0 break-words p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Link
            className="font-semibold text-foreground hover:text-primary"
            href={`/r/${subName}`}
          >
            {subName}
          </Link>
          <span aria-hidden="true">·</span>
          <Link href={`/u/${userName}`} className="hover:text-primary">
            u/{userName}
          </Link>
          {createdAt && (
            <>
              <span aria-hidden="true">·</span>
              <time
                dateTime={createdAt.toISOString()}
                title={createdAt.toISOString()}
              >
                {createdAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </time>
            </>
          )}
          {flair && (
            <span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">
              {flair}
            </span>
          )}
        </div>
        <Link href={`/post/${id}`} className="hover:text-primary">
          <h2 className="text-lg font-semibold leading-snug sm:text-xl">
            {title}
          </h2>
        </Link>
        {imageString ? (
          <Link
            href={`/post/${id}`}
            aria-label={`Open image post: ${title}`}
            className="mt-4 block overflow-hidden rounded-xl bg-muted"
          >
            <Image
              src={imageString}
              alt={title}
              width={700}
              height={420}
              sizes="(max-width: 640px) 100vw, 700px"
              className="max-h-[360px] w-full object-contain"
            />
          </Link>
        ) : jsonContent ? (
          <div className="mt-3">
            {bodyText ? (
              <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {bodyText}
              </p>
            ) : (
              <div className="max-h-32 overflow-hidden">
                <RenderToJson data={jsonContent} />
              </div>
            )}
            {bodyText && bodyText.length > 240 && (
              <Link
                href={`/post/${id}`}
                className="inline-flex min-h-11 items-center text-xs font-medium text-primary"
              >
                Read discussion
              </Link>
            )}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-1 border-t pt-3 sm:gap-3">
          <VoteControls
            postId={id}
            voteCount={voteCount}
            currentVote={currentVote}
            className="flex items-center rounded-full bg-muted text-sm font-semibold tabular-nums"
          />
          <Link
            href={`/post/${id}#comments`}
            className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            <MessageCircle className="h-4 w-4" />
            <span>
              {commentAmount} <span className="hidden sm:inline">Comments</span>
            </span>
            <span className="sr-only sm:hidden">comments</span>
          </Link>
          <CopyLink id={id} />
          <ActionForm action={setSavedPost} className="ml-auto">
            <input type="hidden" name="postId" value={id} />
            <input type="hidden" name="save" value={String(!saved)} />
            <SubmitButton
              text={saved ? "Saved" : "Save"}
              size="sm"
              variant="ghost"
              pressed={saved}
              icon={
                <Bookmark
                  className={`h-4 w-4 ${saved ? "fill-current text-primary" : ""}`}
                />
              }
            />
          </ActionForm>
        </div>
      </article>
    </Card>
  );
}
