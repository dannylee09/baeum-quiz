import "server-only";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import type { LotteryDraw } from "@/lib/admin/lottery";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type DrawRow = {
  id: string; created_at: string; candidate_count: number; requested_count: number;
  winners: LotteryDraw["winners"]; criteria_version: string;
};
const columns = "id, created_at, candidate_count, requested_count, winners, criteria_version";
function fromRow(row: DrawRow): LotteryDraw {
  return { id: row.id, createdAt: row.created_at, candidateCount: row.candidate_count, requestedCount: row.requested_count, winners: row.winners, criteriaVersion: row.criteria_version };
}

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) throw new Error("관리자 인증이 필요합니다.");
}

export async function getLotteryDraw(id: string): Promise<LotteryDraw | null> {
  await requireAdmin();
  const { data, error } = await createAdminSupabaseClient().from("lottery_draws").select(columns).eq("id", id).maybeSingle();
  if (error) throw new Error("저장된 추첨 결과를 확인하지 못했습니다.");
  return data ? fromRow(data as DrawRow) : null;
}

export async function getLotteryHistory(): Promise<{ draws: LotteryDraw[]; errorMessage?: string }> {
  try {
    await requireAdmin();
    const { data, error } = await createAdminSupabaseClient().from("lottery_draws").select(columns).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(20);
    if (error) throw error;
    return { draws: ((data ?? []) as DrawRow[]).map(fromRow) };
  } catch {
    return { draws: [], errorMessage: "추첨 기록을 불러오지 못했습니다. 저장 상태를 확인할 수 있을 때 추첨할 수 있습니다." };
  }
}

export async function saveLotteryDraw(draw: Omit<LotteryDraw, "createdAt">): Promise<LotteryDraw> {
  await requireAdmin();
  const { data, error } = await createAdminSupabaseClient().from("lottery_draws").insert({
    id: draw.id, candidate_count: draw.candidateCount, requested_count: draw.requestedCount,
    winners: draw.winners, criteria_version: draw.criteriaVersion,
  }).select(columns).single();
  if (!error && data) return fromRow(data as DrawRow);
  // Concurrent retries share a key. Return only the persisted result, never an unsaved draw.
  const existing = await getLotteryDraw(draw.id);
  if (existing && existing.requestedCount === draw.requestedCount) return existing;
  throw new Error("추첨 결과를 저장하지 못했습니다. 같은 요청으로 다시 확인해 주세요.");
}
