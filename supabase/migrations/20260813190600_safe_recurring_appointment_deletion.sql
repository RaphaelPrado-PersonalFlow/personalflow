alter table public.appointments
  add column if not exists deleted_at timestamptz;

create index if not exists appointments_recurrence_group_starts_at_idx
  on public.appointments (professional_id, recurrence_group_id, starts_at)
  where recurrence_group_id is not null and deleted_at is null;

create or replace function public.delete_appointment_occurrences(
  p_appointment_id uuid,
  p_scope text default 'single'
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  target public.appointments%rowtype;
  affected integer;
begin
  if p_scope not in ('single', 'future', 'series') then
    raise exception 'Invalid appointment deletion scope' using errcode = '22023';
  end if;

  select * into target
  from public.appointments
  where id = p_appointment_id
    and professional_id = auth.uid()
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Appointment not found' using errcode = 'P0002';
  end if;

  if p_scope <> 'single' and target.recurrence_group_id is null then
    raise exception 'Appointment is not recurring' using errcode = '22023';
  end if;

  update public.appointments
  set deleted_at = now(), updated_at = now()
  where professional_id = auth.uid()
    and deleted_at is null
    and (
      (p_scope = 'single' and id = target.id)
      or (p_scope = 'series' and recurrence_group_id = target.recurrence_group_id)
      or (
        p_scope = 'future'
        and recurrence_group_id = target.recurrence_group_id
        and starts_at >= target.starts_at
      )
    );

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.delete_appointment_occurrences(uuid, text) from public;
grant execute on function public.delete_appointment_occurrences(uuid, text) to authenticated;
