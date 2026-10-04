import { participationProblem } from "@/app/lib/restrictions";
import { RestrictionNotice } from "@/app/components/RestrictionNotice";
import PostComposer from "@/app/components/PostComposer";
import prisma from "@/app/lib/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { notFound, redirect } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
export default async function EditPost({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getKindeServerSession().getUser();
  if (!user) redirect("/api/auth/login");
  const { id } = await params;
  const post = await prisma.post.findFirst({
    where: {
      id,
      userId: user.id,
      deletedAt: null,
      removedAt: null,
      Subreddit: { removedAt: null },
    },
    select: {
      id: true,
      title: true,
      textContent: true,
      imageString: true,
      flair: true,
      subName: true,
      Subreddit: { select: { rules: true, flairs: true } },
    },
  });
  if (!post?.Subreddit || !post.subName) notFound();
  if (await participationProblem(user.id, post.subName))
    return (
      <main className="page-single">
        <h1 className="text-2xl font-semibold">Editing is restricted</h1>
        <RestrictionNotice subName={post.subName} />
      </main>
    );
  return (
    <PostComposer
      subName={post.subName}
      flairs={post.Subreddit.flairs}
      communityRules={post.Subreddit.rules}
      post={{ ...post, textContent: post.textContent as JSONContent | null }}
    />
  );
}
