# Common

A full-stack community discussion app built with Next.js 15, TypeScript, PostgreSQL, and Prisma. It combines rich-text and image posts, searchable feeds, votes, saves, and readable threaded conversations with inline replies.

Server actions enforce ownership and moderation permissions, database-backed participation restrictions, and reversible community removal. Editor JSON normalization, draft retention, and targeted regression checks address failures across the interface-to-storage workflow.

Login explicitly opens Kinde's sign-in choices rather than silently reusing its SSO session. Signed-in users can select **Switch account** from the account menu. Existing sessions still persist during normal browsing.

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

Dependency tooling uses a temporary, verified nesting-depth mitigation, not an upstream vulnerability fix. See [dependency security](docs/dependency-security.md) for the audit policy and October 17, 2026 UTC review expiry.

## Getting Started

See [the audit and revival guide](AUDIT.md) for the deployment diagnosis, changes, and remaining feature backlog. Use Node 24.x, run `npm ci`, and copy `.env.example` to `.env.local` with your own Supabase, Kinde, and UploadThing settings. Run `npm run db:check` to verify database access before starting the app. Never commit `.env.local`.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The GitHub repository is `NgoBenny/common` and the Vercel project is `common`. The staged address [common-ngobenny.vercel.app](https://common-ngobenny.vercel.app) temporarily redirects to the existing production address until the Common release.

For the production address cutover, add `https://common-ngobenny.vercel.app/api/auth/kinde_callback` to Kinde's allowed callbacks and `https://common-ngobenny.vercel.app` to its logout allowlist. Set production `KINDE_SITE_URL` and `KINDE_POST_LOGOUT_REDIRECT_URL` to the new origin, and `KINDE_POST_LOGIN_REDIRECT_URL` to its `/api/auth/creation` URL. Deploy the release, connect the Common domain to Production, and redirect the old domain to Common. Verify login, logout and account switching on the new origin before removing any old callback entries. Preview deployments need their own exact allowed origins and matching environment variables.

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
