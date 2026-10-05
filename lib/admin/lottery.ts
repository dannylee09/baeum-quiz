import { randomInt } from "node:crypto";
import type { LotteryCandidate } from "@/lib/admin/submission-stats";
import { getLotteryCandidates } from "@/lib/admin/submission-stats";
import type { AdminSubmission } from "@/lib/supabase/admin-queries";

export const lotteryCriteriaVersion = "latest-per-quiz-student-once-v1";
export type LotteryDraw = {
  id: string;
  createdAt: string;
  candidateCount: number;
  requestedCount: number;
  winners: LotteryCandidate[];
  criteriaVersion: string;
};

export class LotteryInputError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

type LotteryDependencies = {
  find: (id: string) => Promise<LotteryDraw | null>;
  loadSubmissions: () => Promise<AdminSubmission[]>;
  save: (draw: Omit<LotteryDraw, "createdAt">) => Promise<LotteryDraw>;
};

export async function runLotteryDraw(requestId: string, count: number, dependencies: LotteryDependencies) {
  const existing = await dependencies.find(requestId);
  if (existing) {
    if (existing.requestedCount !== count) throw new LotteryInputError("같은 요청의 추첨 인원을 바꿀 수 없습니다. 저장된 결과를 확인해 주세요.", 409);
    return existing;
  }
  const candidates = getLotteryCandidates(await dependencies.loadSubmissions());
  if (count > candidates.length) throw new LotteryInputError(`현재 추첨 후보는 ${candidates.length}명입니다. 인원을 줄여 주세요.`);
  const winners = drawLotteryWinners(candidates, count);
  // Reveal only a saved result. A persistence failure must never return this random draw.
  return dependencies.save({ id: requestId, candidateCount: candidates.length, requestedCount: count, winners, criteriaVersion: lotteryCriteriaVersion });
}

export function drawLotteryWinners(candidates: LotteryCandidate[], count: number, randomIndex: (max: number) => number = randomInt) {
  if (!Number.isInteger(count) || count < 1 || count > 100 || count > candidates.length) throw new Error("추첨 인원은 후보 수 이내의 1~100명이어야 합니다.");
  if (new Set(candidates.map((candidate) => candidate.studentNo)).size !== candidates.length) throw new Error("중복된 학생이 후보에 포함되어 있습니다.");
  const pool = [...candidates];
  // Partial Fisher-Yates sampling gives every student equal probability without replacement.
  for (let index = 0; index < count; index += 1) {
    const offset = randomIndex(pool.length - index);
    if (!Number.isInteger(offset) || offset < 0 || offset >= pool.length - index) throw new Error("추첨 난수를 생성하지 못했습니다.");
    const chosen = index + offset;
    [pool[index], pool[chosen]] = [pool[chosen], pool[index]];
  }
  return pool.slice(0, count);
}
