"use server";

import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { redirect } from "next/navigation";
import prisma from "./lib/db";
import {
  assertParticipation,
  participate,
  lockParticipant,
  lockCommunity,
} from "./lib/restrictions";
import {
  canModerateCommunity,
  moderatedCommunityWhere,
} from "./lib/moderation";
import { Prisma } from "@prisma/client";
import { JSONContent } from "@tiptap/react";
import { revalidatePath } from "next/cache";
import {
  createLimited,
  RateLimitError,
  rateLimitResult,
} from "./lib/rate-limit";
import {
  formText,
  validImage,
  validName,
  postBody,
  ValidationError,
  validationResult,
} from "./lib/validation";

async function requireUser(participation = true) {
  const user = await getKindeServerSession().getUser();
  if (!user) {
    console.warn(
      JSON.stringify({
        event: "security.auth_required",
        source: "server_action",
      }),
    );
    redirect("/api/auth/login");
  }
  if (participation) await assertParticipation(user.id);
  return user;
}

function optionalText(form: FormData, key: string, max: number) {
  const value = form.get(key) ?? "";
  if (typeof value !== "string" || value.trim().length > max)
    throw new ValidationError(`Invalid ${key}`);
  return value.trim();
}

async function checkedFlair(subName: string, form: FormData) {
  const flair = optionalText(form, "flair", 40);
  const community = await prisma.subreddit.findUnique({
    where: { name: subName },
    select: { flairs: true, removedAt: true },
  });
  if (
    !community ||
    community.removedAt ||
    (flair && !community.flairs.includes(flair))
  )
    throw new ValidationError("Invalid community or flair");
  return flair || null;
}

export async function editPost(
  { jsonContent }: { jsonContent: JSONContent | null },
  form: FormData,
) {
  try {
    const user = await requireUser();
    const id = formText(form, "postId", 100);
    const post = await prisma.post.findFirst({
      where: { id, userId: user.id, deletedAt: null, removedAt: null },
      select: { subName: true },
    });
    if (!post?.subName)
      throw new Error("Only the author can edit an available post");
    const body = postBody(jsonContent);
    const flair = await checkedFlair(post.subName, form);
    const result = await participate(user.id, post.subName, (tx) =>
      tx.post.updateMany({
        where: { id, userId: user.id, deletedAt: null, removedAt: null },
        data: {
          title: formText(form, "title", 300),
          ...body,
          textContent: jsonContent == null ? Prisma.DbNull : body.textContent,
          flair,
          editedAt: new Date(),
        },
      }),
    );
    if (!result.count) throw new Error("Post unavailable");
    revalidatePath("/", "layout");
    redirect(`/post/${id}`);
  } catch (error) {
    return validationResult(error);
  }
}

export async function deleteContent(form: FormData) {
  const user = await requireUser(false);
  const id = formText(form, "id", 100);
  const kind = formText(form, "kind", 10);
  if (kind === "post") {
    const result = await prisma.post.updateMany({
      where: { id, userId: user.id, deletedAt: null },
      data: {
        deletedAt: new Date(),
        title: "[deleted]",
        textContent: Prisma.DbNull,
        bodyText: "",
        imageString: null,
        flair: null,
      },
    });
    if (!result.count) throw new Error("Only the author can delete this post");
  } else if (kind === "comment") {
    const result = await prisma.comment.updateMany({
      where: { id, userId: user.id, deletedAt: null },
      data: { deletedAt: new Date(), text: "" },
    });
    if (!result.count)
      throw new Error("Only the author can delete this comment");
  } else throw new Error("Invalid content type");
  revalidatePath("/", "layout");
}

export async function editComment(form: FormData) {
  try {
    const user = await requireUser();
    const comment = await prisma.comment.findUnique({
      where: { id: formText(form, "id", 100) },
      select: { Post: { select: { subName: true } } },
    });
    if (!comment?.Post?.subName)
      throw new ValidationError("Comment unavailable");
    const result = await participate(user.id, comment.Post.subName, (tx) =>
      tx.comment.updateMany({
        where: {
          id: formText(form, "id", 100),
          userId: user.id,
          deletedAt: null,
          removedAt: null,
        },
        data: { text: formText(form, "comment", 5000), editedAt: new Date() },
      }),
    );
    if (!result.count) throw new Error("Only the author can edit this comment");
    revalidatePath("/", "layout");
  } catch (error) {
    return validationResult(error);
  }
}

export async function setMembership(form: FormData) {
  const user = await requireUser(false);
  const subredditId = formText(form, "subredditId", 100);
  if (form.get("join") === "true") {
    const community = await prisma.subreddit.findUnique({
      where: { id: subredditId },
      select: { name: true },
    });
    if (!community) throw new ValidationError("Community unavailable");
    await participate(user.id, community.name, (tx) =>
      tx.membership.upsert({
        where: { userId_subredditId: { userId: user.id, subredditId } },
        create: { userId: user.id, subredditId },
        update: {},
      }),
    );
  } else if (form.get("join") === "false")
    await prisma.membership.deleteMany({
      where: { userId: user.id, subredditId },
    });
  else throw new Error("Invalid membership action");
  revalidatePath("/", "layout");
}

export async function setSavedPost(form: FormData) {
  const user = await requireUser();
  const postId = formText(form, "postId", 100);
  if (form.get("save") === "true") {
    if (
      !(await prisma.post.findFirst({
        where: {
          id: postId,
          deletedAt: null,
          removedAt: null,
          Subreddit: { removedAt: null },
        },
        select: { id: true },
      }))
    )
      throw new Error("Post unavailable");
    await prisma.savedPost.upsert({
      where: { userId_postId: { userId: user.id, postId } },
      create: { userId: user.id, postId },
      update: {},
    });
  } else if (form.get("save") === "false")
    await prisma.savedPost.deleteMany({ where: { userId: user.id, postId } });
  else throw new Error("Invalid save action");
  revalidatePath("/", "layout");
}

export async function reportContent(form: FormData) {
  try {
    const user = await requireUser();
    const kind = formText(form, "kind", 10);
    const id = formText(form, "id", 100);
    const reason = formText(form, "reason", 500);
    if (kind !== "post" && kind !== "comment")
      throw new ValidationError("Invalid content type");
    const postId = kind === "post" ? id : null;
    const commentId = kind === "comment" ? id : null;
    const available =
      kind === "post"
        ? await prisma.post.findFirst({
            where: {
              id,
              deletedAt: null,
              removedAt: null,
              Subreddit: { removedAt: null },
            },
            select: { id: true },
          })
        : await prisma.comment.findFirst({
            where: {
              id,
              deletedAt: null,
              removedAt: null,
              Post: {
                deletedAt: null,
                removedAt: null,
                Subreddit: { removedAt: null },
              },
            },
            select: { id: true },
          });
    if (!available) throw new Error("Content unavailable");
    const result = await prisma.$transaction(async (tx) => {
      await lockParticipant(tx, user.id);
      await assertParticipation(user.id, undefined, tx);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`reddit:report:${user.id}`}, 0))`;
      const where = { userId: user.id, postId, commentId };
      const previous = await tx.report.findFirst({
        where,
        select: { resolvedAt: true },
      });
      if (previous)
        return {
          message: previous.resolvedAt
            ? "You already reported this content; a moderator has reviewed it."
            : "You already reported this content; it is awaiting moderator review.",
        };
      if (
        (await tx.report.count({
          where: {
            userId: user.id,
            createdAt: { gte: new Date(Date.now() - 3600000) },
          },
        })) >= 20
      )
        throw new ValidationError("Report limit reached. Please try later.");
      await tx.report.create({ data: { ...where, reason } });
      return { message: "Report sent to the community moderator" };
    });
    revalidatePath("/", "layout");
    return result;
  } catch (error) {
    return validationResult(error);
  }
}

export async function resolveReport(form: FormData) {
  const user = await requireUser();
  const id = formText(form, "reportId", 100);
  const remove = form.get("decision");
  if (remove !== "remove" && remove !== "dismiss")
    throw new Error("Invalid moderation decision");
  await prisma.$transaction(async (tx) => {
    const report = await tx.report.findUnique({
      where: { id },
      include: {
        Post: { select: { Subreddit: { select: { userId: true } } } },
        Comment: {
          select: {
            Post: { select: { Subreddit: { select: { userId: true } } } },
          },
        },
      },
    });
    const owner =
      report?.Post?.Subreddit?.userId ??
      report?.Comment?.Post?.Subreddit?.userId;
    if (!report || report.resolvedAt || !canModerateCommunity(user.id, owner))
      throw new Error("Only the community moderator can review this report");
    if (remove === "remove") {
      if (report.postId)
        await tx.post.update({
          where: { id: report.postId },
          data: { removedAt: new Date() },
        });
      else if (report.commentId)
        await tx.comment.update({
          where: { id: report.commentId },
          data: { removedAt: new Date() },
        });
    }
    await tx.report.updateMany({
      where: report.postId
        ? { postId: report.postId, resolvedAt: null }
        : { commentId: report.commentId, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
  });
  revalidatePath("/", "layout");
}

export async function updateCommunityRules(form: FormData) {
  try {
    const user = await requireUser();
    await assertParticipation(user.id, formText(form, "subName", 21));
    const flairs = optionalText(form, "flairs", 800)
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (
      flairs.length > 20 ||
      flairs.some((value) => value.length > 40) ||
      new Set(flairs).size !== flairs.length
    )
      throw new ValidationError(
        "Use up to 20 unique flair labels, at most 40 characters each",
      );
    const result = await prisma.subreddit.updateMany({
      where: {
        ...moderatedCommunityWhere(user.id, formText(form, "subName", 21)),
        removedAt: null,
      },
      data: { rules: optionalText(form, "rules", 5000), flairs },
    });
    if (!result.count)
      throw new Error(
        "Only the community moderator can update rules and flair",
      );
    revalidatePath("/", "layout");
  } catch (error) {
    return validationResult(error);
  }
}

export async function markNotificationsRead(form: FormData) {
  const user = await requireUser(false);
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}

export async function updateUsername(prevState: any, formData: FormData) {
  const user = await requireUser(false);

  try {
    const username =
      typeof formData.get("username") === "string"
        ? (formData.get("username") as string).trim()
        : "";
    if (!validName(username))
      return {
        message: "Use 2–21 letters, numbers, underscores or hyphens",
        status: "error",
      };
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        userName: username,
      },
    });

    revalidatePath("/", "layout");
    return {
      message: "Updated username successfully",
      status: "green",
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return {
          message: "This username already exists",
          status: "error",
        };
      }
    }

    throw e;
  }
}

export async function createCommunity(prevState: any, formData: FormData) {
  const user = await requireUser();

  try {
    const name =
      typeof formData.get("name") === "string"
        ? (formData.get("name") as string).trim()
        : "";
    if (!validName(name) || name === "create")
      return {
        message:
          "Use 2–21 letters, numbers, underscores or hyphens; create is reserved",
        status: "error",
      };

    const data = await createLimited(user.id, "subreddit", (tx) =>
      tx.subreddit.create({
        data: {
          name: name,
          userId: user.id,
        },
      }),
    );

    return redirect(`/r/${data.name}`);
  } catch (e) {
    if (e instanceof RateLimitError)
      return { message: e.message, status: "error" };
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return {
          message: "This community already exists",
          status: "error",
        };
      }
    }
    throw e;
  }
}

export async function updateSubDescription(prevState: any, formData: FormData) {
  const user = await requireUser();

  try {
    const subName = formText(formData, "subName", 21);
    await assertParticipation(user.id, subName);
    const description = formData.get("description");
    if (typeof description !== "string" || description.trim().length > 120) {
      return {
        status: "error",
        message: "Description must be at most 120 characters",
      };
    }

    const result = await prisma.subreddit.updateMany({
      where: { ...moderatedCommunityWhere(user.id, subName), removedAt: null },
      data: {
        description: description.trim(),
      },
    });
    if (!result.count)
      return {
        status: "error",
        message: "Only a community moderator can edit its description",
      };
    revalidatePath(`/r/${subName}`);

    return {
      status: "green",
      message: "Updated description successfully!",
    };
  } catch (e) {
    return {
      status: "error",
      message: "Failed to update description!",
    };
  }
}

export async function createPost(
  { jsonContent }: { jsonContent: JSONContent | null },
  formData: FormData,
) {
  try {
    const user = await requireUser();

    const title = formText(formData, "title", 300);
    const imageUrl = formData.get("imageUrl") as string | null;
    const subName = formText(formData, "subName", 21);
    if (imageUrl && (typeof imageUrl !== "string" || !validImage(imageUrl)))
      throw new ValidationError("Invalid image URL");
    const body = postBody(jsonContent);
    const flair = await checkedFlair(subName, formData);

    const data = await createLimited(user.id, "post", async (tx) => {
      await lockCommunity(tx, subName);
      await assertParticipation(user.id, subName, tx);
      return tx.post.create({
        data: {
          title: title,
          imageString: imageUrl || undefined,
          subName: subName,
          userId: user.id,
          ...body,
          flair,
        },
      });
    }).catch(rateLimitResult);

    if ("error" in data) return data;

    revalidatePath("/");
    revalidatePath(`/r/${subName}`);
    return redirect(`/post/${data.id}`);
  } catch (error) {
    return validationResult(error);
  }
}

export async function handleVote(formData: FormData) {
  const user = await requireUser();

  const postId = formText(formData, "postId", 100);
  const voteDirection = formData.get("voteDirection");
  if (voteDirection !== "UP" && voteDirection !== "DOWN")
    throw new Error("Invalid vote direction");

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          await lockParticipant(tx, user.id);
          const target = await tx.post.findUnique({
            where: { id: postId },
            select: { subName: true },
          });
          if (!target?.subName) throw new ValidationError("Post unavailable");
          await lockCommunity(tx, target.subName);
          await assertParticipation(user.id, target.subName, tx);
          const where = { postId, userId: user.id };
          if (
            !(await tx.post.findFirst({
              where: {
                id: postId,
                deletedAt: null,
                removedAt: null,
                Subreddit: { removedAt: null },
              },
            }))
          )
            throw new Error("Post unavailable");
          const vote = await tx.vote.findFirst({ where });
          // Also repair historical duplicates without deleting other users' votes.
          await tx.vote.deleteMany({ where });
          if (vote?.voteType !== voteDirection) {
            await tx.vote.create({
              data: { ...where, voteType: voteDirection },
            });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
      break;
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        !["P2034", "P2002"].includes(error.code) ||
        attempt === 3
      )
        throw error;
    }
  }
  revalidatePath("/", "layout");
}

export async function createComment(formData: FormData) {
  try {
    const user = await requireUser();

    const comment = formText(formData, "comment", 5000);
    const postId = formText(formData, "postId", 100);

    const parentId = optionalText(formData, "parentId", 100) || null;
    const result = await createLimited(user.id, "comment", async (tx) => {
      const post = await tx.post.findFirst({
        where: {
          id: postId,
          deletedAt: null,
          removedAt: null,
          Subreddit: { removedAt: null },
        },
        select: { userId: true, subName: true },
      });
      if (!post?.subName) throw new ValidationError("Post unavailable");
      await lockCommunity(tx, post.subName);
      await assertParticipation(user.id, post.subName, tx);
      const parent = parentId
        ? await tx.comment.findFirst({
            where: { id: parentId, postId },
            select: { userId: true },
          })
        : null;
      if (parentId && !parent)
        throw new ValidationError("Reply must belong to this post");
      let ancestor = parentId;
      for (let depth = 0; ancestor; depth++) {
        if (depth >= 9)
          throw new ValidationError("Reply nesting limit reached");
        ancestor =
          (
            await tx.comment.findUnique({
              where: { id: ancestor },
              select: { parentId: true },
            })
          )?.parentId ?? null;
      }
      const created = await tx.comment.create({
        data: { text: comment, userId: user.id, postId, parentId },
      });
      const recipients = new Set([post.userId, parent?.userId]);
      recipients.delete(user.id);
      await tx.notification.createMany({
        data: [...recipients]
          .filter((id): id is string => !!id)
          .map((userId) => ({
            userId,
            postId,
            commentId: created.id,
            kind: parent?.userId === userId ? "REPLY" : "COMMENT",
          })),
      });
      return created;
    }).catch(rateLimitResult);
    if ("error" in result) return result;

    revalidatePath(`/post/${postId}`);
    revalidatePath("/", "layout");
  } catch (error) {
    return validationResult(error);
  }
}
