"use client";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";
import { ImagePlus, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TipTabEditor } from "./TipTabEditor";
import { SubmitButton } from "./SubmitButtons";
import { UploadDropzone } from "./Uploadthing";
import { useState } from "react";
import { createPost, editPost } from "@/app/actions";
import { unstable_rethrow } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import type { JSONContent } from "@tiptap/react";
import { serializeEditorContent } from "@/app/lib/editor-content";

export default function PostComposer({
  subName,
  flairs,
  communityRules,
  post,
}: {
  subName: string;
  flairs: string[];
  communityRules: string;
  post?: {
    id: string;
    title: string;
    textContent: JSONContent | null;
    imageString: string | null;
    flair: string | null;
  };
}) {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState<string | null>(
    post?.imageString ?? null,
  );
  const [json, setJson] = useState<JSONContent | null>(
    post?.textContent ?? null,
  );
  const [title, setTitle] = useState(post?.title ?? "");
  const [flair, setFlair] = useState(post?.flair ?? "");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function submitPost(formData: FormData) {
    setError("");
    try {
      const jsonContent = serializeEditorContent(json);
      const result = await (post
        ? editPost({ jsonContent }, formData)
        : createPost({ jsonContent }, formData));
      if (result?.error) {
        setError(result.error);
        toast({
          title: post ? "Couldn’t save post" : "Couldn’t create post",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      unstable_rethrow(error);
      const message =
        "Check your title, content and community, then try again. Your draft is kept.";
      setError(message);
      toast({
        title: post ? "Couldn’t save post" : "Couldn’t create post",
        description: message,
        variant: "destructive",
      });
    }
  }
  return (
    <main className="page-grid">
      <div className="min-w-0 space-y-5">
        <div>
          <Link
            href={`/r/${subName}`}
            className="inline-flex min-h-11 items-center text-sm text-primary"
          >
            Back to {subName}
          </Link>
          <h1 className="text-3xl font-semibold">
            {post ? "Edit your post" : "Start a conversation"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A question, an idea, a story. Give people something to talk about.
          </p>
        </div>
        <Card className="p-5 shadow-none sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b pb-4">
            <div>
              <p className="text-xs text-muted-foreground">Posting in</p>
              <Link
                href={`/r/${subName}`}
                className="font-semibold text-primary"
              >
                {subName}
              </Link>
            </div>
            {!post && (
              <Link
                href="/communities?compose=1"
                className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline"
              >
                Choose another community
              </Link>
            )}
          </div>
          <form action={submitPost} className="space-y-5">
            <input type="hidden" name="imageUrl" value={imageUrl ?? ""} />
            <input type="hidden" name="subName" value={subName} />
            {post && <input type="hidden" name="postId" value={post.id} />}
            <div>
              <Label htmlFor="post-title">Title</Label>
              <Input
                id="post-title"
                maxLength={300}
                required
                name="title"
                placeholder="What would you like to discuss?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-2 h-11"
              />
              <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
                {title.length}/300
              </p>
            </div>
            <div>
              <Label>Post body</Label>
              <TipTabEditor setJson={setJson} json={json} />
              <p className="mt-2 text-xs text-muted-foreground">
                Add text or an image. Your draft stays here if submission fails.
              </p>
            </div>
            <details
              open={imageUrl !== null || undefined}
              className="rounded-xl border p-3"
            >
              <summary className="flex min-h-11 items-center gap-2 text-sm font-medium">
                <ImagePlus className="h-4 w-4 text-primary" />
                {imageUrl
                  ? "Image attached"
                  : post
                    ? "Image attachment"
                    : "Add an image (optional)"}
              </summary>
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt="Your attached image preview"
                  width={700}
                  height={420}
                  className="mt-3 max-h-80 w-full rounded-xl object-contain"
                />
              ) : post ? (
                <p className="py-3 text-sm text-muted-foreground">
                  This post has no image. Its attachment is kept when editing.
                </p>
              ) : (
                <UploadDropzone
                  className="ut-button:bg-primary ut-label:text-primary ut-button:ut-uploading:bg-primary/50 ut-button:ut-uploading:after:bg-primary"
                  endpoint="imageUploader"
                  input={{ subName }}
                  skipPolling
                  onUploadBegin={() => setUploading(true)}
                  onClientUploadComplete={(res) => {
                    setUploading(false);
                    if (res[0]) setImageUrl(res[0].url);
                  }}
                  onUploadError={(error) => {
                    setUploading(false);
                    setError(error.message);
                    toast({
                      title: "Upload failed",
                      description: error.message,
                      variant: "destructive",
                    });
                  }}
                />
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                One JPEG, PNG, WebP or GIF image, up to 16 MB. It will appear
                with your title and text.
              </p>
            </details>
            <div>
              <Label htmlFor="post-flair">Flair (optional)</Label>
              <select
                id="post-flair"
                name="flair"
                value={flair}
                onChange={(e) => setFlair(e.target.value)}
                className="mt-2 block w-full rounded-xl border bg-background px-3 text-sm"
              >
                <option value="">No flair</option>
                {[
                  ...new Set([...flairs, ...(post?.flair ? [post.flair] : [])]),
                ].map((label) => (
                  <option key={label}>{label}</option>
                ))}
              </select>
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive dark:text-red-300"
              >
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
              <Link
                href={`/r/${subName}`}
                className="inline-flex min-h-11 items-center px-3 text-sm text-muted-foreground"
              >
                Cancel
              </Link>
              <SubmitButton
                text={post ? "Save post" : "Create Post"}
                disabled={uploading}
              />
            </div>
          </form>
        </Card>
      </div>
      <aside>
        <Card className="space-y-4 p-5 shadow-none xl:sticky xl:top-24">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h2 className="font-semibold">{subName} rules</h2>
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {communityRules ||
              "Be respectful. Remember there’s a person behind every reply."}
          </p>
          <p className="border-t pt-4 text-sm text-muted-foreground">
            Use a clear title, share the original source when relevant, and
            check for an existing conversation before posting.
          </p>
        </Card>
      </aside>
    </main>
  );
}
