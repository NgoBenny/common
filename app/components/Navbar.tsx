import Link from "next/link";
import { Suspense } from "react";
import { Bell, Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import {
  RegisterLink,
  LoginLink,
} from "@kinde-oss/kinde-auth-nextjs/components";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { UserDropdown } from "./UserDropdown";
import { Brand } from "./Brand";
import { Navigation } from "./Navigation";
import prisma from "../lib/db";
import { isSiteModerator } from "../lib/moderation";

export async function Navbar() {
  const user = await getKindeServerSession().getUser();
  const [profile, unread, memberships] = user
    ? await Promise.all([
        prisma.user.findUnique({
          where: { id: user.id },
          select: { userName: true },
        }),
        prisma.notification.count({
          where: {
            userId: user.id,
            readAt: null,
            Post: { Subreddit: { removedAt: null } },
          },
        }),
        prisma.membership.findMany({
          where: { userId: user.id, Subreddit: { removedAt: null } },
          take: 8,
          orderBy: { createdAt: "desc" },
          select: { Subreddit: { select: { name: true } } },
        }),
      ])
    : [null, 0, []];
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:p-3 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center gap-3 px-4 py-2 lg:px-6 xl:grid xl:grid-cols-[224px_minmax(0,1fr)] xl:gap-0 xl:px-0">
          <Link href="/" aria-label="Common home" className="lg:w-48 xl:ml-6">
            <Brand />
          </Link>
          <div className="contents xl:page-grid xl:w-full xl:py-0">
            <form
              action="/"
              role="search"
              className="order-last flex h-11 w-full items-center gap-2 rounded-xl bg-muted px-3 sm:order-none sm:ml-4 sm:max-w-md sm:flex-1 xl:ml-0 xl:justify-self-center"
            >
              <Search
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <label htmlFor="global-search" className="sr-only">
                Search conversations
              </label>
              <input
                id="global-search"
                name="q"
                type="search"
                maxLength={100}
                placeholder="Search conversations"
                className="min-w-0 flex-1 bg-transparent text-sm"
              />
              <button
                type="submit"
                aria-label="Search conversations"
                className="min-h-11 px-2 text-xs font-medium text-primary"
              >
                Search
              </button>
            </form>
            <div className="ml-auto flex items-center gap-2 xl:ml-0 xl:justify-self-end">
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/communities?compose=1">
                  <Plus className="mr-2 h-4 w-4" />
                  Create post
                </Link>
              </Button>
              <ThemeToggle />
              {user ? (
                <>
                  <Link
                    href="/notifications"
                    aria-label={`Notifications, ${unread} unread`}
                    className="relative flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted"
                  >
                    <Bell className="h-5 w-5" />
                    {unread > 0 && (
                      <span className="absolute right-0 top-0 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </Link>
                  <UserDropdown
                    userImage={user.picture}
                    userName={profile?.userName}
                    siteModerator={isSiteModerator(user.id)}
                  />
                </>
              ) : (
                <>
                  <Button
                    asChild
                    variant="ghost"
                    className="hidden md:inline-flex"
                  >
                    <RegisterLink>Sign up</RegisterLink>
                  </Button>
                  <Button asChild>
                    <LoginLink authUrlParams={{ prompt: "login" }}>
                      Login
                    </LoginLink>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      <aside
        className="fixed top-20 bottom-4 hidden w-52 space-y-6 overflow-y-auto px-4 lg:block"
        style={{ left: "max(0px, calc((100vw - 1440px) / 2))" }}
      >
        <Suspense>
          <Navigation />
        </Suspense>
        <div className="border-t pt-5">
          <h2 className="mb-2 px-3 text-sm font-semibold">Your communities</h2>
          {memberships.map(({ Subreddit }) => (
            <Link
              key={Subreddit.name}
              href={`/r/${encodeURIComponent(Subreddit.name)}`}
              className="nav-item"
            >
              <Users className="h-4 w-4 shrink-0" />
              <span className="truncate">{Subreddit.name}</span>
            </Link>
          ))}
          {!memberships.length && (
            <p className="px-3 text-sm text-muted-foreground">
              Join a community to find it here.
            </p>
          )}
          <Link href="/communities" className="nav-item text-primary">
            Browse communities
          </Link>
          <Link href="/r/create" className="nav-item">
            <Plus className="h-4 w-4" />
            Create community
          </Link>
        </div>
      </aside>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        <Suspense>
          <Navigation mobile />
        </Suspense>
      </div>
    </>
  );
}
