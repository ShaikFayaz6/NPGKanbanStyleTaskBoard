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
  user_id uuid not null references auth.users(id) on delete cascade,
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
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.team_members enable row level security;
alter table public.tasks enable row level security;

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

create index if not exists idx_tasks_user_created_at on public.tasks(user_id, created_at desc);
create index if not exists idx_tasks_user_status on public.tasks(user_id, status);
create index if not exists idx_team_members_user_created_at on public.team_members(user_id, created_at asc);
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

## 6) Hosting

Recommended fast path:

- Deploy frontend (`npgkanbanstyletaskboard.client`) to Vercel.
- Deploy ASP.NET backend (`NPGKanbanStyleTaskBoard.Server`) to Render/Railway/Azure free option.
- In hosted frontend, set API base to hosted backend domain if needed.
- In hosted backend, set `Supabase__Url` and `Supabase__AnonKey` in secret env vars.

## 7) Final Submission Document Checklist

- Architecture and design decisions
- Live app URL
- GitHub repo URL
- Full SQL schema (from section 1)
- Local setup instructions (sections 2-4)
- Advanced features implemented
- Tradeoffs and future improvements
