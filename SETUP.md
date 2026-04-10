# Setup and deployment

Kanban task board: **React (Vite) + TypeScript** frontend, **ASP.NET Core** API, **Supabase** (Postgres, auth, RLS).

## 1) Supabase

1. Create a Supabase project.
2. **Authentication → Providers → Anonymous** — enable anonymous sign-in.
3. **SQL Editor** — run:

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

alter table public.team_members alter column user_id set default auth.uid();
alter table public.tasks alter column user_id set default auth.uid();
alter table public.task_activity alter column user_id set default auth.uid();

alter table public.team_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_activity enable row level security;

drop policy if exists "team_members_select_own" on public.team_members;
create policy "team_members_select_own"
on public.team_members for select using (auth.uid() = user_id);

drop policy if exists "team_members_insert_own" on public.team_members;
create policy "team_members_insert_own"
on public.team_members for insert with check (auth.uid() = user_id);

drop policy if exists "team_members_update_own" on public.team_members;
create policy "team_members_update_own"
on public.team_members for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "team_members_delete_own" on public.team_members;
create policy "team_members_delete_own"
on public.team_members for delete using (auth.uid() = user_id);

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own"
on public.tasks for select using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own"
on public.tasks for insert with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
on public.tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own"
on public.tasks for delete using (auth.uid() = user_id);

drop policy if exists "task_activity_select_own" on public.task_activity;
create policy "task_activity_select_own"
on public.task_activity for select using (auth.uid() = user_id);

drop policy if exists "task_activity_insert_own" on public.task_activity;
create policy "task_activity_insert_own"
on public.task_activity for insert with check (auth.uid() = user_id);

-- Labels, task–label links, and comments (run this block on existing projects that only had the tables above)
create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0 and char_length(name) <= 40),
  color text not null default '#6366f1',
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 4000),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.labels alter column user_id set default auth.uid();
alter table public.task_comments alter column user_id set default auth.uid();

alter table public.labels enable row level security;
alter table public.task_labels enable row level security;
alter table public.task_comments enable row level security;

drop policy if exists "labels_select_own" on public.labels;
create policy "labels_select_own"
on public.labels for select using (auth.uid() = user_id);

drop policy if exists "labels_insert_own" on public.labels;
create policy "labels_insert_own"
on public.labels for insert with check (auth.uid() = user_id);

drop policy if exists "labels_update_own" on public.labels;
create policy "labels_update_own"
on public.labels for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "labels_delete_own" on public.labels;
create policy "labels_delete_own"
on public.labels for delete using (auth.uid() = user_id);

drop policy if exists "task_labels_select_via_task" on public.task_labels;
create policy "task_labels_select_via_task"
on public.task_labels for select
using (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()));

drop policy if exists "task_labels_insert_via_task" on public.task_labels;
create policy "task_labels_insert_via_task"
on public.task_labels for insert
with check (
  exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid())
  and exists (select 1 from public.labels l where l.id = label_id and l.user_id = auth.uid())
);

drop policy if exists "task_labels_delete_via_task" on public.task_labels;
create policy "task_labels_delete_via_task"
on public.task_labels for delete
using (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()));

drop policy if exists "task_comments_select_via_task" on public.task_comments;
create policy "task_comments_select_via_task"
on public.task_comments for select
using (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()));

drop policy if exists "task_comments_insert_via_task" on public.task_comments;
create policy "task_comments_insert_via_task"
on public.task_comments for insert
with check (
  exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid())
  and auth.uid() = user_id
);

create index if not exists idx_tasks_user_created_at on public.tasks(user_id, created_at desc);
create index if not exists idx_tasks_user_status on public.tasks(user_id, status);
create index if not exists idx_team_members_user_created_at on public.team_members(user_id, created_at asc);
create index if not exists idx_task_activity_task_created_at on public.task_activity(task_id, created_at desc);
create index if not exists idx_labels_user_name on public.labels(user_id, name);
create index if not exists idx_task_comments_task_created_at on public.task_comments(task_id, created_at asc);
```

## 2) Frontend environment

Copy `npgkanbanstyletaskboard.client/.env.example` to `.env` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (anon/public key only — not the service role key)

Do not commit `.env`.

## 3) Backend secrets (local)

From the server project directory:

```bash
cd NPGKanbanStyleTaskBoard.Server
dotnet user-secrets init
dotnet user-secrets set "Supabase:Url" "https://YOUR_PROJECT_ID.supabase.co"
dotnet user-secrets set "Supabase:AnonKey" "YOUR_SUPABASE_ANON_KEY"
```

Production: set `Supabase__Url` and `Supabase__AnonKey` on the host (e.g. Render).

## 4) Run locally

1. Backend: `dotnet run --project NPGKanbanStyleTaskBoard.Server`
2. Frontend: `npm start --prefix npgkanbanstyletaskboard.client`
3. Open the app at the Kestrel URL shown in the terminal (e.g. `https://localhost:7056`).

## 5) Features (summary)

- Kanban columns: To Do, In Progress, In Review, Done  
- Tasks: create, drag to change status, optional description / priority / due date / assignee  
- Team members and assignees  
- Search and filters  
- Guest anonymous sessions; data scoped per user via RLS  
- Task history (activity) and delete with confirmation  
- Labels / tags on tasks and optional label filter  
- Task comments (thread in the history panel)  
- Responsive UI  

## 6) Hosting (example: Render API + Vercel UI)

Deploy the **API first** (Docker — root `Dockerfile`), then point the frontend at it with `npgkanbanstyletaskboard.client/vercel.json` rewrites to `/api/*`.

**Render (Docker):** runtime Docker, Dockerfile path `Dockerfile`, empty build/start override. Env: `Supabase__Url`, `Supabase__AnonKey`, `ASPNETCORE_ENVIRONMENT=Production`. The API root `/` redirects to `/swagger` (the Docker image does not bundle the React `index.html` in `wwwroot` — the live UI is on Vercel).

**Vercel:** root directory `npgkanbanstyletaskboard.client`, framework Vite, build `npm run build`, output `dist`. Set the same `VITE_*` vars as local `.env`. Set `vercel.json` `destination` to your Render API base URL.
