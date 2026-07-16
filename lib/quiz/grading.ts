import type {
  GradedAnswer,
  GradedSubmission,
  Question,
  SubmissionInput,
} from "@/lib/types";
import { normalizeMathAnswer } from "@/lib/quiz/math-answer";

const CHOICE_PATTERN = /^[1-5]$/;

export function normalizeChoiceAnswer(input: string) {
  const value = input.trim();

  if (!CHOICE_PATTERN.test(value)) {
    return {
      ok: false as const,
      error: "객관식 답안은 1번부터 5번까지만 입력할 수 있습니다.",
    };
  }

  return {
    ok: true as const,
    value,
  };
}

export function gradeAnswer(question: Question, rawAnswer: string): GradedAnswer {
  if (question.answerType === "choice") {
    return gradeChoiceAnswer(question, rawAnswer);
  }

  return gradeShortAnswer(question, rawAnswer);
}

export function gradeSubmission(
  questions: Question[],
  submission: SubmissionInput,
): GradedSubmission {
  const questionById = new Map(questions.map((question) => [question.id, question]));

  const answers = submission.answers.map((answer): GradedAnswer => {
    const question = questionById.get(answer.questionId);

    if (!question) {
      return {
        questionId: answer.questionId,
        rawAnswer: answer.rawAnswer,
        normalizedAnswer: null,
        isCorrect: false,
        score: 0,
        errorMessage: "해당 문항을 찾을 수 없습니다.",
      };
    }

    return gradeAnswer(question, answer.rawAnswer);
  });

  return {
    quizSetId: submission.quizSetId,
    studentNo: submission.studentNo,
    studentName: submission.studentName,
    totalScore: answers.reduce((total, answer) => total + answer.score, 0),
    answers,
  };
}

export function shouldRequestRetry(
  totalScore: number,
  maxScore: number,
  isFinalAttempt: boolean,
) {
  return !isFinalAttempt && totalScore < maxScore;
}

function gradeChoiceAnswer(question: Question, rawAnswer: string): GradedAnswer {
  const normalizedAnswer = normalizeChoiceAnswer(rawAnswer);
  const normalizedCorrectAnswer = normalizeChoiceAnswer(question.correctAnswer);

  if (!normalizedAnswer.ok) {
    return invalidAnswer(question.id, rawAnswer, normalizedAnswer.error);
  }

  if (!normalizedCorrectAnswer.ok) {
    return invalidAnswer(
      question.id,
      rawAnswer,
      "문항 정답 형식이 올바르지 않습니다.",
    );
  }

  const isCorrect = normalizedAnswer.value === normalizedCorrectAnswer.value;

  return {
    questionId: question.id,
    rawAnswer,
    normalizedAnswer: normalizedAnswer.value,
    isCorrect,
    score: isCorrect ? question.points : 0,
    errorMessage: null,
  };
}

function gradeShortAnswer(question: Question, rawAnswer: string): GradedAnswer {
  const normalizedAnswer = normalizeMathAnswer(rawAnswer);
  const normalizedCorrectAnswer = normalizeMathAnswer(question.correctAnswer);

  if (!normalizedAnswer.ok) {
    return invalidAnswer(question.id, rawAnswer, normalizedAnswer.error);
  }

  if (!normalizedCorrectAnswer.ok) {
    return invalidAnswer(
      question.id,
      rawAnswer,
      "문항 정답 형식이 올바르지 않습니다.",
    );
  }

  const isCorrect = normalizedAnswer.value === normalizedCorrectAnswer.value;

  return {
    questionId: question.id,
    rawAnswer,
    normalizedAnswer: normalizedAnswer.value,
    isCorrect,
    score: isCorrect ? question.points : 0,
    errorMessage: null,
  };
}

function invalidAnswer(
  questionId: string,
  rawAnswer: string,
  errorMessage: string,
): GradedAnswer {
  return {
    questionId,
    rawAnswer,
    normalizedAnswer: null,
    isCorrect: false,
    score: 0,
    errorMessage,
  };
}
