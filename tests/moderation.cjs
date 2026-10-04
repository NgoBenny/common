const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");
const moderation = load("app/lib/moderation.ts", { "server-only": {} });
const siteId = "kp_3554467a11f2440cbb959123e0f4b1e8";
assert.equal(moderation.canModerateCommunity(siteId, "another-creator"), true);
assert.equal(moderation.canModerateCommunity("creator", "creator"), true);
assert.equal(moderation.canModerateCommunity("member", "creator"), false);
assert.equal(moderation.canModerateCommunity(null, null), false);
assert.equal(moderation.canModerateCommunity(undefined, undefined), false);
assert.equal(moderation.isSiteModerator("un1on"), false);
assert.deepEqual(
  JSON.parse(
    JSON.stringify(moderation.moderatedCommunityWhere(siteId, "test")),
  ),
  { name: "test" },
);
assert.deepEqual(
  JSON.parse(
    JSON.stringify(moderation.moderatedCommunityWhere("creator", "test")),
  ),
  { name: "test", userId: "creator" },
);
console.log(
  "Site moderator identity, anonymous denial and creator permissions passed",
);
