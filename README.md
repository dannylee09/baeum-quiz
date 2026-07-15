# 배움나눔 퀴즈

학교 배움나눔활동용 국어·영어·수학 퀴즈 플랫폼입니다. 현재 학생용 화면과 관리자 화면은 mock data 기반으로 동작합니다.

## 개발 서버

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 테스트

```bash
npm test
```

## Supabase 설정

1. `.env.local.example`을 참고해 실제 연결용 `.env.local`을 따로 만듭니다.
2. 필요한 환경변수는 다음과 같습니다.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 또는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SECRET_KEY` 또는 `SUPABASE_SERVICE_ROLE_KEY`
3. secret/service role key는 서버와 스크립트 전용입니다. 브라우저 컴포넌트나 API 응답에 노출하지 않습니다.
4. 초기 DB 스키마는 `supabase/migrations/001_initial_schema.sql`에 정리되어 있습니다.

Supabase client 파일은 용도별로 분리되어 있습니다.

- `lib/supabase/client.ts`: 브라우저용 publishable/anon client
- `lib/supabase/server.ts`: 서버/API route용 publishable/anon client
- `lib/supabase/admin.ts`: secret/service role 기반 관리자 client, 서버 전용

## Supabase 연결 확인

개발 서버를 실행한 뒤 아래 주소를 엽니다.

```txt
http://localhost:3000/api/health/supabase
```

이 API는 연결 성공 여부와 `quiz_sets` 테이블 조회 가능 여부만 반환합니다. 환경변수 값이나 key 값은 응답에 포함하지 않습니다.

## 개발용 퀴즈 seed

`lib/mock-data.ts`의 국어·영어·수학 mock 퀴즈를 Supabase `quiz_sets`, `questions` 테이블에 넣습니다. 같은 과목과 같은 제목의 퀴즈가 있으면 중복 삽입하지 않고, 문항도 이미 있는 번호는 건너뜁니다.

```bash
npm run seed:dev-quizzes
```

## 문제 파일 Storage 설정

관리자 퀴즈 등록/수정 화면에서 PDF, PNG, JPG/JPEG, WEBP 문제 파일을 업로드하려면 Supabase Storage에 bucket을 먼저 만들어야 합니다.

1. Supabase Dashboard에서 Storage로 이동합니다.
2. `quiz-files` 이름의 bucket을 만듭니다.
3. 학생 화면에서 파일을 바로 미리보기하려면 public bucket으로 설정합니다.
4. 파일 크기는 애플리케이션에서 10MB 이하로 제한합니다.
5. 기존 DB가 이미 만들어져 있다면 `supabase/migrations/002_question_file_fields.sql`을 적용해 `question_file_path`, `question_file_mime_type`, `question_file_original_name` 컬럼을 추가합니다.

기존 `pdf_storage_path` 값은 호환을 위해 유지하며, 새 문제 파일 경로는 `question_file_path`를 우선 사용합니다.

로컬 스크립트로 위 설정을 처리하려면 `.env.local`에 Supabase 연결 값과 서버 전용 key를 넣고 실행합니다. SQL migration 적용까지 자동으로 하려면 Supabase Management API용 `SUPABASE_ACCESS_TOKEN`도 필요합니다. 이 값들은 로그에 출력하지 않습니다.

```bash
npm run setup:supabase-files
```

## 관리자 비밀번호 설정

배포 전 `.env.local` 또는 배포 환경변수에 `ADMIN_PASSWORD`를 설정합니다.

```txt
ADMIN_PASSWORD=your-admin-password
```

`/admin` 하위 페이지는 이 비밀번호로 로그인해야 사용할 수 있습니다. `ADMIN_PASSWORD`가 없으면 관리자 페이지는 차단되고 설정 안내만 표시됩니다. 비밀번호 값은 클라이언트 코드와 API 응답에 포함하지 않습니다.

스크립트가 처리하는 작업:

- `supabase/migrations/002_question_file_fields.sql`이 이미 적용됐는지 확인하고, 필요할 때만 적용합니다.
- `quiz-files` Storage bucket이 없으면 public bucket으로 생성합니다.
- bucket이 이미 있으면 public, MIME 타입, 10MB 제한 설정을 확인/갱신합니다.

학생 제출 데이터는 아직 seed하지 않습니다. 학생 제출 화면과 관리자 화면도 아직 Supabase 데이터로 전환하지 않았습니다.
