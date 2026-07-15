export type SubjectCode = "korean" | "english" | "math";

export type AnswerType = "choice" | "short";

export type ChoiceAnswer = "1" | "2" | "3" | "4" | "5";

export type QuizSet = {
  id: string;
  subjectCode: SubjectCode;
  title: string;
  sourceUrl: string | null;
  hwpFileName: string | null;
  pdfStoragePath: string | null;
  questionFilePath?: string | null;
  questionFileMimeType?: string | null;
  questionFileOriginalName?: string | null;
  questionFileUrl?: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Question = {
  id: string;
  quizSetId: string;
  questionNo: number;
  answerType: AnswerType;
  correctAnswer: string;
  points: number;
};

export type SubmissionInput = {
  quizSetId: string;
  studentNo: string;
  studentName: string;
  answers: SubmissionAnswerInput[];
};

export type SubmissionAnswerInput = {
  questionId: string;
  rawAnswer: string;
};

export type GradedAnswer = {
  questionId: string;
  rawAnswer: string;
  normalizedAnswer: string | null;
  isCorrect: boolean;
  score: number;
  errorMessage: string | null;
};

export type GradedSubmission = {
  quizSetId: string;
  studentNo: string;
  studentName: string;
  totalScore: number;
  answers: GradedAnswer[];
};
