# Common

Common is a community discussion app built with Next.js 15, React, TypeScript, PostgreSQL, and Prisma. It supports searchable feeds, rich-text and image posts, threaded replies, votes, private saves, profiles, and in-app notifications.

My work builds on the original scaffold. It includes the Common redesign, server-side permission checks, transactional voting, scoped moderation, and database recovery tooling. The repository records implementation and dated checks; a merged feature is not automatically verified in production.

## How it works

| Layer | Responsibility |
| --- | --- |
| Next.js App Router | Server-rendered feeds, post pages, profiles, and responsive navigation |
| Kinde | Sign-in and authenticated user identity |
| Server actions | Input validation, ownership checks, restrictions, and writes |
| Prisma + PostgreSQL | Relational records, transactions, migrations, and private query scopes |
| UploadThing | Authenticated image uploads |
| Tiptap + React renderer | Rich-text editing and bounded rendering without arbitrary stored attributes |

The interface has light and dark themes, a desktop navigation rail, and mobile bottom navigation. A shared composer handles post creation and editing. Post pages place actions below the body; comment and reply composers keep cancelled drafts and restore keyboard focus.

## Permissions and consistency

- Server actions derive the acting user from Kinde and enforce ownership at the write boundary. Hiding an interface control is not the permission check.
- Voting uses serializable transactions with bounded conflict retries. The selected button comes from the saved vote, and page invalidation updates the feed and detail page.
- Community creators moderate their own communities. A site moderator can apply site-wide restrictions and remove or restore communities. The role is tied to an immutable account identity.
- Participation restrictions are read from the database on protected writes, including expiry. Transaction locks coordinate bans and community removal with participation writes.
- Community removal hides content while preserving it for restoration. Restricted users retain permitted activities, including reading and erasing their own content.
- Saved posts and notifications are scoped to the current user. New feature and moderation tables use default-deny RLS, while privileged server access still requires application permission checks.
- Search uses bound SQL parameters and literal wildcard escaping. Rich-text JSON is normalized for server-action transport and validated on the server.

See [community features](FEATURES.md) and [moderation policy](docs/moderation.md) for the exact permissions and release requirements.

## Recovery and database changes

The September 30 recovery restored the application tables from the paused database into a replacement hosted PostgreSQL project. Updating connection settings recovered the homepage. The audit did not establish expired credentials as the cause.

Backup scripts create checksummed archives. Restore verification uses an isolated local database; archive readability alone is not a restore test. Schema changes are tested against restored backups, and builds do not run migrations.

Follow [database recovery and migrations](DATABASE.md) before changing an existing database. Never run a reset or destructive schema synchronization against production. Authentication accounts and uploaded images are separate services and are not included in the PostgreSQL backup.

## Local setup

Use Node 24.x. Run `npm ci`, copy `.env.example` to the ignored `.env.local`, and supply your own PostgreSQL, Kinde, and UploadThing configuration. Use an isolated development database and follow the migration instructions in [DATABASE.md](DATABASE.md). Run `npm run db:check` before starting the app. Never commit credentials or database exports.

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000). Kinde login shows explicit sign-in choices; the account menu provides Switch account while normal browsing retains the session.

## Checks and their limits

`npm test` runs regression, editor-transport, moderation, database-safety, and backup-retention checks. `npm run test:features` and `npm run test:runtime-role` exercise database behavior; follow their isolated-database prerequisites before running them. `npm run test:browser` covers public browsing and authentication redirects.

The [October 1 feature report](FEATURES.md) records browser and PostgreSQL checks, including forged writes, other-author edits, cross-community moderation, and private notification access. Those results describe that revision and environment. They do not establish that every later feature or production workflow has passed the same checks.

### Dependency review needs renewal

The local `braces` nesting-depth mitigation is checksum verified and tested against excessive nesting. Its advisory-specific audit exception expired **October 17, 2026 at 00:00 UTC**. The audit policy rejects expired approval. A fresh review or an upstream fix is required; the mitigation does not remove npm's upstream advisory.

See [dependency security](docs/dependency-security.md). Do not extend the exception automatically or treat a successful build as security approval.

## Deployment

The GitHub repository is `NgoBenny/common` and the Vercel project is `common`. The configured demo address is [common-ngobenny.vercel.app](https://common-ngobenny.vercel.app). Earlier release notes describe a redirect to the prior production address; verify the current origin and deployed revision before a cutover.

For the production address cutover, add `https://common-ngobenny.vercel.app/api/auth/kinde_callback` to Kinde's allowed callbacks and `https://common-ngobenny.vercel.app` to its logout allowlist. Set production `KINDE_SITE_URL` and `KINDE_POST_LOGOUT_REDIRECT_URL` to the new origin, and `KINDE_POST_LOGIN_REDIRECT_URL` to its `/api/auth/creation` URL. Deploy the release, connect the Common domain to Production, and redirect the old domain to Common. Verify login, logout and account switching on the new origin before removing any old callback entries. Preview deployments need their own exact allowed origins and matching environment variables.

Feature and moderation releases require the additive migrations described in [FEATURES.md](FEATURES.md) and [docs/moderation.md](docs/moderation.md), with a fresh restore-tested backup first. The older audit and release records describe their own checkpoints, not current production status.

## Current limits

Notifications refresh on navigation or reload; push and email delivery are outside this release. Search uses PostgreSQL ILIKE, and a post page loads its reply tree. Indexed search and thread pagination would need measured usage to justify them. There are no adoption or scalability benchmarks.

The app depends on hosted authentication, PostgreSQL, and uploads. A successful deployment does not establish that all three services are available.

## Project history

Common began as Reddit Clone 2.0 and was bootstrapped with [create-next-app](https://github.com/vercel/next.js/tree/canary/packages/create-next-app). The [audit and revival guide](AUDIT.md) records the original application, recovery, and subsequent repairs.
