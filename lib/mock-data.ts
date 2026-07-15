import type {
  GradedAnswer,
  GradedSubmission,
  Question,
  QuizSet,
  SubjectCode,
  SubmissionInput,
} from "@/lib/types";
import { gradeSubmission, normalizeChoiceAnswer } from "@/lib/quiz/grading";
import { normalizeMathAnswer } from "@/lib/quiz/math-answer";

export type MockQuiz = QuizSet & {
  subjectName: string;
  description: string;
  questions: Question[];
};

export type MockSubmissionAnswer = GradedAnswer & {
  questionNo: number;
  correctAnswer: string;
  normalizedCorrectAnswer: string | null;
  finalIsCorrect: boolean;
  finalScore: number;
  reviewStatus: "auto" | "confirmed_correct" | "confirmed_wrong";
};

export type MockSubmission = Omit<GradedSubmission, "answers"> & {
  id: string;
  quizTitle: string;
  subjectCode: SubjectCode;
  subjectName: string;
  maxScore: number;
  finalScore: number;
  submittedAt: string;
  answers: MockSubmissionAnswer[];
};

const now = "2026-07-10T00:00:00.000Z";

export const mockQuizzes: MockQuiz[] = [
  {
    id: "korean-1",
    subjectCode: "korean",
    subjectName: "국어",
    title: "문학 작품의 표현 방식",
    description: "시와 소설 지문을 읽고 표현상의 특징을 확인하는 객관식 퀴즈입니다.",
    sourceUrl: null,
    hwpFileName: "korean-sample.hwp",
    pdfStoragePath: null,
    published: true,
    createdAt: now,
    updatedAt: now,
    questions: [
      {
        id: "korean-1-q1",
        quizSetId: "korean-1",
        questionNo: 1,
        answerType: "choice",
        correctAnswer: "3",
        points: 1,
      },
      {
        id: "korean-1-q2",
        quizSetId: "korean-1",
        questionNo: 2,
        answerType: "choice",
        correctAnswer: "5",
        points: 1,
      },
    ],
  },
  {
    id: "english-1",
    subjectCode: "english",
    subjectName: "영어",
    title: "중심 내용과 빈칸 추론",
    description: "짧은 영어 지문을 읽고 중심 내용과 문맥상 알맞은 표현을 고르는 퀴즈입니다.",
    sourceUrl: null,
    hwpFileName: "english-sample.hwp",
    pdfStoragePath: null,
    published: true,
    createdAt: now,
    updatedAt: now,
    questions: [
      {
        id: "english-1-q1",
        quizSetId: "english-1",
        questionNo: 1,
        answerType: "choice",
        correctAnswer: "2",
        points: 1,
      },
      {
        id: "english-1-q2",
        quizSetId: "english-1",
        questionNo: 2,
        answerType: "choice",
        correctAnswer: "4",
        points: 1,
      },
    ],
  },
  {
    id: "math-1",
    subjectCode: "math",
    subjectName: "수학",
    title: "이차방정식과 유리식",
    description: "정수 또는 분수 형태로 답을 입력하는 수학 단답형 퀴즈입니다.",
    sourceUrl: null,
    hwpFileName: "math-sample.hwp",
    pdfStoragePath: null,
    published: true,
    createdAt: now,
    updatedAt: now,
    questions: [
      {
        id: "math-1-q1",
        quizSetId: "math-1",
        questionNo: 1,
        answerType: "short",
        correctAnswer: "3",
        points: 2,
      },
      {
        id: "math-1-q2",
        quizSetId: "math-1",
        questionNo: 2,
        answerType: "short",
        correctAnswer: "1/2",
        points: 2,
      },
    ],
  },
];

const submissionInputs: Array<
  SubmissionInput & {
    id: string;
    submittedAt: string;
    overrides?: Record<string, boolean>;
  }
> = [
  {
    id: "sub-korean-1",
    quizSetId: "korean-1",
    studentNo: "20501",
    studentName: "김민서",
    submittedAt: "2026-07-10T09:10:00.000Z",
    answers: [
      { questionId: "korean-1-q1", rawAnswer: "3" },
      { questionId: "korean-1-q2", rawAnswer: "5" },
    ],
  },
  {
    id: "sub-korean-2",
    quizSetId: "korean-1",
    studentNo: "20508",
    studentName: "박지훈",
    submittedAt: "2026-07-10T09:18:00.000Z",
    answers: [
      { questionId: "korean-1-q1", rawAnswer: "2" },
      { questionId: "korean-1-q2", rawAnswer: "5" },
    ],
  },
  {
    id: "sub-english-1",
    quizSetId: "english-1",
    studentNo: "20603",
    studentName: "이서연",
    submittedAt: "2026-07-10T10:02:00.000Z",
    answers: [
      { questionId: "english-1-q1", rawAnswer: "2" },
      { questionId: "english-1-q2", rawAnswer: "4" },
    ],
  },
  {
    id: "sub-english-2",
    quizSetId: "english-1",
    studentNo: "20611",
    studentName: "최도윤",
    submittedAt: "2026-07-10T10:14:00.000Z",
    answers: [
      { questionId: "english-1-q1", rawAnswer: "1" },
      { questionId: "english-1-q2", rawAnswer: "4" },
    ],
  },
  {
    id: "sub-math-1",
    quizSetId: "math-1",
    studentNo: "20702",
    studentName: "정하린",
    submittedAt: "2026-07-10T11:05:00.000Z",
    answers: [
      { questionId: "math-1-q1", rawAnswer: "x=3" },
      { questionId: "math-1-q2", rawAnswer: "2/4" },
    ],
  },
  {
    id: "sub-math-2",
    quizSetId: "math-1",
    studentNo: "20709",
    studentName: "한지우",
    submittedAt: "2026-07-10T11:21:00.000Z",
    answers: [
      { questionId: "math-1-q1", rawAnswer: "3" },
      { questionId: "math-1-q2", rawAnswer: "0.5" },
    ],
  },
  {
    id: "sub-math-3",
    quizSetId: "math-1",
    studentNo: "20715",
    studentName: "오준호",
    submittedAt: "2026-07-10T11:36:00.000Z",
    overrides: {
      "math-1-q2": true,
    },
    answers: [
      { questionId: "math-1-q1", rawAnswer: "4" },
      { questionId: "math-1-q2", rawAnswer: "정답: 1/2" },
    ],
  },
];

export const mockSubmissions: MockSubmission[] = submissionInputs.map((input) => {
  const quiz = getMockQuiz(input.quizSetId);

  if (!quiz) {
    throw new Error(`Mock quiz not found: ${input.quizSetId}`);
  }

  const graded = gradeSubmission(quiz.questions, input);
  const answers = graded.answers.map((answer): MockSubmissionAnswer => {
    const question = quiz.questions.find((item) => item.id === answer.questionId);
    const correctAnswer = question?.correctAnswer ?? "";
    const override = input.overrides?.[answer.questionId];
    const finalIsCorrect = override ?? answer.isCorrect;
    const finalScore = finalIsCorrect ? question?.points ?? answer.score : 0;

    return {
      ...answer,
      questionNo: question?.questionNo ?? 0,
      correctAnswer,
      normalizedCorrectAnswer: question
        ? normalizeCorrectAnswer(question.answerType, correctAnswer)
        : null,
      finalIsCorrect,
      finalScore,
      reviewStatus:
        override === true
          ? "confirmed_correct"
          : override === false
            ? "confirmed_wrong"
            : "auto",
    };
  });

  return {
    ...graded,
    id: input.id,
    quizTitle: quiz.title,
    subjectCode: quiz.subjectCode,
    subjectName: quiz.subjectName,
    maxScore: quiz.questions.reduce((total, question) => total + question.points, 0),
    finalScore: answers.reduce((total, answer) => total + answer.finalScore, 0),
    submittedAt: input.submittedAt,
    answers,
  };
});

export function getMockQuiz(quizId: string): MockQuiz | undefined {
  return mockQuizzes.find((quiz) => quiz.id === quizId);
}

export function getSubjectTone(subjectCode: SubjectCode): string {
  if (subjectCode === "korean") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (subjectCode === "english") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function maskStudentNo(studentNo: string): string {
  if (studentNo.length <= 2) {
    return studentNo;
  }

  return `${studentNo.slice(0, 2)}***`;
}

export function maskStudentName(studentName: string): string {
  if (studentName.length <= 1) {
    return "*";
  }

  return `${studentName[0]}${"*".repeat(studentName.length - 1)}`;
}

function normalizeCorrectAnswer(answerType: "choice" | "short", correctAnswer: string) {
  const normalized =
    answerType === "choice"
      ? normalizeChoiceAnswer(correctAnswer)
      : normalizeMathAnswer(correctAnswer);

  return normalized.ok ? normalized.value : null;
}
