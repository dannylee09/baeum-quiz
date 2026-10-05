-- Deploy the public query that omits correct_answer BEFORE applying this step.
-- RLS still restricts visible rows to published quizzes.
revoke all on public.questions from public, anon, authenticated;
grant select (id, quiz_set_id, question_no, answer_type, points, created_at, updated_at)
  on public.questions to anon, authenticated;
revoke all on public.quiz_sets from public, anon, authenticated;
grant select on public.quiz_sets to anon, authenticated;
revoke all on public.submissions, public.submission_answers from public, anon, authenticated;
