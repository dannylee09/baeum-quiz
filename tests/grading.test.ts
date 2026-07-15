import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Question } from "@/lib/types";
import {
  gradeAnswer,
  gradeSubmission,
  normalizeChoiceAnswer,
} from "@/lib/quiz/grading";

const questions: Question[] = [
  {
    id: "q1",
    quizSetId: "quiz-1",
    questionNo: 1,
    answerType: "choice",
    correctAnswer: "3",
    points: 2,
  },
  {
    id: "q2",
    quizSetId: "quiz-1",
    questionNo: 2,
    answerType: "short",
    correctAnswer: "1/2",
    points: 3,
  },
];

describe("normalizeChoiceAnswer", () => {
  it("1~5 객관식 답안만 허용한다", () => {
    assert.deepEqual(normalizeChoiceAnswer(" 5 "), { ok: true, value: "5" });
    assert.equal(normalizeChoiceAnswer("0").ok, false);
    assert.equal(normalizeChoiceAnswer("6").ok, false);
    assert.equal(normalizeChoiceAnswer("답: 3").ok, false);
  });
});

describe("gradeAnswer", () => {
  it("객관식 답안을 자동 채점한다", () => {
    assert.equal(gradeAnswer(questions[0], "3").score, 2);
    assert.equal(gradeAnswer(questions[0], "2").score, 0);
  });

  it("수학 단답형은 약분한 값으로 비교한다", () => {
    const result = gradeAnswer(questions[1], "2/4");

    assert.equal(result.isCorrect, true);
    assert.equal(result.normalizedAnswer, "1/2");
    assert.equal(result.score, 3);
  });

  it("잘못된 답안 형식이면 에러 메시지를 반환한다", () => {
    const result = gradeAnswer(questions[1], "0.5");

    assert.equal(result.isCorrect, false);
    assert.equal(result.score, 0);
    assert.equal(typeof result.errorMessage, "string");
  });
});

describe("gradeSubmission", () => {
  it("제출 답안을 문항별로 채점하고 총점을 계산한다", () => {
    const result = gradeSubmission(questions, {
      quizSetId: "quiz-1",
      studentNo: "20501",
      studentName: "김학생",
      answers: [
        { questionId: "q1", rawAnswer: "3" },
        { questionId: "q2", rawAnswer: "답: 3/6" },
      ],
    });

    assert.equal(result.totalScore, 5);
    assert.equal(result.studentNo, "20501");
    assert.equal(result.studentName, "김학생");
    assert.equal(result.answers.length, 2);
  });
});
