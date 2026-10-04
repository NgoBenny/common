-- Operator-run hardening, NOT a Prisma schema migration. Review before production.
-- Keep the schema owner in DIRECT_URL. Give only the server runtime this role.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'common_app') THEN
    CREATE ROLE common_app NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'common_app' AND
    (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolreplication)) THEN
    RAISE EXCEPTION 'Existing common_app role is too privileged; inspect before proceeding';
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO common_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."User", public."Subreddit",
  public."Post", public."Vote", public."Comment", public."Membership",
  public."SavedPost", public."Report", public."Notification", public."UserRestriction" TO common_app;
GRANT SELECT, INSERT ON public."ModerationEvent" TO common_app;
REVOKE UPDATE, DELETE ON public."ModerationEvent" FROM common_app;
-- Explicit API-role revocation: Prisma uses a server connection, not the Data API.
REVOKE ALL ON TABLE public."User", public."Subreddit", public."Post", public."Vote",
  public."Comment", public."Membership", public."SavedPost", public."Report",
  public."Notification", public."UserRestriction", public."ModerationEvent", public."_prisma_migrations" FROM anon, authenticated;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['User','Subreddit','Post','Vote','Comment','Membership','SavedPost','Report','Notification','UserRestriction','ModerationEvent'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='common_server_runtime') THEN
      EXECUTE format('CREATE POLICY common_server_runtime ON public.%I FOR ALL TO common_app USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;
COMMIT;
-- No password is created here. Set LOGIN and a new password privately in Supabase.
-- Then test all app workflows with common_app and update Vercel DATABASE_URL.
-- Never give this role to a browser; application authorization remains server-side.
