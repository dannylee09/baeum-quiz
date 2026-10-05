import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdminSubmission } from "@/lib/supabase/admin-queries";
import { buildSubmissionStats, filterSubmissions, formatAdminDateTime, getLotteryCandidates, latestSubmissions } from "@/lib/admin/submission-stats";
import { drawLotteryWinners, lotteryCriteriaVersion, runLotteryDraw, type LotteryDraw } from "@/lib/admin/lottery";
import { escapeCsvCell, submissionsCsv } from "@/lib/admin/csv";

function submission(overrides: Partial<AdminSubmission> = {}): AdminSubmission {
  const base: AdminSubmission = {
    id: "a", quizSetId: "quiz-1", quizTitle: "국어 1", subjectCode: "korean", subjectName: "국어",
    studentNo: "21001", studentName: "김학생", totalScore: 1, finalScore: 1, maxScore: 1,
    submittedAt: "2026-10-05T01:00:00.000000+00:00",
    answers: [{ id: "answer-1", questionId: "question-1", questionNo: 1, rawAnswer: "3", normalizedAnswer: "3", isCorrect: true, finalIsCorrect: true, score: 1, finalScore: 1, reviewStatus: "auto" }],
  };
  return { ...base, ...overrides };
}

describe("latest-attempt statistics and eligibility", () => {
  it("uses latest submissions regardless of input order while preserving raw attempt counts", () => {
    const old = submission({ id: "old", finalScore: 0, submittedAt: "2026-10-01T00:00:00Z", answers: [{ ...submission().answers[0], finalIsCorrect: false }] });
    const other = submission({ id: "other", studentNo: "21002", finalScore: 0, answers: [{ ...submission().answers[0], finalIsCorrect: false }] });
    const latest = submission({ id: "new" });
    const stats = buildSubmissionStats([other, old, latest]);
    assert.equal(stats.rawCount, 3);
    assert.equal(stats.participantCount, 2);
    assert.equal(stats.latest.length, 2);
    assert.equal(stats.quizzes[0].averageScore, 0.5);
    assert.equal(stats.quizzes[0].averagePercent, 50);
    assert.equal(stats.questions[0].correctRate, 50);
    assert.equal(stats.quizzes[0].rawCount, 3);
    assert.equal(stats.eligibleStudentCount, 1);
  });
  it("removes eligibility when a later submission is incorrect and merges multiple perfect quizzes per student", () => {
    const records = [
      submission({ id: "old-perfect", studentNo: "21002", submittedAt: "2026-10-01T00:00:00Z" }),
      submission({ id: "new-incorrect", studentNo: "21002", finalScore: 0 }),
      submission({ id: "q1" }),
      submission({ id: "q2", quizSetId: "quiz-2", subjectCode: "math", subjectName: "수학" }),
    ];
    const candidates = getLotteryCandidates(records);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].studentNo, "21001");
    assert.equal(candidates[0].qualifyingQuizCount, 2);
    assert.equal(candidates[0].submissionIds.length, 2);
  });
  it("resolves timestamp ties deterministically and preserves database microsecond precision", () => {
    const a = submission({ id: "a", submittedAt: "2026-10-05T01:00:00.000002+00:00" });
    const z = submission({ id: "z", submittedAt: "2026-10-05T01:00:00.000001+00:00" });
    assert.equal(latestSubmissions([z, a])[0].id, "a");
    assert.equal(latestSubmissions([a, { ...a, id: "z" }])[0].id, "z");
    assert.equal(latestSubmissions([{ ...a, id: "z" }, a])[0].id, "z");
  });
  it("does not count zero-question quizzes as perfect and handles empty data", () => {
    assert.equal(getLotteryCandidates([submission({ maxScore: 0, finalScore: 0 })]).length, 0);
    const stats = buildSubmissionStats([]);
    assert.equal(stats.rawCount, 0);
    assert.equal(stats.eligibleStudentCount, 0);
    assert.deepEqual(stats.questions, []);
  });
  it("does not revive an old score when the student name changed", () => {
    const old = submission({ id: "old", studentName: "이전이름", submittedAt: "2026-10-01T00:00:00Z" });
    const recent = submission({ id: "new", studentName: "새이름", finalScore: 0 });
    const filtered = filterSubmissions([old, recent], { subject: "", quiz: "", student: "이전이름" });
    assert.equal(filtered.length, 2);
    assert.equal(buildSubmissionStats(filtered).perfectCount, 0);
  });
  it("filters by subject and quiz and always renders Korean time", () => {
    const records = [submission(), submission({ id: "b", subjectCode: "math", quizSetId: "quiz-2" })];
    assert.equal(filterSubmissions(records, { subject: "math", quiz: "quiz-2", student: "210" }).length, 1);
    assert.match(formatAdminDateTime("2026-10-05T00:00:00Z"), /09:00/);
    assert.equal(formatAdminDateTime("invalid"), "시각 확인 불가");
  });
});

describe("lottery sampling", () => {
  const candidates = getLotteryCandidates([submission(), submission({ id: "b", studentNo: "21002" }), submission({ id: "c", studentNo: "21003" })]);
  it("draws without replacement without mutating candidates", () => {
    const before = structuredClone(candidates);
    const selected = drawLotteryWinners(candidates, 3, (max) => max - 1);
    assert.equal(new Set(selected.map((entry) => entry.studentNo)).size, 3);
    assert.deepEqual(candidates, before);
    assert.equal(selected[0].studentNo, "21003");
  });
  it("gives every student an equal chance across all possible two-winner draw paths", () => {
    const frequencies = new Map<string, number>();
    for (let first = 0; first < 3; first += 1) for (let second = 0; second < 2; second += 1) {
      const offsets = [first, second];
      const winners = drawLotteryWinners(candidates, 2, () => offsets.shift()!);
      for (const winner of winners) frequencies.set(winner.studentNo, (frequencies.get(winner.studentNo) ?? 0) + 1);
    }
    assert.deepEqual([...frequencies.values()], [4, 4, 4]);
  });
  it("rejects invalid counts, duplicate students and out-of-range RNG results", () => {
    for (const count of [0, -1, 1.5, 4, NaN, Infinity]) assert.throws(() => drawLotteryWinners(candidates, count));
    assert.throws(() => drawLotteryWinners([candidates[0], candidates[0]], 1));
    assert.throws(() => drawLotteryWinners(candidates, 1, () => 3));
  });
  it("uses the cryptographic RNG by default", () => {
    assert.equal(drawLotteryWinners(candidates, 2).length, 2);
  });
});

describe("spreadsheet-safe CSV export", () => {
  it("escapes delimiters, embedded quotes, newlines and formula prefixes", () => {
    assert.equal(escapeCsvCell('한글, "이름"'), '"한글, ""이름"""');
    for (const text of ['=HYPERLINK("https://example.com")', "+SUM(1,2)", "-1+2", "@SUM(A1)", "  =1+1", "\t=1", "\r=1", "\n=1"]) assert.ok(escapeCsvCell(text).startsWith('"\''));
    assert.equal(escapeCsvCell("김학생"), '"김학생"');
  });
  it("includes a UTF-8 BOM and marks old records even in a filtered export", () => {
    const old = submission({ id: "old", studentName: "=1+1", submittedAt: "2026-10-01T00:00:00Z" });
    const latest = submission({ id: "latest" });
    const csv = submissionsCsv([old], [old, latest]);
    assert.ok(csv.startsWith("\uFEFF"));
    assert.ok(csv.includes('"\'=1+1"'));
    assert.ok(csv.includes('"이전 제출"'));
    assert.ok(csv.endsWith("\r\n"));
  });
});

describe("saved lottery results", () => {
  it("returns the persisted result on retry without reading candidates or drawing again", async () => {
    const existing: LotteryDraw = { id: "request-1", createdAt: "2026-10-05T00:00:00Z", candidateCount: 1, requestedCount: 1, winners: getLotteryCandidates([submission()]), criteriaVersion: lotteryCriteriaVersion };
    const result = await runLotteryDraw("request-1", 1, {
      find: async () => existing,
      loadSubmissions: async () => { throw new Error("Must not load candidates again"); },
      save: async () => { throw new Error("Must not save again"); },
    });
    assert.equal(result, existing);
  });
  it("does not return winners when saving fails", async () => {
    await assert.rejects(runLotteryDraw("request-1", 1, {
      find: async () => null,
      loadSubmissions: async () => [submission()],
      save: async () => { throw new Error("database unavailable"); },
    }), /database unavailable/);
  });
  it("does not save anything when candidate retrieval fails", async () => {
    let saved = false;
    await assert.rejects(runLotteryDraw("request-1", 1, {
      find: async () => null,
      loadSubmissions: async () => { throw new Error("database unavailable"); },
      save: async (draw) => { saved = true; return { ...draw, createdAt: "now" }; },
    }), /database unavailable/);
    assert.equal(saved, false);
  });
  it("rejects changing the winner count on an existing request", async () => {
    const existing: LotteryDraw = { id: "request-1", createdAt: "2026-10-05T00:00:00Z", candidateCount: 2, requestedCount: 1, winners: getLotteryCandidates([submission()]), criteriaVersion: lotteryCriteriaVersion };
    await assert.rejects(runLotteryDraw("request-1", 2, {
      find: async () => existing, loadSubmissions: async () => [], save: async (draw) => ({ ...draw, createdAt: "now" }),
    }), /추첨 인원을 바꿀 수 없습니다/);
  });
});
