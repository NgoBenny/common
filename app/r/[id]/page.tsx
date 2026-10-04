import { RestrictionNotice } from "@/app/components/RestrictionNotice";
import { CreatePostCard } from "@/app/components/CreatePostCard";
import { FeedFilters, PostFeed } from "@/app/components/PostFeed";
import { SubDescriptionForm } from "@/app/components/SubDescritpionForm";
import { ActionForm } from "@/app/components/ActionForm";
import { SubmitButton } from "@/app/components/SubmitButtons";
import { setMembership } from "@/app/actions";
import { CommunityRulesForm } from "@/app/components/CommunityRulesForm";
import prisma from "@/app/lib/db";
import { canModerateCommunity } from "@/app/lib/moderation";
import type { FeedQuery } from "@/app/lib/feed";
import { Card } from "@/components/ui/card";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, Plus, ShieldCheck } from "lucide-react";
export const dynamic = "force-dynamic";

export default async function Community({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<FeedQuery>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await getKindeServerSession().getUser();
  const community = await prisma.subreddit.findFirst({
    where: { name: id, removedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      userId: true,
      rules: true,
      flairs: true,
      memberships: {
        where: { userId: user?.id || "" },
        select: { userId: true },
      },
      _count: { select: { memberships: true } },
    },
  });
  if (!community) notFound();
  const moderator = canModerateCommunity(user?.id, community.userId);
  const joined = community.memberships.length > 0;
  return (
    <main className="page-grid">
      <Card className="p-5 shadow-none xl:col-span-2 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl font-semibold text-primary"
            aria-hidden="true"
          >
            {community.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-semibold sm:text-3xl">
              {community.name}
            </h1>
            <p className="mt-2 max-w-2xl break-words text-sm text-muted-foreground">
              {community.description ||
                "A place to share ideas and start conversations."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {community._count.memberships} members · Created{" "}
              {community.createdAt.toLocaleDateString("en-US", {
                timeZone: "UTC",
              })}
            </p>
          </div>
          <ActionForm
            action={setMembership}
            className="w-full sm:w-auto"
            success={
              joined ? "You left the community" : "You joined the community"
            }
          >
            <input type="hidden" name="subredditId" value={community.id} />
            <input type="hidden" name="join" value={String(!joined)} />
            <SubmitButton
              text={joined ? "Leave community" : "Join community"}
              variant={joined ? "outline" : "default"}
              pressed={joined}
            />
          </ActionForm>
        </div>
        <details className="mt-4 border-t pt-2">
          <summary className="flex min-h-11 items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Community rules & flair
            <ChevronDown className="ml-auto h-4 w-4" />
          </summary>
          <p className="max-w-prose whitespace-pre-wrap break-words py-3 text-sm">
            {community.rules || "No rules added yet. Be respectful."}
          </p>
          <div className="flex flex-wrap gap-2">
            {community.flairs.map((flair) => (
              <span
                key={flair}
                className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary"
              >
                {flair}
              </span>
            ))}
          </div>
          {moderator && (
            <div className="mt-5 space-y-4 border-t pt-4">
              <h2 className="font-semibold">Manage community</h2>
              <SubDescriptionForm
                description={community.description}
                subName={id}
              />
              <CommunityRulesForm
                name={id}
                rules={community.rules}
                flairs={community.flairs}
              />
              <Link
                href={`/r/${id}/moderation`}
                className="inline-flex min-h-11 items-center text-primary underline"
              >
                Moderate community
              </Link>
            </div>
          )}
        </details>
      </Card>
      <div className="min-w-0 space-y-5">
        <RestrictionNotice subName={community.name} />
        <CreatePostCard subName={community.name} />
        <FeedFilters key={JSON.stringify(query)} query={query} />
        <PostFeed query={query} subName={community.name} userId={user?.id} />
      </div>
      <aside className="hidden xl:block">
        <Card className="sticky top-24 space-y-4 p-5 shadow-none">
          <h2 className="font-semibold">Make yourself at home</h2>
          <p className="text-sm text-muted-foreground">
            Have a question or something to share? Start a conversation in{" "}
            {community.name}.
          </p>
          <Link
            href={`/r/${id}/create`}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Create post
          </Link>
          <h3 className="border-t pt-4 text-sm font-semibold">
            Community rules
          </h3>
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {community.rules || "Be respectful."}
          </p>
        </Card>
      </aside>
    </main>
  );
}
