async function tableCounts(db) {
  const counts = await Promise.all([
    db.user.count(),
    db.subreddit.count(),
    db.post.count(),
    db.vote.count(),
    db.comment.count(),
  ]);
  const features =
    await db.$queryRaw`SELECT to_regclass('public."Membership"') IS NOT NULL AS present`;
  if (features[0].present)
    counts.push(
      ...(await Promise.all([
        db.membership.count(),
        db.savedPost.count(),
        db.report.count(),
        db.notification.count(),
      ])),
    );
  const moderation =
    await db.$queryRaw`SELECT to_regclass('public."UserRestriction"') IS NOT NULL AS present`;
  if (moderation[0].present)
    counts.push(
      ...(await Promise.all([
        db.userRestriction.count(),
        db.moderationEvent.count(),
      ])),
    );
  return counts;
}

async function requireRls(db) {
  const tables =
    await db.$queryRaw`SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('User', 'Subreddit', 'Post', 'Vote', 'Comment', 'Membership', 'SavedPost', 'Report', 'Notification', 'UserRestriction', 'ModerationEvent')`;
  if (
    ![5, 9, 11].includes(tables.length) ||
    tables.some((table) => !table.rowsecurity)
  ) {
    throw new Error("All application tables must have RLS enabled.");
  }
}

module.exports = { tableCounts, requireRls };
