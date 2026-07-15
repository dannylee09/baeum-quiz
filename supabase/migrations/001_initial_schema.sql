create extension if not exists "pgcrypto";

create type subject_code as enum ('korean', 'english', 'math');
create type answer_type as enum ('choice', 'short');
create type review_status as enum ('auto', 'confirmed_correct', 'confirmed_wrong');

create table quiz_sets (
  id uuid primary key default gen_random_uuid(),
  subject_code subject_code not null,
  title text not null,
  description text,
  source_url text,
  hwp_file_name text,
  pdf_storage_path text,
  question_file_path text,
  question_file_mime_type text,
  question_file_original_name text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  quiz_set_id uuid not null references quiz_sets(id) on delete cascade,
  question_no integer not null check (question_no > 0),
  answer_type answer_type not null,
  correct_answer text not null,
  points integer not null default 1 check (points > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_set_id, question_no)
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  quiz_set_id uuid not null references quiz_sets(id) on delete cascade,
  student_no text not null,
  student_name text not null,
  total_score integer not null default 0 check (total_score >= 0),
  final_score integer not null default 0 check (final_score >= 0),
  graded_at timestamptz,
  created_at timestamptz not null default now()
);

create table submission_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  raw_answer text not null,
  normalized_answer text,
  is_correct boolean not null default false,
  score integer not null default 0 check (score >= 0),
  final_is_correct boolean not null default false,
  final_score integer not null default 0 check (final_score >= 0),
  error_message text,
  review_status review_status not null default 'auto',
  manually_overridden boolean not null default false,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id)
);

create index quiz_sets_subject_code_idx on quiz_sets(subject_code);
create index quiz_sets_published_idx on quiz_sets(published);
create index questions_quiz_set_id_idx on questions(quiz_set_id);
create index submissions_quiz_set_id_idx on submissions(quiz_set_id);
create index submissions_student_no_idx on submissions(student_no);
create index submission_answers_submission_id_idx on submission_answers(submission_id);
create index submission_answers_question_id_idx on submission_answers(question_id);
create index submission_answers_review_status_idx on submission_answers(review_status);

alter table quiz_sets enable row level security;
alter table questions enable row level security;
alter table submissions enable row level security;
alter table submission_answers enable row level security;

create policy "Published quiz sets are readable"
  on quiz_sets for select
  using (published = true);

create policy "Questions for published quiz sets are readable"
  on questions for select
  using (
    exists (
      select 1
      from quiz_sets
      where quiz_sets.id = questions.quiz_set_id
        and quiz_sets.published = true
    )
  );

-- Submissions and answer rows should be written through trusted server/API routes.
-- Admin operations should use the service role key from server-only code.
