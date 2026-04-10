# NPG Kanban Task Board - Step-by-Step Setup

This guide matches your internship assessment requirements: React + TypeScript frontend, ASP.NET Core API backend, Supabase (free tier), guest accounts, and RLS.

## 1) Supabase Project Setup

1. Create a new Supabase project (free tier).
2. In Supabase Dashboard, go to **Authentication -> Providers -> Anonymous** and enable it.
3. Go to **SQL Editor** and run this full schema script:

```sql
create extension if not exists "pgcrypto";

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0 and char_length(name) <= 60),
  color text not null default '#6366f1',
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0 and char_length(title) <= 100),
  description text null check (description is null or char_length(description) <= 500),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_date date null,
  assignee_id uuid null references public.team_members(id) on delete set null,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'in_review', 'done')),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  type text not null check (type in ('status_changed', 'due_date_changed', 'task_deleted')),
  from_value text null,
  to_value text null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- If you created tables earlier without defaults, run these too:
alter table public.team_members alter column user_id set default auth.uid();
alter table public.tasks alter column user_id set default auth.uid();
alter table public.task_activity alter column user_id set default auth.uid();

alter table public.team_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_activity enable row level security;

drop policy if exists "team_members_select_own" on public.team_members;
create policy "team_members_select_own"
on public.team_members
for select
using (auth.uid() = user_id);

drop policy if exists "team_members_insert_own" on public.team_members;
create policy "team_members_insert_own"
on public.team_members
for insert
with check (auth.uid() = user_id);

drop policy if exists "team_members_update_own" on public.team_members;
create policy "team_members_update_own"
on public.team_members
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "team_members_delete_own" on public.team_members;
create policy "team_members_delete_own"
on public.team_members
for delete
using (auth.uid() = user_id);

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own"
on public.tasks
for select
using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own"
on public.tasks
for insert
with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
on public.tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own"
on public.tasks
for delete
using (auth.uid() = user_id);

drop policy if exists "task_activity_select_own" on public.task_activity;
create policy "task_activity_select_own"
on public.task_activity
for select
using (auth.uid() = user_id);

drop policy if exists "task_activity_insert_own" on public.task_activity;
create policy "task_activity_insert_own"
on public.task_activity
for insert
with check (auth.uid() = user_id);

create index if not exists idx_tasks_user_created_at on public.tasks(user_id, created_at desc);
create index if not exists idx_tasks_user_status on public.tasks(user_id, status);
create index if not exists idx_team_members_user_created_at on public.team_members(user_id, created_at asc);
create index if not exists idx_task_activity_task_created_at on public.task_activity(task_id, created_at desc);
```

## 2) Frontend Environment Variables (secure)

Create `npgkanbanstyletaskboard.client/.env` from `.env.example`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

- Use only **anon key** in frontend.
- Never commit `.env`.

## 3) Backend Secrets (secure)

Do not place keys in source files. Use .NET user secrets for local development:

```powershell
cd "D:\.Net Full stack learning\Projects\NPGKanbanStyleTaskBoard\NPGKanbanStyleTaskBoard.Server"
dotnet user-secrets init
dotnet user-secrets set "Supabase:Url" "https://YOUR_PROJECT_ID.supabase.co"
dotnet user-secrets set "Supabase:AnonKey" "YOUR_SUPABASE_ANON_KEY"
```

For production hosting, set environment variables/configuration values for:

- `Supabase__Url`
- `Supabase__AnonKey`

## 4) Run Locally

1. Start backend:
   - `dotnet run --project "NPGKanbanStyleTaskBoard.Server"`
2. Start frontend:
   - `npm start --prefix "npgkanbanstyletaskboard.client"`
3. Open app via the ASP.NET URL (`https://localhost:7056`).

## 5) Implemented Features in This Codebase

- Kanban board columns: To Do, In Progress, In Review, Done
- Create task (title, description, priority, due date)
- Drag-and-drop task movement between columns
- Search by task title
- Filters: priority + assignee
- Due-date urgency indicators (scheduled, due soon, overdue)
- Team members and task assignees
- Board summary stats (total, completed, overdue)
- Guest anonymous auth auto-created on first launch
- Per-user data isolation via Supabase RLS
- Loading, error, and empty states
- Responsive polished UI styling

## 6) Hosting (Vercel + Render)

**Order:** deploy **Render (API) first**, then point **Vercel** at it via `vercel.json` rewrites.

### A) Render — ASP.NET backend (Docker)

Render’s default **Node** build image does **not** include `dotnet`. This repo includes a root **`Dockerfile`** so the build runs in Microsoft’s **.NET SDK** image.

1. **Commit and push** `Dockerfile` and `.dockerignore` from the repo root.
2. [render.com](https://render.com) → your **Web Service** → **Settings**.
3. **Environment** → set to **Docker** (not Node).
4. **Dockerfile path:** `Dockerfile` (repo root).
5. **Build command:** leave **empty** (Docker build handles it).
6. **Start command:** leave **empty** (image `ENTRYPOINT` runs the app).
7. **Environment variables** (same as before):
   - `Supabase__Url` = your Supabase project URL
   - `Supabase__AnonKey` = your Supabase anon/public key
   - `ASPNETCORE_ENVIRONMENT` = `Production`
   - Render injects **`PORT`** automatically; `Program.cs` listens on it.
8. **Manual deploy** → **Deploy latest commit** (or push to `main` to trigger build).
9. Open `https://your-service.onrender.com/swagger`

If you still see “Using Node.js”, create a **new** Web Service and pick **Docker** at creation time, or remove any **Root Directory** override that points at a Node app.

### B) Vercel — React (Vite) frontend

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → import the same repo.
2. **Root Directory:** `npgkanbanstyletaskboard.client`
3. Framework: **Vite** (auto). **Build:** `npm run build` · **Output:** `dist`
4. **Environment Variables** (Project → Settings → Environment Variables):
   - `VITE_SUPABASE_URL` = same as local `.env`
   - `VITE_SUPABASE_ANON_KEY` = same anon key (never service role)
5. Edit `npgkanbanstyletaskboard.client/vercel.json`: replace `YOUR_RENDER_SERVICE` with your real Render hostname (no trailing slash), e.g. `https://npg-api.onrender.com`
6. Commit and push `vercel.json` + redeploy Vercel.
7. Open your **Vercel URL** — the app calls `/api/...`, which Vercel proxies to Render.



