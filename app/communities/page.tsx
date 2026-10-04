import prisma from "@/app/lib/db";
import { pageNumber } from "@/app/lib/validation";
import Pagination from "@/app/components/Pagination";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowUpRight, Search, Users } from "lucide-react";
export const dynamic = "force-dynamic";

export default async function Communities({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; compose?: string }>;
}) {
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
  const composing = query.compose === "1";
  const where = {
    removedAt: null,
    name: { contains: q, mode: "insensitive" as const },
  };
  const [count, communities] = await prisma.$transaction([
    prisma.subreddit.count({ where }),
    prisma.subreddit.findMany({
      where,
      take: 20,
      skip: (pageNumber(query.page) - 1) * 20,
      orderBy: { name: "asc" },
      select: {
        name: true,
        description: true,
        _count: {
          select: {
            memberships: true,
            posts: { where: { deletedAt: null, removedAt: null } },
          },
        },
      },
    }),
  ]);
  return (
    <main className="page-single space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">
            {composing ? "Choose a community" : "Explore communities"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {composing
              ? "Find the right place for your conversation, then choose Create post."
              : "Find people who share your interests. Browse, join and make yourself at home."}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/r/create">Create community</Link>
        </Button>
      </div>
      <form className="flex gap-2" action="/communities">
        {composing && <input type="hidden" name="compose" value="1" />}
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Search communities</span>
          <input
            name="q"
            type="search"
            defaultValue={q}
            maxLength={100}
            placeholder="Search by community name"
            className="h-11 min-w-0 w-full bg-transparent text-sm"
          />
        </label>
        <Button type="submit">Search</Button>
      </form>
      {q && (
        <p className="text-sm text-muted-foreground">
          {count} {count === 1 ? "community" : "communities"} matching “{q}” ·{" "}
          <Link
            className="text-primary underline"
            href={composing ? "/communities?compose=1" : "/communities"}
          >
            Clear search
          </Link>
        </p>
      )}
      <div className="divide-y rounded-2xl border bg-card">
        {communities.map((community) => (
          <article
            key={community.name}
            className="flex flex-wrap items-center gap-4 p-4 sm:p-5"
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary"
              aria-hidden="true"
            >
              {community.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`/r/${encodeURIComponent(community.name)}`}
                className="break-words text-lg font-semibold hover:text-primary"
              >
                {community.name}
              </Link>
              <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">
                {community.description ||
                  "A new place to start a conversation."}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {community._count.memberships} members ·{" "}
                {community._count.posts} posts
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl bg-primary/10 px-3 text-sm font-medium text-primary hover:bg-primary/20 sm:w-auto"
              href={`/r/${encodeURIComponent(community.name)}${composing ? "/create" : ""}`}
            >
              {composing ? "Create post" : "Visit"}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </article>
        ))}
        {!communities.length && (
          <div className="p-10 text-center">
            <Users className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-4 text-xl font-semibold">No communities found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Try a different name, or create a community for your interest.
            </p>
            <Link
              className="mt-4 inline-flex min-h-11 items-center text-primary underline"
              href="/r/create"
            >
              Create a community
            </Link>
          </div>
        )}
      </div>
      <Pagination totalPages={Math.ceil(count / 20)} />
    </main>
  );
}
