-- migration purpose: bootstrap tenant-aware plant planning schema for mvp
-- affected entities: extensions, enums, helper functions, profiles, plants, watering_plans, watering_tasks, ai_requests
-- notes: includes rls, helper triggers, data integrity constraints, and indexes; all statements are safe to re-run thanks to conditional creation guards where supported

-- ensure required extension for uuid generation is present
create extension if not exists "pgcrypto";

-- enum types representing user-visible choices and system states
do $$
begin
    if not exists (
        select 1
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typname = 'plant_created_source'
    ) then
        create type public.plant_created_source as enum ('manual', 'import');
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typname = 'watering_task_status'
    ) then
        create type public.watering_task_status as enum ('pending', 'completed');
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typname = 'watering_task_source'
    ) then
        create type public.watering_task_source as enum ('scheduled', 'adhoc');
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typname = 'watering_schedule_basis'
    ) then
        create type public.watering_schedule_basis as enum ('due_on', 'completed_on');
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typname = 'watering_plan_start_from'
    ) then
        create type public.watering_plan_start_from as enum ('today', 'purchase_date', 'custom_date');
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typname = 'watering_overdue_policy'
    ) then
        create type public.watering_overdue_policy as enum ('carry_forward', 'reschedule');
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typname = 'ai_request_status'
    ) then
        create type public.ai_request_status as enum ('success', 'error', 'rate_limited', 'skipped');
    end if;
end
$$;

-- helper for consistent normalization of species names (immutable for generated column usage)
create or replace function public.normalize_species_name(input text)
returns text
language sql
immutable
as $$
    select case
        when input is null then null
        else regexp_replace(lower(trim(input)), '\s+', ' ', 'g')
    end
$$;

-- generic trigger to keep updated_at fresh on every mutation
create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- trigger to block updates to plants.species_name (immutable requirement for mvp)
create or replace function public.prevent_species_name_change()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'update' and new.species_name is distinct from old.species_name then
        raise exception 'species_name is immutable for plants %', old.id;
    end if;
    return new;
end;
$$;

-- table: profiles (1:1 with auth.users)
create table if not exists public.profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    nickname varchar(60),
    timezone varchar(64) not null default 'utc',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint profiles_timezone_length_chk check (char_length(timezone) between 1 and 64),
    constraint profiles_nickname_length_chk check (nickname is null or char_length(nickname) between 1 and 60)
);

-- table: plants (user owned collection)
create table if not exists public.plants (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    species_name varchar(120) not null,
    species_name_normalized varchar(120) generated always as (public.normalize_species_name(species_name)) stored,
    duplicate_index int not null default 0,
    nickname varchar(80),
    description text,
    purchase_date date,
    photo_path text,
    created_source public.plant_created_source not null default 'manual',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint plants_duplicate_index_chk check (duplicate_index >= 0),
    constraint plants_species_name_length_chk check (char_length(species_name) between 1 and 120),
    constraint plants_nickname_length_chk check (nickname is null or char_length(nickname) between 1 and 80),
    constraint plants_unique_species_dup unique (user_id, species_name_normalized, duplicate_index)
);

-- table: ai_requests (auditing ai usage; insert via service/backend only)
create table if not exists public.ai_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    plant_id uuid references public.plants(id) on delete set null,
    requested_at timestamptz not null default now(),
    provider text not null default 'openrouter',
    model text,
    status public.ai_request_status not null,
    latency_ms int,
    prompt_tokens int,
    completion_tokens int,
    total_tokens int,
    error_code text,
    error_message text,
    created_at timestamptz not null default now(),
    constraint ai_requests_latency_chk check (latency_ms is null or latency_ms >= 0),
    constraint ai_requests_prompt_tokens_chk check (prompt_tokens is null or prompt_tokens >= 0),
    constraint ai_requests_completion_tokens_chk check (completion_tokens is null or completion_tokens >= 0),
    constraint ai_requests_total_tokens_chk check (total_tokens is null or total_tokens >= 0)
);

-- table: watering_plans (versioned schedules per plant)
create table if not exists public.watering_plans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    plant_id uuid not null references public.plants(id) on delete cascade,
    interval_days int not null,
    horizon_days smallint not null default 90,
    schedule_basis public.watering_schedule_basis not null default 'completed_on',
    start_from public.watering_plan_start_from not null default 'today',
    custom_start_on date,
    overdue_policy public.watering_overdue_policy not null default 'carry_forward',
    is_active boolean not null default true,
    valid_from timestamptz not null default now(),
    valid_to timestamptz,
    was_ai_suggested boolean not null default false,
    was_ai_accepted_without_changes boolean,
    ai_request_id uuid references public.ai_requests(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint watering_plans_interval_days_chk check (interval_days between 1 and 365),
    constraint watering_plans_horizon_days_chk check (horizon_days between 1 and 365),
    constraint watering_plans_custom_start_chk check (
        (start_from = 'custom_date' and custom_start_on is not null)
        or (start_from <> 'custom_date' and custom_start_on is null)
    ),
    constraint watering_plans_active_state_chk check (
        (is_active and valid_to is null) or (not is_active and valid_to is not null)
    )
);

-- table: watering_tasks (materialized tasks for timelines)
create table if not exists public.watering_tasks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    plant_id uuid not null references public.plants(id) on delete cascade,
    plan_id uuid references public.watering_plans(id) on delete cascade,
    due_on date not null,
    status public.watering_task_status not null default 'pending',
    source public.watering_task_source not null default 'scheduled',
    note text,
    completed_at timestamptz,
    completed_on date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint watering_tasks_unique_per_day unique (plant_id, due_on),
    constraint watering_tasks_completion_consistency_chk check (
        (status = 'completed' and completed_at is not null and completed_on is not null)
        or (status = 'pending' and completed_at is null and completed_on is null)
    ),
    constraint watering_tasks_source_plan_chk check (
        (source <> 'scheduled' or plan_id is not null)
    ),
    constraint watering_tasks_source_adhoc_status_chk check (
        (source <> 'adhoc' or status = 'completed')
    ),
    constraint watering_tasks_source_adhoc_due_chk check (
        (source <> 'adhoc' or due_on = completed_on)
    )
);

-- ensure at most one active plan per plant via partial unique index
create unique index if not exists watering_plans_active_plant_uidx
    on public.watering_plans (plant_id)
    where (is_active);

-- history-friendly ordering indexes for watering_plans
create index if not exists watering_plans_plant_active_idx
    on public.watering_plans (plant_id)
    where (is_active);

create index if not exists watering_plans_plant_valid_from_idx
    on public.watering_plans (plant_id, valid_from desc);

-- plants listing and lookup indexes
create index if not exists plants_user_created_at_idx
    on public.plants (user_id, created_at desc);

create index if not exists plants_user_species_norm_idx
    on public.plants (user_id, species_name_normalized);

-- watering_tasks calendar-friendly indexes
create index if not exists watering_tasks_user_due_on_idx
    on public.watering_tasks (user_id, due_on);

create index if not exists watering_tasks_plant_due_on_idx
    on public.watering_tasks (plant_id, due_on);

create index if not exists watering_tasks_user_status_due_on_idx
    on public.watering_tasks (user_id, status, due_on);

create index if not exists watering_tasks_user_due_on_pending_idx
    on public.watering_tasks (user_id, due_on)
    where (status = 'pending');

-- ai_requests reporting indexes
create index if not exists ai_requests_user_requested_at_idx
    on public.ai_requests (user_id, requested_at desc);

create index if not exists ai_requests_user_status_requested_at_idx
    on public.ai_requests (user_id, status, requested_at desc);

-- trigger helpers requiring existing tables ----------------------------------------------------

-- derive user_id for watering_plans from owning plant to avoid tenant leaks
create or replace function public.sync_watering_plan_user_id()
returns trigger
language plpgsql
as $$
declare
    owner_id uuid;
begin
    select p.user_id into owner_id
    from public.plants p
    where p.id = new.plant_id;

    if owner_id is null then
        raise exception 'plant % not found for watering_plans row', new.plant_id;
    end if;

    if new.user_id is not null and new.user_id <> owner_id then
        raise exception 'user_id mismatch for watering_plans row %', new.id;
    end if;

    new.user_id := owner_id;
    return new;
end;
$$;

-- derive user_id for watering_tasks and verify optional plan consistency
create or replace function public.sync_watering_task_user_id()
returns trigger
language plpgsql
as $$
declare
    owner_id uuid;
    plan_plant_id uuid;
begin
    select p.user_id into owner_id
    from public.plants p
    where p.id = new.plant_id;

    if owner_id is null then
        raise exception 'plant % not found for watering_tasks row', new.plant_id;
    end if;

    if new.plan_id is not null then
        select wp.plant_id into plan_plant_id
        from public.watering_plans wp
        where wp.id = new.plan_id;

        if plan_plant_id is null then
            raise exception 'watering_plan % not found for watering_tasks row', new.plan_id;
        end if;

        if plan_plant_id <> new.plant_id then
            raise exception 'plan % does not belong to plant %', new.plan_id, new.plant_id;
        end if;
    end if;

    new.user_id := owner_id;
    return new;
end;
$$;

-- attach triggers to enforce invariants and housekeeping
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
    before update on public.profiles
    for each row
    execute function public.set_updated_at_timestamp();

drop trigger if exists plants_set_updated_at on public.plants;
create trigger plants_set_updated_at
    before update on public.plants
    for each row
    execute function public.set_updated_at_timestamp();

drop trigger if exists plants_species_name_immutable on public.plants;
create trigger plants_species_name_immutable
    before update on public.plants
    for each row
    execute function public.prevent_species_name_change();

drop trigger if exists watering_plans_set_updated_at on public.watering_plans;
create trigger watering_plans_set_updated_at
    before update on public.watering_plans
    for each row
    execute function public.set_updated_at_timestamp();

drop trigger if exists watering_plans_sync_user_id on public.watering_plans;
create trigger watering_plans_sync_user_id
    before insert or update on public.watering_plans
    for each row
    execute function public.sync_watering_plan_user_id();

drop trigger if exists watering_tasks_set_updated_at on public.watering_tasks;
create trigger watering_tasks_set_updated_at
    before update on public.watering_tasks
    for each row
    execute function public.set_updated_at_timestamp();

drop trigger if exists watering_tasks_sync_user_id on public.watering_tasks;
create trigger watering_tasks_sync_user_id
    before insert or update on public.watering_tasks
    for each row
    execute function public.sync_watering_task_user_id();

-- row level security configuration -------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.plants enable row level security;
alter table public.watering_plans enable row level security;
alter table public.watering_tasks enable row level security;
alter table public.ai_requests enable row level security;

-- profiles policies (owner-only access; clients manage their own profile)
drop policy if exists profiles_select_own_authenticated on public.profiles;
create policy profiles_select_own_authenticated
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists profiles_select_own_anon on public.profiles;
create policy profiles_select_own_anon
on public.profiles
for select
to anon
using (false);

drop policy if exists profiles_insert_own_authenticated on public.profiles;
create policy profiles_insert_own_authenticated
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists profiles_insert_own_anon on public.profiles;
create policy profiles_insert_own_anon
on public.profiles
for insert
to anon
with check (false);

drop policy if exists profiles_update_own_authenticated on public.profiles;
create policy profiles_update_own_authenticated
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists profiles_update_own_anon on public.profiles;
create policy profiles_update_own_anon
on public.profiles
for update
to anon
using (false)
with check (false);

-- plants policies (tenant isolation across all verbs)
drop policy if exists plants_select_own_authenticated on public.plants;
create policy plants_select_own_authenticated
on public.plants
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists plants_select_own_anon on public.plants;
create policy plants_select_own_anon
on public.plants
for select
to anon
using (false);

drop policy if exists plants_insert_own_authenticated on public.plants;
create policy plants_insert_own_authenticated
on public.plants
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists plants_insert_own_anon on public.plants;
create policy plants_insert_own_anon
on public.plants
for insert
to anon
with check (false);

drop policy if exists plants_update_own_authenticated on public.plants;
create policy plants_update_own_authenticated
on public.plants
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists plants_update_own_anon on public.plants;
create policy plants_update_own_anon
on public.plants
for update
to anon
using (false)
with check (false);

drop policy if exists plants_delete_own_authenticated on public.plants;
create policy plants_delete_own_authenticated
on public.plants
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists plants_delete_own_anon on public.plants;
create policy plants_delete_own_anon
on public.plants
for delete
to anon
using (false);

-- watering_plans policies (read-only to owners; mutations via rpc/service role)
drop policy if exists watering_plans_select_own_authenticated on public.watering_plans;
create policy watering_plans_select_own_authenticated
on public.watering_plans
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists watering_plans_select_own_anon on public.watering_plans;
create policy watering_plans_select_own_anon
on public.watering_plans
for select
to anon
using (false);

-- watering_tasks policies (read-only to owners; mutations via rpc/service role)
drop policy if exists watering_tasks_select_own_authenticated on public.watering_tasks;
create policy watering_tasks_select_own_authenticated
on public.watering_tasks
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists watering_tasks_select_own_anon on public.watering_tasks;
create policy watering_tasks_select_own_anon
on public.watering_tasks
for select
to anon
using (false);

-- ai_requests policies (owners can inspect their usage; inserts handled server-side)
drop policy if exists ai_requests_select_own_authenticated on public.ai_requests;
create policy ai_requests_select_own_authenticated
on public.ai_requests
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists ai_requests_select_own_anon on public.ai_requests;
create policy ai_requests_select_own_anon
on public.ai_requests
for select
to anon
using (false);
