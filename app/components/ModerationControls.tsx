import prisma from "../lib/db";
import {
  restrictUser,
  liftRestriction,
  setCommunityAvailability,
} from "../moderation/actions";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButtons";
import { activeRestrictionWhere } from "../lib/restrictions";
import Pagination from "./Pagination";
const field = "block w-full rounded-xl border bg-background p-3 text-sm";
export async function ModerationControls({
  scope,
  subredditId = null,
  page = 1,
}: {
  scope: string;
  subredditId?: string | null;
  page?: number;
}) {
  const where = { subredditId, ...activeRestrictionWhere() };
  const eventWhere = scope === "@site" ? {} : { subredditId };
  const [count, restrictions, events, eventCount] = await prisma.$transaction([
    prisma.userRestriction.count({ where }),
    prisma.userRestriction.findMany({
      where,
      take: 20,
      skip: (page - 1) * 20,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        reason: true,
        createdBy: true,
        expiresAt: true,
        User: { select: { userName: true } },
      },
    }),
    prisma.moderationEvent.findMany({
      where: eventWhere,
      take: 20,
      skip: (page - 1) * 20,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        action: true,
        subredditId: true,
        actorId: true,
        targetUserId: true,
        reason: true,
        createdAt: true,
      },
    }),
    prisma.moderationEvent.count({ where: eventWhere }),
  ]);
  const identities = await prisma.user.findMany({
    where: {
      id: {
        in: [
          ...new Set([
            ...restrictions.map((r) => r.createdBy),
            ...events.flatMap((e) => [
              e.actorId,
              ...(e.targetUserId ? [e.targetUserId] : []),
            ]),
          ]),
        ],
      },
    },
    select: { id: true, userName: true },
  });
  const name = (id: string) => {
    const profile = identities.find((p) => p.id === id);
    return profile?.userName
      ? `u/${profile.userName}`
      : "an unavailable account";
  };
  const communities = await prisma.subreddit.findMany({
    where: {
      id: { in: events.flatMap((e) => (e.subredditId ? [e.subredditId] : [])) },
    },
    select: { id: true, name: true },
  });
  return (
    <div className="space-y-8">
      <section className="space-y-3 border-t pt-6">
        <h2 className="text-xl font-semibold">
          {scope === "@site"
            ? "Restrict site participation"
            : "Ban a community member"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {scope === "@site"
            ? "Only the site moderator can suspend or ban users across Common."
            : "This applies only to this community."}{" "}
          Existing posts and account records are kept.
        </p>
        <ActionForm
          action={restrictUser}
          confirm="Apply this restriction? The user will see your reason. You can lift it later."
          className="grid gap-4 sm:grid-cols-2"
        >
          <input type="hidden" name="scope" value={scope} />
          <label className="space-y-2 text-sm font-medium">
            Username
            <input
              name="username"
              placeholder="Username without u/"
              required
              maxLength={21}
              className={field}
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            Duration
            <select name="duration" className={field} defaultValue="24h">
              <option value="1h">1 hour</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="permanent">Until manually lifted</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium sm:col-span-2">
            Reason shown to the user
            <textarea
              name="reason"
              required
              maxLength={500}
              rows={3}
              className={field}
            />
          </label>
          <div>
            <SubmitButton text="Apply restriction" variant="destructive" />
          </div>
        </ActionForm>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Active restrictions</h2>
        {!restrictions.length && (
          <p className="text-sm text-muted-foreground">
            No active restrictions.
          </p>
        )}
        {restrictions.map((r) => (
          <article key={r.id} className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">u/{r.User.userName ?? "unknown"}</h3>
            <p className="text-sm">
              {r.expiresAt
                ? `Ends ${r.expiresAt.toISOString()}`
                : "Until manually lifted"}
            </p>
            <p className="break-words text-sm">{r.reason}</p>
            <p className="break-all text-xs text-muted-foreground">
              Applied by {name(r.createdBy)}
            </p>
            <ActionForm
              action={liftRestriction}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="restrictionId" value={r.id} />
              <label className="min-w-0 flex-1 space-y-2 text-sm">
                Reason for lifting
                <input
                  name="reason"
                  required
                  maxLength={500}
                  className={field}
                />
              </label>
              <SubmitButton text="Lift restriction" variant="outline" />
            </ActionForm>
          </article>
        ))}
      </section>
      <details className="space-y-3 border-t pt-3">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
          Moderation history
        </summary>
        <p className="text-sm text-muted-foreground">
          Actions include the moderator, reason and timestamp.
        </p>
        {!events.length && (
          <p className="text-sm text-muted-foreground">
            No actions recorded yet.
          </p>
        )}
        {events.map((e) => (
          <article key={e.id} className="space-y-1 border-b pb-3 text-sm">
            <p className="font-medium">{e.action.replaceAll("_", " ")}</p>
            <p className="break-words">{e.reason}</p>
            <p className="break-all text-xs text-muted-foreground">
              {e.createdAt.toISOString()} · {name(e.actorId)}
              {e.targetUserId ? ` · ${name(e.targetUserId)}` : ""}
              {e.subredditId
                ? ` · r/${communities.find((c) => c.id === e.subredditId)?.name ?? "unavailable"}`
                : " · Site-wide"}
            </p>
          </article>
        ))}
        <Pagination totalPages={Math.ceil(Math.max(count, eventCount) / 20)} />
      </details>
    </div>
  );
}
export function CommunityAvailabilityForm() {
  return (
    <section className="space-y-3 border-t pt-6">
      <h2 className="text-xl font-semibold">Remove or restore a community</h2>
      <p className="text-sm text-muted-foreground">
        Removal hides the community and its posts, blocks participation and
        keeps its name reserved. Restoration brings it back.
      </p>
      <ActionForm
        action={setCommunityAvailability}
        confirm="Change this community’s availability? All its posts will follow its visibility."
        className="grid gap-4 sm:grid-cols-2"
      >
        <label className="space-y-2 text-sm">
          Exact community name
          <input name="name" required maxLength={21} className={field} />
        </label>
        <label className="space-y-2 text-sm">
          Action
          <select name="decision" className={field}>
            <option value="remove">Remove from public browsing</option>
            <option value="restore">Restore community</option>
          </select>
        </label>
        <label className="space-y-2 text-sm sm:col-span-2">
          Reason
          <textarea
            name="reason"
            required
            maxLength={500}
            rows={3}
            className={field}
          />
        </label>
        <div>
          <SubmitButton text="Update community" variant="outline" />
        </div>
      </ActionForm>
    </section>
  );
}
