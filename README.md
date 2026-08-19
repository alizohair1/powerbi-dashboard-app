# Branch Dashboards

Login-gated Power BI dashboard viewer. Each person sees only their assigned
dashboard; an admin panel controls who has access and which link they see.

## How it works

- **Auth**: Supabase Auth (email + password). No self-signup - an admin
  creates every account.
- **Data**: one `profiles` table in Supabase Postgres, one row per person
  (`role`, `branch`, `dashboard_url`).
- **Routing**: signing in redirects to `/admin` (if `role = admin`) or
  `/dashboard` (everyone else), which renders `dashboard_url` in an iframe.
- **Admin actions** (`/api/admin/users/*`) run server-side with the Supabase
  service role key, after checking the caller is an admin - the key never
  reaches the browser.

## One-time setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL Editor.
3. Copy `.env.local.example` to `.env.local` and fill in your project's URL
   and keys (Project Settings -> API).
4. Create the first admin: Supabase Dashboard -> Authentication -> Users ->
   Add user (set a password, confirm email). Then in the SQL Editor:
   ```sql
   insert into public.profiles (id, email, role, full_name)
   values ('paste-the-user-id-here', 'their@email.com', 'admin', 'Their Name');
   ```
   Every user after that can be added from the app's Admin panel.

See the setup instructions provided alongside this project for exact
commands to run locally, push to GitHub, and deploy to Vercel.
