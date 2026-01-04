-- migration purpose: helpers for atomically versioning watering plans and regenerating tasks
-- affected entities: functions set_watering_plan_version, regenerate_watering_tasks

create or replace function public.set_watering_plan_version(
    p_user_id uuid,
    p_plant_id uuid,
    p_interval_days integer,
    p_horizon_days integer,
    p_schedule_basis public.watering_schedule_basis,
    p_start_from public.watering_plan_start_from,
    p_custom_start_on date,
    p_overdue_policy public.watering_overdue_policy,
    p_was_ai_suggested boolean,
    p_was_ai_accepted_without_changes boolean,
    p_ai_request_id uuid
)
returns public.watering_plans
language plpgsql
security definer
set search_path = public
as $$
declare
    caller_id uuid := auth.uid();
    new_plan public.watering_plans;
begin
    if caller_id is null then
        raise exception 'set_watering_plan_version requires an authenticated user';
    end if;

    if caller_id <> p_user_id then
        raise exception 'set_watering_plan_version caller mismatch';
    end if;

    update public.watering_plans
    set is_active = false,
        valid_to = now()
    where plant_id = p_plant_id
      and user_id = p_user_id
      and is_active;

    insert into public.watering_plans (
        user_id,
        plant_id,
        interval_days,
        horizon_days,
        schedule_basis,
        start_from,
        custom_start_on,
        overdue_policy,
        is_active,
        valid_from,
        valid_to,
        was_ai_suggested,
        was_ai_accepted_without_changes,
        ai_request_id
    )
    values (
        p_user_id,
        p_plant_id,
        p_interval_days,
        p_horizon_days,
        p_schedule_basis,
        p_start_from,
        p_custom_start_on,
        p_overdue_policy,
        true,
        now(),
        null,
        coalesce(p_was_ai_suggested, false),
        p_was_ai_accepted_without_changes,
        p_ai_request_id
    )
    returning * into new_plan;

    return new_plan;
end;
$$;

create or replace function public.regenerate_watering_tasks(
    p_user_id uuid,
    p_plant_id uuid,
    p_plan_id uuid,
    p_interval_days integer,
    p_horizon_days integer,
    p_schedule_basis public.watering_schedule_basis,
    p_start_from public.watering_plan_start_from,
    p_custom_start_on date
)
returns table(from_date date, to_date date, task_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
    caller_id uuid := auth.uid();
    plant_purchase_date date;
    start_date date;
    last_completed_on date;
begin
    if caller_id is null then
        raise exception 'regenerate_watering_tasks requires an authenticated user';
    end if;

    if caller_id <> p_user_id then
        raise exception 'regenerate_watering_tasks caller mismatch';
    end if;

    select p.purchase_date
    into plant_purchase_date
    from public.plants p
    where p.id = p_plant_id
      and p.user_id = p_user_id;

    if not found then
        raise exception 'Plant % not found for regeneration', p_plant_id;
    end if;

    start_date := case
        when p_start_from = 'custom_date' then coalesce(p_custom_start_on, current_date)
        when p_start_from = 'purchase_date' then coalesce(plant_purchase_date, current_date)
        else current_date
    end;

    if start_date < current_date then
        start_date := current_date;
    end if;

    if p_schedule_basis = 'completed_on' then
        select wt.completed_on
        into last_completed_on
        from public.watering_tasks wt
        where wt.plant_id = p_plant_id
          and wt.user_id = p_user_id
          and wt.status = 'completed'
          and wt.completed_on is not null
        order by wt.completed_on desc
        limit 1;

        if last_completed_on is not null then
            start_date := greatest(last_completed_on + p_interval_days, start_date);
        end if;
    end if;

    delete from public.watering_tasks
    where plant_id = p_plant_id
      and user_id = p_user_id
      and status = 'pending'
      and due_on >= current_date;

    with task_dates as (
        select (start_date + (seq.step * interval '1 day'))::date as due_on
        from generate_series(
            0,
            greatest(p_horizon_days - 1, 0),
            greatest(p_interval_days, 1)
        ) as seq(step)
    ),
    inserted as (
        insert into public.watering_tasks (
            user_id,
            plant_id,
            plan_id,
            due_on,
            status,
            source
        )
        select
            p_user_id,
            p_plant_id,
            p_plan_id,
            task_dates.due_on,
            'pending',
            'scheduled'
        from task_dates
        returning due_on
    )
    select
        min(due_on),
        max(due_on),
        count(*)::integer
    into
        from_date,
        to_date,
        task_count
    from inserted;

    if task_count = 0 then
        raise exception 'Task regeneration produced no entries for plant %', p_plant_id;
    end if;

    return;
end;
$$;
