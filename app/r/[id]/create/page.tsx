import { participationProblem } from "@/app/lib/restrictions";
import { RestrictionNotice } from "@/app/components/RestrictionNotice";
import PostComposer from "@/app/components/PostComposer";
import prisma from "@/app/lib/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { notFound, redirect } from "next/navigation";
export default async function CreatePost({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getKindeServerSession().getUser();
  if (!user) redirect("/api/auth/login");
  const { id } = await params;
  const community = await prisma.subreddit.findFirst({
    where: { name: id, removedAt: null },
    select: { rules: true, flairs: true },
  });
  if (!community) notFound();
  if (await participationProblem(user.id, id))
    return (
      <main className="page-single">
        <h1 className="text-2xl font-semibold">Posting is restricted</h1>
        <RestrictionNotice subName={id} />
      </main>
    );
  return (
    <PostComposer
      subName={id}
      flairs={community.flairs}
      communityRules={community.rules}
    />
  );
}
