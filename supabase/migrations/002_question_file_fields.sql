alter table quiz_sets
  add column if not exists question_file_path text,
  add column if not exists question_file_mime_type text,
  add column if not exists question_file_original_name text;

update quiz_sets
set question_file_path = pdf_storage_path
where question_file_path is null
  and pdf_storage_path is not null;
