import "server-only";

// Owner-authorized site moderator: u/un1on, verified in production on 2026-10-03.
// Use the immutable Kinde account ID; usernames are user-editable.
const SITE_MODERATOR_ID = "kp_3554467a11f2440cbb959123e0f4b1e8";

export function isSiteModerator(userId: string | null | undefined) {
  return userId === SITE_MODERATOR_ID;
}

export function canModerateCommunity(
  userId: string | null | undefined,
  creatorId: string | null | undefined,
) {
  return Boolean(userId) && (userId === creatorId || isSiteModerator(userId));
}

export function moderatedCommunityWhere(userId: string, name: string) {
  return isSiteModerator(userId) ? { name } : { name, userId };
}
