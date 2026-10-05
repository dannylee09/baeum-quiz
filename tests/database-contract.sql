-- Run as a single transaction. Fixtures are never committed or visible to users.
begin;
set local role service_role;
do $$
declare
  qid uuid; question_id uuid; expected jsonb; answers jsonb;
  first_result jsonb; second_result jsonb; decision jsonb;
  request_id uuid := gen_random_uuid(); bad_id uuid := gen_random_uuid();
  before_count integer; key text := 'regression-' || gen_random_uuid()::text;
begin
  select count(*) into before_count from public.quiz_sets;
  begin
    perform public.save_quiz_definition(null,'{"subject_code":"math","title":"transaction rollback fixture"}', '[{"answer_type":"short","correct_answer":"1","points":1},{"answer_type":"short","correct_answer":"2","points":-1}]');
    raise exception 'TEST_EXPECTED_CREATE_FAILURE';
  exception when check_violation then null; end;
  if (select count(*) from public.quiz_sets) <> before_count then raise exception 'TEST_PARTIAL_QUIZ'; end if;
  qid := public.save_quiz_definition(null,'{"subject_code":"math","title":"transaction-only fixture","published":true}', '[{"answer_type":"short","correct_answer":"1","points":1}]');
  select id into question_id from public.questions where quiz_set_id=qid;
  select jsonb_agg(jsonb_build_object('id',id,'question_no',question_no,'answer_type',answer_type,'correct_answer',correct_answer,'points',points) order by question_no) into expected from public.questions where quiz_set_id=qid;
  answers := jsonb_build_array(jsonb_build_object('question_id',question_id,'raw_answer','1','normalized_answer','1','is_correct',true,'score',1,'error_message',null));
  first_result := public.save_quiz_submission(request_id,repeat('A',43),qid,'29999','자동검증',expected,1,answers);
  second_result := public.save_quiz_submission(request_id,repeat('A',43),qid,'29999','자동검증',expected,1,answers);
  if first_result <> second_result then raise exception 'TEST_REPLAY_RESULT'; end if;
  if (select count(*) from public.submissions s where s.id=(first_result->>'id')::uuid) <> 1 or (select count(*) from public.submission_answers a where a.submission_id=(first_result->>'id')::uuid) <> 1 then raise exception 'TEST_SAVE'; end if;
  begin
    perform public.save_quiz_submission(request_id,repeat('B',43),qid,'29999','자동검증',expected,1,answers);
    raise exception 'TEST_EXPECTED_CONFLICT';
  exception when raise_exception then if sqlerrm <> 'REQUEST_CONFLICT' then raise; end if; end;
  begin
    perform public.save_quiz_submission(bad_id,repeat('C',43),qid,'29999','자동검증','[]',1,answers);
    raise exception 'TEST_EXPECTED_VERSION_FAILURE';
  exception when raise_exception then if sqlerrm <> 'QUIZ_CHANGED' then raise; end if; end;
  -- A not-null failure in answer insertion must also roll back the parent row.
  answers := jsonb_build_array(jsonb_build_object('question_id',question_id,'raw_answer','0','is_correct',null,'score',0));
  begin
    perform public.save_quiz_submission(bad_id,repeat('C',43),qid,'29999','자동검증',expected,0,answers);
    raise exception 'TEST_EXPECTED_ANSWER_FAILURE';
  exception when not_null_violation then null; end;
  if exists(select 1 from public.submissions s where s.request_id=bad_id) then raise exception 'TEST_PARTIAL_SUBMISSION'; end if;
  begin
    perform public.save_quiz_definition(qid,'{"title":"must roll back"}',jsonb_build_array(jsonb_build_object('id',question_id,'correct_answer','2','points',1)));
    raise exception 'TEST_EXPECTED_GRADED_LOCK';
  exception when raise_exception then if sqlerrm <> 'GRADED_QUIZ' then raise; end if; end;
  if (select title from public.quiz_sets where id=qid) <> 'transaction-only fixture' then raise exception 'TEST_PARTIAL_EDIT'; end if;
  perform public.save_quiz_definition(qid,'{"description":"metadata update allowed"}',null);
  begin
    perform public.delete_empty_quiz(qid);
    raise exception 'TEST_EXPECTED_DELETE_LOCK';
  exception when raise_exception then if sqlerrm <> 'GRADED_QUIZ' then raise; end if; end;
  decision := public.rate_limit_check(key,2,60);
  if not (decision->>'allowed')::boolean then raise exception 'TEST_RATE_1'; end if;
  decision := public.rate_limit_check(key,2,60);
  if not (decision->>'allowed')::boolean then raise exception 'TEST_RATE_2'; end if;
  decision := public.rate_limit_check(key,2,60);
  if (decision->>'allowed')::boolean or (decision->>'retry_after_seconds')::integer < 1 then raise exception 'TEST_RATE_3'; end if;
  if has_function_privilege('anon','public.save_quiz_submission(uuid,text,uuid,text,text,jsonb,numeric,jsonb)','execute') then raise exception 'TEST_PUBLIC_RPC'; end if;
end $$;
rollback;
select 'database contract tests passed; all fixture changes rolled back' as result;
