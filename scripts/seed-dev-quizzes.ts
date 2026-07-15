import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { mockQuizzes } from "@/lib/mock-data";

config({ path: path.resolve(process.cwd(), ".env.local") });

type QuizSetRow = {
  id: string;
};

type ExistingQuestionRow = {
  question_no: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error(
    "Missing Supabase seed environment variables. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  let insertedQuizCount = 0;
  let skippedQuizCount = 0;
  let insertedQuestionCount = 0;
  let skippedQuestionCount = 0;

  for (const quiz of mockQuizzes) {
    const existingQuiz = await findExistingQuiz(quiz.subjectCode, quiz.title);
    const quizSetId =
      existingQuiz?.id ??
      (await insertQuiz({
        subjectCode: quiz.subjectCode,
        title: quiz.title,
        description: quiz.description,
        published: quiz.published,
        sourceUrl: quiz.sourceUrl,
        hwpFileName: quiz.hwpFileName,
        pdfStoragePath: quiz.pdfStoragePath,
      }));

    if (existingQuiz) {
      skippedQuizCount += 1;
    } else {
      insertedQuizCount += 1;
    }

    const existingQuestionNumbers = await getExistingQuestionNumbers(quizSetId);

    for (const question of quiz.questions) {
      if (existingQuestionNumbers.has(question.questionNo)) {
        skippedQuestionCount += 1;
        continue;
      }

      await insertQuestion({
        quizSetId,
        questionNo: question.questionNo,
        answerType: question.answerType,
        correctAnswer: question.correctAnswer,
        points: question.points,
      });
      insertedQuestionCount += 1;
    }
  }

  console.log(
    [
      "Development quiz seed completed.",
      `Inserted quizzes: ${insertedQuizCount}`,
      `Skipped quizzes: ${skippedQuizCount}`,
      `Inserted questions: ${insertedQuestionCount}`,
      `Skipped questions: ${skippedQuestionCount}`,
    ].join("\n"),
  );
}

async function findExistingQuiz(subjectCode: string, title: string) {
  const { data, error } = await supabase
    .from("quiz_sets")
    .select("id")
    .eq("subject_code", subjectCode)
    .eq("title", title)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check existing quiz: ${error.message}`);
  }

  return (data?.[0] as QuizSetRow | undefined) ?? null;
}

async function insertQuiz(input: {
  subjectCode: string;
  title: string;
  description: string;
  published: boolean;
  sourceUrl: string | null;
  hwpFileName: string | null;
  pdfStoragePath: string | null;
}) {
  const { data, error } = await supabase
    .from("quiz_sets")
    .insert({
      subject_code: input.subjectCode,
      title: input.title,
      description: input.description,
      published: input.published,
      source_url: input.sourceUrl,
      hwp_file_name: input.hwpFileName,
      pdf_storage_path: input.pdfStoragePath,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to insert quiz: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("Failed to insert quiz: missing returned id.");
  }

  return String(data.id);
}

async function getExistingQuestionNumbers(quizSetId: string) {
  const { data, error } = await supabase
    .from("questions")
    .select("question_no")
    .eq("quiz_set_id", quizSetId);

  if (error) {
    throw new Error(`Failed to check existing questions: ${error.message}`);
  }

  return new Set(
    ((data ?? []) as ExistingQuestionRow[]).map((row) => row.question_no),
  );
}

async function insertQuestion(input: {
  quizSetId: string;
  questionNo: number;
  answerType: string;
  correctAnswer: string;
  points: number;
}) {
  const { error } = await supabase.from("questions").insert({
    quiz_set_id: input.quizSetId,
    question_no: input.questionNo,
    answer_type: input.answerType,
    correct_answer: input.correctAnswer,
    points: input.points,
  });

  if (error) {
    throw new Error(`Failed to insert question: ${error.message}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown seed error.");
  process.exit(1);
});
