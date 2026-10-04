import "server-only";
import type { Prisma } from "@prisma/client";
import prisma from "./db";
import { ValidationError } from "./validation";

export const activeRestrictionWhere = () => ({
  liftedAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

export async function participationProblem(
  userId: string,
  subName?: string,
  db: Prisma.TransactionClient = prisma,
) {
  const community = subName
    ? await db.subreddit.findUnique({
        where: { name: subName },
        select: { id: true, removedAt: true },
      })
    : null;
  if (subName && (!community || community.removedAt))
    return "This community is unavailable.";
  const restriction = await db.userRestriction.findFirst({
    where: {
      userId,
      ...activeRestrictionWhere(),
      AND: [
        {
          OR: [
            { subredditId: null },
            ...(community ? [{ subredditId: community.id }] : []),
          ],
        },
      ],
    },
    orderBy: [{ expiresAt: "desc" }, { createdAt: "desc" }],
    select: { reason: true, expiresAt: true, subredditId: true },
  });
  if (!restriction) return null;
  return `Your participation ${restriction.subredditId ? "in this community" : "on Common"} is restricted ${restriction.expiresAt ? `until ${restriction.expiresAt.toISOString()}` : "until a moderator lifts it"}. Reason: ${restriction.reason}`;
}

export async function assertParticipation(
  userId: string,
  subName?: string,
  db: Prisma.TransactionClient = prisma,
) {
  const problem = await participationProblem(userId, subName, db);
  if (problem) throw new ValidationError(problem);
}

export async function lockParticipant(
  db: Prisma.TransactionClient,
  userId: string,
) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`common:participation:${userId}`}, 0))`;
}

export async function lockCommunity(
  db: Prisma.TransactionClient,
  name: string,
) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`common:community:${name}`}, 0))`;
}

export async function participate<T>(
  userId: string,
  subName: string | undefined,
  write: (db: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async (db) => {
    await lockParticipant(db, userId);
    if (subName) await lockCommunity(db, subName);
    await assertParticipation(userId, subName, db);
    return write(db);
  });
}
