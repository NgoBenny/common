import { Prisma } from "@prisma/client";
import prisma from "./db";
import { assertParticipation, lockParticipant } from "./restrictions";

export class RateLimitError extends Error {
  constructor() {
    super("You’re creating content too quickly. Please try again shortly.");
  }
}

export function rateLimitResult(error: unknown) {
  if (error instanceof RateLimitError) return { error: error.message };
  throw error;
}

export async function createLimited<T>(
  userId: string,
  kind: "post" | "comment" | "subreddit",
  create: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const limit = kind === "post" ? 3 : kind === "comment" ? 10 : 2;
  const windowMs = kind === "subreddit" ? 3600000 : 60000;
  return prisma.$transaction(
    async (tx) => {
      await lockParticipant(tx, userId);
      await assertParticipation(userId, undefined, tx);
      // Transaction locks serialize this user's writes across Vercel instances.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`reddit:${kind}:${userId}`}, 0))`;
      // Soft-deleted records stay in the count, so deletion cannot bypass the limit.
      const where = {
        userId,
        createdAt: { gte: new Date(Date.now() - windowMs) },
      };
      const count =
        kind === "post"
          ? await tx.post.count({ where })
          : kind === "comment"
            ? await tx.comment.count({ where })
            : await tx.subreddit.count({ where });
      if (count >= limit) {
        console.warn(
          JSON.stringify({ event: "security.content_rate_limited", kind }),
        );
        throw new RateLimitError();
      }
      return create(tx);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}
