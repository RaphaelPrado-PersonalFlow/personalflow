alter table public.training_protocols
  add column display_order integer;

with ranked as (
  select id,
    row_number() over (
      partition by professional_id, student_id
      order by created_at, id
    )::integer as position
  from public.training_protocols
)
update public.training_protocols as protocol
set display_order = ranked.position
from ranked
where ranked.id = protocol.id;

alter table public.training_protocols
  alter column display_order set not null,
  add constraint training_protocols_display_order_positive check (display_order > 0);

create index training_protocols_owner_student_order_idx
  on public.training_protocols(professional_id, student_id, display_order);

create or replace function public.set_training_protocol_display_order()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.display_order is null then
    perform pg_advisory_xact_lock(hashtextextended(new.professional_id::text || ':' || new.student_id::text, 0));

    select coalesce(max(tp.display_order), 0) + 1
      into new.display_order
    from public.training_protocols as tp
    where tp.professional_id = new.professional_id
      and tp.student_id = new.student_id;
  end if;

  return new;
end;
$$;

create trigger training_protocols_set_display_order
before insert on public.training_protocols
for each row execute function public.set_training_protocol_display_order();

create or replace function public.reorder_training_protocols(ordered_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  target_student_id uuid;
  ordered_count integer := coalesce(cardinality(ordered_ids), 0);
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;

  if ordered_count = 0 or ordered_count <> (
    select count(distinct protocol_id)
    from unnest(ordered_ids) as protocol_id
  ) then
    raise exception 'Protocol order must contain unique IDs';
  end if;

  select tp.student_id
    into target_student_id
  from public.training_protocols as tp
  where tp.id = ordered_ids[1]
    and tp.professional_id = owner_id;

  if target_student_id is null or ordered_count <> (
    select count(*)
    from public.training_protocols as tp
    where tp.professional_id = owner_id
      and tp.student_id = target_student_id
  ) or ordered_count <> (
    select count(*)
    from public.training_protocols as tp
    where tp.professional_id = owner_id
      and tp.student_id = target_student_id
      and tp.id = any(ordered_ids)
  ) then
    raise exception 'Protocol order must contain every protocol for one owned student';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(owner_id::text || ':' || target_student_id::text, 0));

  update public.training_protocols as tp
  set display_order = ordered.position::integer,
      updated_at = now()
  from unnest(ordered_ids) with ordinality as ordered(id, position)
  where tp.id = ordered.id
    and tp.professional_id = owner_id
    and tp.student_id = target_student_id;
end;
$$;

revoke all on function public.set_training_protocol_display_order() from public;
revoke all on function public.reorder_training_protocols(uuid[]) from public;
grant execute on function public.reorder_training_protocols(uuid[]) to authenticated;
