"use server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { revalidatePath } from "next/cache";
import prisma from "../lib/db";
import { canModerateCommunity, isSiteModerator } from "../lib/moderation";
import {
  assertParticipation,
  lockParticipant,
  lockCommunity,
} from "../lib/restrictions";
import { formText, ValidationError, validationResult } from "../lib/validation";

async function actor() {
  const user = await getKindeServerSession().getUser();
  if (!user) throw new ValidationError("Please sign in.");
  await assertParticipation(user.id);
  return user.id;
}

export async function restrictUser(form: FormData) {
  try {
    const actorId = await actor();
    const username = formText(form, "username", 21).replace(/^u\//, "");
    const reason = formText(form, "reason", 500);
    const scope = formText(form, "scope", 21);
    const duration = formText(form, "duration", 10);
    const durations: Record<string, number | null> = {
      "1h": 1,
      "24h": 24,
      "7d": 168,
      "30d": 720,
      permanent: null,
    };
    if (!Object.hasOwn(durations, duration))
      throw new ValidationError("Choose a valid duration.");
    const hours = durations[duration];
    await prisma.$transaction(async (db) => {
      const target = await db.user.findUnique({
        where: { userName: username },
        select: { id: true },
      });
      if (!target) throw new ValidationError("That username does not exist.");
      if (target.id === actorId || isSiteModerator(target.id))
        throw new ValidationError(
          "You cannot restrict yourself or the site moderator.",
        );
      const community =
        scope === "@site"
          ? null
          : await db.subreddit.findUnique({
              where: { name: scope },
              select: { id: true, userId: true, removedAt: true },
            });
      if (
        scope === "@site"
          ? !isSiteModerator(actorId)
          : !community ||
            community.removedAt ||
            !canModerateCommunity(actorId, community.userId)
      )
        throw new ValidationError("You do not moderate this scope.");
      if (community?.userId === target.id)
        throw new ValidationError(
          "A community creator cannot be banned from their own community.",
        );
      await lockParticipant(db, target.id);
      await assertParticipation(actorId, community ? scope : undefined, db);
      const subredditId = community?.id ?? null;
      await db.userRestriction.updateMany({
        where: { userId: target.id, subredditId, liftedAt: null },
        data: { liftedAt: new Date(), liftedBy: actorId },
      });
      await db.userRestriction.create({
        data: {
          userId: target.id,
          subredditId,
          createdBy: actorId,
          reason,
          expiresAt:
            hours === null ? null : new Date(Date.now() + hours * 3600000),
        },
      });
      await db.moderationEvent.create({
        data: {
          actorId,
          targetUserId: target.id,
          subredditId,
          action: "RESTRICT",
          reason,
        },
      });
    });
    revalidatePath("/", "layout");
    return { message: "Restriction applied. Existing content is unchanged." };
  } catch (error) {
    return validationResult(error);
  }
}

export async function liftRestriction(form: FormData) {
  try {
    const actorId = await actor();
    const id = formText(form, "restrictionId", 100);
    const reason = formText(form, "reason", 500);
    await prisma.$transaction(async (db) => {
      const restriction = await db.userRestriction.findUnique({
        where: { id },
        include: { Subreddit: { select: { userId: true, name: true } } },
      });
      if (
        !restriction ||
        (restriction.subredditId
          ? !canModerateCommunity(actorId, restriction.Subreddit?.userId)
          : !isSiteModerator(actorId))
      )
        throw new ValidationError("You cannot lift this restriction.");
      await lockParticipant(db, restriction.userId);
      await assertParticipation(actorId, restriction.Subreddit?.name, db);
      const result = await db.userRestriction.updateMany({
        where: { id, liftedAt: null },
        data: { liftedAt: new Date(), liftedBy: actorId },
      });
      if (!result.count)
        throw new ValidationError("This restriction is already lifted.");
      await db.moderationEvent.create({
        data: {
          actorId,
          targetUserId: restriction.userId,
          subredditId: restriction.subredditId,
          action: "LIFT",
          reason,
        },
      });
    });
    revalidatePath("/", "layout");
    return { message: "Restriction lifted." };
  } catch (error) {
    return validationResult(error);
  }
}

export async function setCommunityAvailability(form: FormData) {
  try {
    const actorId = await actor();
    if (!isSiteModerator(actorId))
      throw new ValidationError(
        "Only the site moderator can remove or restore communities.",
      );
    const name = formText(form, "name", 21);
    const reason = formText(form, "reason", 500);
    const decision = formText(form, "decision", 10);
    if (!["remove", "restore"].includes(decision))
      throw new ValidationError("Invalid decision.");
    await prisma.$transaction(async (db) => {
      await lockCommunity(db, name);
      const community = await db.subreddit.findUnique({ where: { name } });
      if (
        !community ||
        Boolean(community.removedAt) === (decision === "remove")
      )
        throw new ValidationError(
          "Community unavailable or already in that state.",
        );
      await db.subreddit.update({
        where: { id: community.id },
        data: { removedAt: decision === "remove" ? new Date() : null },
      });
      await db.moderationEvent.create({
        data: {
          actorId,
          subredditId: community.id,
          action:
            decision === "remove" ? "REMOVE_COMMUNITY" : "RESTORE_COMMUNITY",
          reason,
        },
      });
    });
    revalidatePath("/", "layout");
    return {
      message:
        decision === "remove"
          ? "Community removed from public browsing. Its records are preserved."
          : "Community restored.",
    };
  } catch (error) {
    return validationResult(error);
  }
}
