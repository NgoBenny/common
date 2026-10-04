import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "../lib/db";
import { isSiteModerator } from "../lib/moderation";
import { pageNumber } from "../lib/validation";
import {
  ModerationControls,
  CommunityAvailabilityForm,
} from "../components/ModerationControls";
export const dynamic = "force-dynamic";
export default async function SiteModeration({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await getKindeServerSession().getUser();
  if (!isSiteModerator(user?.id)) notFound();
  const query = await searchParams;
  const communities = await prisma.subreddit.findMany({
    where: {
      name: { contains: (query.q ?? "").slice(0, 100), mode: "insensitive" },
    },
    take: 20,
    orderBy: { name: "asc" },
    select: { name: true, removedAt: true },
  });
  return (
    <main className="page-single space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Site moderation</h1>
        <p className="mt-2 text-muted-foreground">
          Manage participation and keep Common’s communities welcoming.
        </p>
      </div>
      <ModerationControls scope="@site" page={pageNumber(query.page)} />
      <CommunityAvailabilityForm />
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Find a community</h2>
        <form className="flex gap-2">
          <input
            aria-label="Find a community"
            name="q"
            defaultValue={query.q}
            className="min-w-0 flex-1 rounded-xl border bg-background p-3"
          />
          <button className="rounded-xl border px-4">Search</button>
        </form>
        <p className="text-sm text-muted-foreground">
          Showing up to 20 matches. Removed communities remain accessible to you
          for review.
        </p>
        {communities.map((c) => (
          <p key={c.name}>
            <Link
              className="text-primary underline"
              href={`/r/${c.name}/moderation`}
            >
              {c.name}
            </Link>
            {c.removedAt && (
              <span className="ml-2 text-sm text-muted-foreground">
                Removed
              </span>
            )}
          </p>
        ))}
      </section>
    </main>
  );
}
