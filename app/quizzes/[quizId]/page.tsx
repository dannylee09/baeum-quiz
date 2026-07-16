import Link from "next/link";
import { notFound } from "next/navigation";
import QuizSubmissionForm, {
  type StudentQuiz,
} from "@/app/quizzes/[quizId]/QuizSubmissionForm";
import ProblemFileViewer from "@/app/quizzes/[quizId]/ProblemFileViewer";
import { getSubjectTone, type MockQuiz } from "@/lib/mock-data";
import { getPublishedQuizWithQuestions } from "@/lib/supabase/quiz-queries";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    quizId: string;
  }>;
};

export default async function QuizDetailPage({ params }: Props) {
  const { quizId } = await params;
  const { quiz, source, errorMessage, unavailableReason } =
    await getPublishedQuizWithQuestions(quizId);

  if (unavailableReason === "unpublished") {
    return <UnavailableQuizPage message="아직 공개되지 않은 퀴즈입니다." />;
  }

  if (!quiz) {
    notFound();
  }

  const problemFilePath = quiz.questionFilePath ?? quiz.pdfStoragePath;
  const problemFileUrl = quiz.questionFileUrl ?? problemFilePath;
  const problemFileName =
    quiz.questionFileOriginalName ?? problemFilePath ?? quiz.hwpFileName ?? null;

  return (
    <main className="min-h-screen bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-950">
          ← 퀴즈 목록으로
        </Link>

        {source === "mock" && errorMessage ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-4 grid gap-5 sm:mt-5 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,430px)] xl:items-start">
          <section className="-mx-3 w-[calc(100%+1.5rem)] max-w-none overflow-hidden border-y border-zinc-200 bg-white shadow-sm sm:mx-0 sm:w-auto sm:rounded-lg sm:border">
            <div className="px-4 py-5 sm:p-6">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${getSubjectTone(
                  quiz.subjectCode,
                )}`}
              >
                {quiz.subjectName}
              </span>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
                {quiz.title}
              </h1>
              <p className="mt-3 text-base leading-7 text-zinc-600">
                {quiz.description}
              </p>
            </div>

            <div className="sm:px-6 sm:pb-6">
              <ProblemFileViewer
                fileName={problemFileName}
                filePath={problemFilePath}
                fileUrl={problemFileUrl}
                mimeType={quiz.questionFileMimeType ?? null}
              />
            </div>
          </section>

          <QuizSubmissionForm quiz={toStudentQuiz(quiz)} />
        </div>
      </div>
    </main>
  );
}

function toStudentQuiz(quiz: MockQuiz): StudentQuiz {
  return {
    ...quiz,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      quizSetId: question.quizSetId,
      questionNo: question.questionNo,
      answerType: question.answerType,
      points: question.points,
    })),
  };
}

function UnavailableQuizPage({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-xl rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-zinc-950">{message}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          관리자가 공개한 뒤 다시 확인해 주세요.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex text-sm font-semibold text-zinc-900 underline underline-offset-4"
        >
          공개된 퀴즈 목록으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
