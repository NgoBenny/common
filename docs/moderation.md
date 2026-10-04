# Common moderation access

Community creators moderate their own communities. The owner additionally
authorized **u/un1on** as Common's site moderator on October 3, 2026.
`app/lib/moderation.ts` grants that role to its verified, immutable Kinde account
ID, not its editable username. Granting or revoking the site role requires a
reviewed code change and deployment; there is no self-service role assignment.

Site moderation applies to all current and future communities: review/dismiss
reports, remove reported posts/comments, edit descriptions, rules and flair.
Open a community, expand **Community rules & flair**, then use **Manage community**
or **Review reports**. Community creators retain their original permissions.

This does not permit editing other authors' posts/comments, reading private
notifications or saved posts, changing account credentials, or database access.
Server actions enforce the same policy as the pages. No community ownership is
transferred, and no database schema change is required.
# Participation restrictions and community availability

The immutable site moderator identity above remains the authority. Changing a username to `un1on` never grants permissions.

- Community creators and the site moderator may ban members of their community. They cannot ban themselves, the community creator or the site moderator.
- Only the site moderator may suspend or permanently ban users across Common, or remove/restore communities. The account menu links to `/moderation`.
- Every restriction requires a reason. Durations are 1 hour, 24 hours, 7 days, 30 days or until manually lifted. Expiry is checked at request time, without a cron job.
- Restrictions are checked against the database on protected writes, not stored in the login session. Scoped checks cover posts, edits, comments/replies, votes, joining and uploads. Site restrictions additionally prevent creating communities, saving and reporting. Reading, leaving a community, account settings, marking notifications read, and erasing one's own content remain available. Community bans do not stop reporting content or maintaining personal bookmarks.
- Per-user transaction locks order bans with participation writes. Per-community locks order community removal with posting, replies, votes and edits. Upload authorization checks current restrictions; an upload already authorized before a restriction may finish, but a subsequent post submission is denied.
- Community removal hides public community pages, post pages, feeds/search, saved feeds, profiles, notifications and navigation membership lists. The name stays reserved. Restoration reverses visibility without recreating content.
- Restrictions and community changes preserve existing content and user records. Content removal is a separate moderation action.
- `UserRestriction` preserves application/lifting identity and dates. `ModerationEvent` records actions and reasons; the runtime role can select/insert audit events but cannot update or delete them. Both tables use RLS and deny Data API access.
- Restriction reasons are visible to the affected user and authorized moderators. Users can contact the operator to contest a restriction.

Release: restore-test a fresh production backup, deploy the additive Prisma migration with owner credentials, then release the app. The migration grants only the existing restricted server role the necessary access. Builds never run migrations. Backup verification includes the two new tables after migration.
