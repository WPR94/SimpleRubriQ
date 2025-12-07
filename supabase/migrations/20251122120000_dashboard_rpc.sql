-- RPC to return dashboard counts and recent feedback in one call
-- Drop existing version to avoid return type mismatch errors on replace
drop function if exists public.get_teacher_dashboard(uuid);
create or replace function public.get_teacher_dashboard(p_teacher_id uuid)
returns table (essays_count bigint, rubrics_count bigint, feedback_count bigint, recent json)
language sql
stable
as $$
with e as (
  select count(*)::bigint c from public.essays where teacher_id = p_teacher_id
), r as (
  select count(*)::bigint c from public.rubrics where teacher_id = p_teacher_id
), f as (
  select count(*)::bigint c
  from public.feedback fb
  join public.essays e on e.id = fb.essay_id
  where e.teacher_id = p_teacher_id
), recent as (
  select json_agg(sub order by sub.created_at desc) as items from (
    select fb.id, fb.created_at, e.title as essay_title
    from public.feedback fb
    join public.essays e on e.id = fb.essay_id
    where e.teacher_id = p_teacher_id
    order by fb.created_at desc
    limit 5
  ) sub
)
select e.c as essays_count,
       r.c as rubrics_count,
       f.c as feedback_count,
       coalesce(recent.items, '[]'::json) as recent
from e, r, f, recent;
$$;
