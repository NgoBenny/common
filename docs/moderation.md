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
