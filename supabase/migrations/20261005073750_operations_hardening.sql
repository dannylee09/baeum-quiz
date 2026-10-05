-- Additive rollout: install these contracts before deploying the matching app.
-- Public answer-column access is revoked separately after the app rollout.
alter table public.submissions add column if not exists request_id uuid;
alter table public.submissions add column if not exists request_fingerprint text;
alter table public.submissions add column if not exists max_score integer;
create unique index if not exists submissions_request_id_key on public.submissions(request_id);
update public.submissions s set max_score = q.total
from (select quiz_set_id, sum(points)::integer as total from public.questions group by quiz_set_id) q
where s.quiz_set_id = q.quiz_set_id and s.max_score is null;

create table public.request_rate_limits (
  key text primary key,
  window_started_at timestamptz not null,
  attempts integer not null check (attempts > 0)
);
create index request_rate_limits_window_idx on public.request_rate_limits(window_started_at);
alter table public.request_rate_limits enable row level security;
revoke all on public.request_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.request_rate_limits to service_role;

create table public.lottery_draws (
  id uuid primary key,
  created_at timestamptz not null default now(),
  candidate_count integer not null check (candidate_count > 0),
  requested_count integer not null check (requested_count > 0 and requested_count <= candidate_count),
  winners jsonb not null check (jsonb_typeof(winners) = 'array' and jsonb_array_length(winners) = requested_count),
  criteria_version text not null default 'latest-per-quiz-student-once-v1'
);
alter table public.lottery_draws enable row level security;
revoke all on public.lottery_draws from public, anon, authenticated;
grant select, insert on public.lottery_draws to service_role;

create or replace function public.rate_limit_check(p_key text, p_limit integer, p_window_seconds integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window timestamptz;
  v_attempts integer;
begin
  if p_key is null or p_limit is null or p_window_seconds is null or length(p_key) not between 1 and 200 or p_limit not between 1 and 10000 or p_window_seconds not between 1 and 86400 then
    raise exception 'INVALID_RATE_LIMIT';
  end if;
  v_window := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);
  delete from public.request_rate_limits where window_started_at < v_now - interval '1 day';
  insert into public.request_rate_limits as r(key,window_started_at,attempts)
  values(p_key,v_window,1)
  on conflict(key) do update set window_started_at = excluded.window_started_at,
    attempts = case when r.window_started_at = excluded.window_started_at then least(r.attempts + 1,p_limit + 1) else 1 end
  returning attempts into v_attempts;
  return jsonb_build_object('allowed',v_attempts <= p_limit,'retry_after_seconds',greatest(1,ceil(extract(epoch from (v_window + make_interval(secs => p_window_seconds) - v_now)))::integer));
end $$;
revoke all on function public.rate_limit_check(text,integer,integer) from public, anon, authenticated;
grant execute on function public.rate_limit_check(text,integer,integer) to service_role;

create or replace function public.save_quiz_submission(
  p_request_id uuid, p_request_fingerprint text, p_quiz_set_id uuid,
  p_student_no text, p_student_name text, p_expected_questions jsonb,
  p_total_score numeric, p_answers jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_existing public.submissions%rowtype;
  v_quiz public.quiz_sets%rowtype;
  v_questions jsonb;
  v_max integer;
  v_count integer;
  v_submission public.submissions%rowtype;
begin
  if p_request_id is null or p_request_fingerprint is null or p_request_fingerprint !~ '^[A-Za-z0-9_-]{43}$' or p_student_no is null or p_student_no !~ '^[1-3][0-9]{4}$' or p_student_name is null or length(btrim(p_student_name)) not between 1 and 40 then
    raise exception 'INVALID_SUBMISSION';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_existing from public.submissions where request_id = p_request_id;
  if found then
    if v_existing.request_fingerprint is distinct from p_request_fingerprint then raise exception 'REQUEST_CONFLICT'; end if;
    return jsonb_build_object('id',v_existing.id,'created_at',v_existing.created_at);
  end if;
  select * into v_quiz from public.quiz_sets where id = p_quiz_set_id for update;
  if not found or not v_quiz.published then raise exception 'QUIZ_CHANGED'; end if;
  perform 1 from public.questions where quiz_set_id = p_quiz_set_id order by question_no for share;
  select jsonb_agg(jsonb_build_object('id',id,'question_no',question_no,'answer_type',answer_type,'correct_answer',correct_answer,'points',points) order by question_no),sum(points),count(*)
    into v_questions,v_max,v_count from public.questions where quiz_set_id = p_quiz_set_id;
  if v_count = 0 or v_questions is distinct from p_expected_questions then raise exception 'QUIZ_CHANGED'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) <> v_count then raise exception 'INVALID_SUBMISSION'; end if;
  if (select count(distinct a->>'question_id') from jsonb_array_elements(p_answers) a) <> v_count then raise exception 'INVALID_SUBMISSION'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_answers) a left join public.questions q on q.id = (a->>'question_id')::uuid and q.quiz_set_id = p_quiz_set_id
    where q.id is null or length(a->>'raw_answer') not between 1 and 256
      or (a->>'score')::integer is distinct from case when (a->>'is_correct')::boolean then q.points else 0 end
  ) then raise exception 'INVALID_SUBMISSION'; end if;
  if p_total_score is null or p_total_score is distinct from (select sum((a->>'score')::integer) from jsonb_array_elements(p_answers) a) or p_total_score not between 0 and v_max then raise exception 'INVALID_SUBMISSION'; end if;
  insert into public.submissions(quiz_set_id,student_no,student_name,total_score,final_score,graded_at,max_score,request_id,request_fingerprint)
    values(p_quiz_set_id,p_student_no,btrim(p_student_name),p_total_score,p_total_score,clock_timestamp(),v_max,p_request_id,p_request_fingerprint)
    returning * into v_submission;
  insert into public.submission_answers(submission_id,question_id,raw_answer,normalized_answer,is_correct,score,final_is_correct,final_score,error_message,review_status)
    select v_submission.id,(a->>'question_id')::uuid,a->>'raw_answer',a->>'normalized_answer',(a->>'is_correct')::boolean,(a->>'score')::integer,
      (a->>'is_correct')::boolean,(a->>'score')::integer,a->>'error_message','auto'::public.review_status
    from jsonb_array_elements(p_answers) a;
  return jsonb_build_object('id',v_submission.id,'created_at',v_submission.created_at);
end $$;
revoke all on function public.save_quiz_submission(uuid,text,uuid,text,text,jsonb,numeric,jsonb) from public, anon, authenticated;
grant execute on function public.save_quiz_submission(uuid,text,uuid,text,text,jsonb,numeric,jsonb) to service_role;

create or replace function public.save_quiz_definition(p_quiz_id uuid, p_quiz jsonb, p_questions jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_quiz public.quiz_sets%rowtype; v_q jsonb;
begin
  if p_quiz_id is null then
    if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 1 and 50 then raise exception 'INVALID_QUESTIONS'; end if;
    insert into public.quiz_sets(subject_code,title,description,published,pdf_storage_path,question_file_path,question_file_mime_type,question_file_original_name)
      values((p_quiz->>'subject_code')::public.subject_code,p_quiz->>'title',p_quiz->>'description',coalesce((p_quiz->>'published')::boolean,false),p_quiz->>'question_file_path',p_quiz->>'question_file_path',p_quiz->>'question_file_mime_type',p_quiz->>'question_file_original_name') returning id into v_id;
    insert into public.questions(quiz_set_id,question_no,answer_type,correct_answer,points)
      select v_id,ordinality::integer,(value->>'answer_type')::public.answer_type,value->>'correct_answer',(value->>'points')::integer from jsonb_array_elements(p_questions) with ordinality;
    return v_id;
  end if;
  select * into v_quiz from public.quiz_sets where id = p_quiz_id for update;
  if not found then raise exception 'QUIZ_NOT_FOUND'; end if;
  if p_questions is not null then
    if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) > 50 then raise exception 'INVALID_QUESTIONS'; end if;
    if exists(select 1 from public.submissions where quiz_set_id = p_quiz_id) and exists(
      select 1 from jsonb_array_elements(p_questions) a join public.questions q on q.id = (a->>'id')::uuid
      where q.quiz_set_id = p_quiz_id and (q.correct_answer is distinct from a->>'correct_answer' or q.points is distinct from (a->>'points')::integer)
    ) then raise exception 'GRADED_QUIZ'; end if;
    for v_q in select value from jsonb_array_elements(p_questions) loop
      update public.questions set correct_answer = v_q->>'correct_answer',points = (v_q->>'points')::integer,updated_at = clock_timestamp()
        where id = (v_q->>'id')::uuid and quiz_set_id = p_quiz_id;
      if not found then raise exception 'INVALID_QUESTIONS'; end if;
    end loop;
  end if;
  update public.quiz_sets set
    title = case when p_quiz ? 'title' then p_quiz->>'title' else title end,
    description = case when p_quiz ? 'description' then p_quiz->>'description' else description end,
    published = case when p_quiz ? 'published' then (p_quiz->>'published')::boolean else published end,
    pdf_storage_path = case when p_quiz ? 'question_file_path' then p_quiz->>'question_file_path' else pdf_storage_path end,
    question_file_path = case when p_quiz ? 'question_file_path' then p_quiz->>'question_file_path' else question_file_path end,
    question_file_mime_type = case when p_quiz ? 'question_file_mime_type' then p_quiz->>'question_file_mime_type' else question_file_mime_type end,
    question_file_original_name = case when p_quiz ? 'question_file_original_name' then p_quiz->>'question_file_original_name' else question_file_original_name end,
    updated_at = clock_timestamp()
  where id = p_quiz_id;
  return p_quiz_id;
end $$;
revoke all on function public.save_quiz_definition(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_quiz_definition(uuid,jsonb,jsonb) to service_role;

create or replace function public.delete_empty_quiz(p_quiz_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.quiz_sets where id = p_quiz_id for update;
  if not found then return false; end if;
  if exists(select 1 from public.submissions where quiz_set_id = p_quiz_id) then raise exception 'GRADED_QUIZ'; end if;
  delete from public.quiz_sets where id = p_quiz_id;
  return true;
end $$;
revoke all on function public.delete_empty_quiz(uuid) from public, anon, authenticated;
grant execute on function public.delete_empty_quiz(uuid) to service_role;
