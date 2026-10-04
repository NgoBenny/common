"use client";
import Link from "next/link";
import { useState } from "react";
import { MoreHorizontal, Pencil, Flag, Trash2 } from "lucide-react";
import { deleteContent, editComment, reportContent } from "../actions";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButtons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export function ContentActions({
  id,
  kind,
  owner,
  text,
}: {
  id: string;
  kind: "post" | "comment";
  owner: boolean;
  text?: string;
}) {
  const [mode, setMode] = useState<"edit" | "delete" | "report" | null>(null);
  const [comment, setComment] = useState(text ?? "");
  const [reason, setReason] = useState("");
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-muted-foreground"
            aria-label={`More ${kind} options`}
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          collisionPadding={{ top: 80, bottom: 96, left: 12, right: 12 }}
          className="min-w-48 [&_[role=menuitem]]:min-h-11"
        >
          {owner && (
            <>
              {kind === "post" ? (
                <DropdownMenuItem asChild>
                  <Link href={`/post/${id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit post
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onSelect={() => {
                    setComment(text ?? "");
                    setMode("edit");
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit comment
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive dark:text-red-300"
                onSelect={() => setMode("delete")}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete {kind}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={() => setMode("report")}>
            <Flag className="mr-2 h-4 w-4" />
            Report {kind}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open) setMode(null);
        }}
      >
        <DialogContent className="w-[calc(100%_-_2rem)] max-w-md">
          <DialogTitle>
            {mode === "edit"
              ? "Edit comment"
              : mode === "delete"
                ? `Delete ${kind}?`
                : `Report ${kind}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "delete"
              ? "This permanently clears your content. Reply threads will remain."
              : mode === "edit"
                ? "Update your reply without losing the conversation."
                : "Tell the community moderator what needs their attention."}
          </DialogDescription>
          <ActionForm
            action={
              mode === "edit"
                ? editComment
                : mode === "delete"
                  ? deleteContent
                  : reportContent
            }
            onSuccess={() => {
              setMode(null);
              setReason("");
            }}
            success={
              mode === "edit"
                ? "Comment updated"
                : mode === "delete"
                  ? "Content deleted"
                  : undefined
            }
            className="space-y-4"
          >
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={id} />
            {mode !== "delete" && (
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor={`content-action-${id}`}
                >
                  {mode === "edit" ? "Comment" : "Reason"}
                </label>
                <textarea
                  id={`content-action-${id}`}
                  name={mode === "edit" ? "comment" : "reason"}
                  value={mode === "edit" ? comment : reason}
                  onChange={(event) =>
                    mode === "edit"
                      ? setComment(event.target.value)
                      : setReason(event.target.value)
                  }
                  required
                  maxLength={mode === "edit" ? 5000 : 500}
                  rows={4}
                  className="w-full rounded-xl border bg-background p-3 text-sm"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode(null)}
              >
                Cancel
              </Button>
              <SubmitButton
                text={
                  mode === "edit"
                    ? "Save comment"
                    : mode === "delete"
                      ? `Delete ${kind}`
                      : "Send report"
                }
                variant={mode === "delete" ? "destructive" : "default"}
              />
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
