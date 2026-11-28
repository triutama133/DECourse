-- DataForge: save each learner's progress online.
-- Run once in your Supabase project:  SQL Editor > New query > paste this whole file > Run.
-- Safe to run again.
--
-- One row per learner. `data` holds a snapshot of the app's progress (see app/js/cloud-sync.js).
-- Row Level Security means a signed-in learner can read and write ONLY their own row; the public
-- "anon" key in the web page can do nothing at all without signing in.

create table if not exists public.learning_progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint learning_progress_data_is_object check (jsonb_typeof(data) = 'object'),
  constraint learning_progress_data_size check (pg_column_size(data) < 3000000)
);

alter table public.learning_progress enable row level security;

drop policy if exists "own row: read"   on public.learning_progress;
drop policy if exists "own row: insert" on public.learning_progress;
drop policy if exists "own row: update" on public.learning_progress;
drop policy if exists "own row: delete" on public.learning_progress;

create policy "own row: read"   on public.learning_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "own row: insert" on public.learning_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own row: update" on public.learning_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own row: delete" on public.learning_progress for delete to authenticated using ((select auth.uid()) = user_id);

-- Nobody who is not signed in gets any access.
revoke all on public.learning_progress from anon;
grant select, insert, update, delete on public.learning_progress to authenticated;

-- updated_at moves on every update. The web app uses it to detect that another device saved in between.
create or replace function public.learning_progress_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end $$;

drop trigger if exists learning_progress_touch on public.learning_progress;
create trigger learning_progress_touch before update on public.learning_progress
  for each row execute function public.learning_progress_touch();
