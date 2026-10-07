import "server-only";

import { unstable_cache } from "next/cache";
import { maskStudentName, maskStudentNo } from "@/lib/mock-data";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { readAllRows } from "@/lib/supabase/read-all";

type PublishedQuiz = { id: string };
type ScoreRow = {
  id: string;
  quiz_set_id: string;
  student_no: string;
  student_name: string;
  final_score: number;
  max_score: number | null;
  created_at: string;
};

export type LeaderboardEntry = {
  rank: number;
  maskedStudentNo: string;
  maskedStudentName: string;
  totalScore: number;
  quizCount: number;
};

async function queryPublicLeaderboard(): Promise<LeaderboardEntry[]> {
  const supabase = createAdminSupabaseClient();
  const cutoff = new Date().toISOString();
  const { data: quizData, error: quizError } = await supabase
    .from("quiz_sets")
    .select("id")
    .eq("published", true);
  if (quizError) throw new Error("Leaderboard unavailable");

  const quizIds = ((quizData ?? []) as PublishedQuiz[]).map(({ id }) => id);
  if (quizIds.length === 0) return [];

  const rows = await readAllRows<ScoreRow>(
    supabase,
    "submissions",
    "id, quiz_set_id, student_no, student_name, final_score, max_score, created_at",
    cutoff,
    { inColumn: "quiz_set_id", values: quizIds },
  );

  const latestByStudentAndQuiz = new Map<string, ScoreRow>();
  for (const row of rows) {
    const studentNo = row.student_no.trim();
    if (!studentNo) continue;
    const key = JSON.stringify([studentNo, row.quiz_set_id]);
    const current = latestByStudentAndQuiz.get(key);
    if (!current || isNewer(row, current)) latestByStudentAndQuiz.set(key, row);
  }

  const totals = new Map<string, { studentNo: string; studentName: string; totalScore: number; quizCount: number }>();
  for (const row of latestByStudentAndQuiz.values()) {
    const studentNo = row.student_no.trim();
    const entry = totals.get(studentNo) ?? {
      studentNo,
      studentName: row.student_name.trim() || "학생",
      totalScore: 0,
      quizCount: 0,
    };
    entry.totalScore += Math.max(0, Number(row.final_score) || 0);
    entry.quizCount += 1;
    totals.set(studentNo, entry);
  }

  const ordered = [...totals.values()].sort((a, b) =>
    b.totalScore - a.totalScore || a.studentNo.localeCompare(b.studentNo),
  );

  let rank = 0;
  let priorScore: number | null = null;
  return ordered.slice(0, 50).map((entry, index) => {
    if (index === 0 || entry.totalScore !== priorScore) rank = index + 1;
    priorScore = entry.totalScore;
    return {
      rank,
      maskedStudentNo: maskStudentNo(entry.studentNo),
      maskedStudentName: maskStudentName(entry.studentName),
      totalScore: entry.totalScore,
      quizCount: entry.quizCount,
    };
  });
}

// Cache only the already-masked public output to keep leaderboard reads bounded.
export const getPublicLeaderboard = unstable_cache(
  queryPublicLeaderboard,
  ["public-leaderboard-v1"],
  { revalidate: 60, tags: ["public-leaderboard"] },
);

function isNewer(candidate: ScoreRow, current: ScoreRow) {
  const difference = Date.parse(candidate.created_at) - Date.parse(current.created_at);
  if (difference !== 0) return difference > 0;
  const fraction = (value: string) => Number((value.match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})$/)?.[1] ?? "").padEnd(6, "0").slice(0, 6));
  const fractionDifference = fraction(candidate.created_at) - fraction(current.created_at);
  return fractionDifference !== 0 ? fractionDifference > 0 : candidate.id.localeCompare(current.id) > 0;
}
