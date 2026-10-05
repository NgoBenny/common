"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "./SubmitButtons";
import { createComment } from "../actions";
import { ActionForm } from "./ActionForm";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

interface iAppProps {
  postId: string;
  parentId?: string;
  actions?: ReactNode;
}

export function CommentForm({ postId, parentId, actions }: iAppProps) {
  const [comment, setComment] = useState("");
  const [expanded, setExpanded] = useState(!parentId);
  const replyToggle = useRef<HTMLButtonElement>(null);
  const inputId = `comment-input-${parentId || postId}`;
  return (
    <div className="min-w-0">
      {parentId && (
        <div className="flex items-center gap-1">
          <Button
            ref={replyToggle}
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 gap-2 text-muted-foreground"
            aria-expanded={expanded}
            aria-controls={`${inputId}-form`}
            onClick={() => setExpanded(!expanded)}
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" /> Reply
          </Button>
          {actions}
        </div>
      )}
      {expanded && (
        <div id={`${inputId}-form`} className={parentId ? "mt-2" : "mt-5"}>
          <ActionForm
            className="rounded-xl border bg-background p-3 focus-within:border-primary"
            action={createComment}
            onSuccess={() => {
              setComment("");
              if (parentId) {
                setExpanded(false);
                replyToggle.current?.focus();
              }
            }}
          >
            <input type="hidden" name="postId" value={postId}></input>
            {parentId && (
              <input type="hidden" name="parentId" value={parentId} />
            )}
            <Label
              className={parentId ? "sr-only" : "mb-2 block"}
              htmlFor={inputId}
            >
              {parentId ? "Your reply" : "Join the conversation"}
            </Label>
            <Textarea
              id={inputId}
              required
              maxLength={5000}
              placeholder={
                parentId ? "Write a reply…" : "Share your perspective…"
              }
              rows={3}
              autoFocus={!!parentId}
              className="min-h-24 w-full resize-y border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              name="comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
            <div className="mt-2 flex justify-end gap-2">
              {parentId && (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11"
                  onClick={() => {
                    setExpanded(false);
                    replyToggle.current?.focus();
                  }}
                >
                  Cancel
                </Button>
              )}
              <SubmitButton
                text={parentId ? "Reply" : "Comment"}
                disabled={!comment.trim()}
                size="sm"
              />
            </div>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
