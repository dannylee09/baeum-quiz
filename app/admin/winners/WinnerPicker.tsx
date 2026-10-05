"use client";

import { useRef, useState } from "react";
import { maskStudentName, maskStudentNo } from "@/lib/mock-data";
import type { LotteryDraw } from "@/lib/admin/lottery";
import { formatAdminDateTime } from "@/lib/admin/submission-stats";

type Props = { candidateCount: number; initialDraws: LotteryDraw[]; disabled?: boolean };

export default function WinnerPicker({ candidateCount, initialDraws, disabled = false }: Props) {
  const [count, setCount] = useState("1");
  const [draws, setDraws] = useState(initialDraws);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [latestDraw, setLatestDraw] = useState<LotteryDraw | null>(null);
  const [savedRequest, setSavedRequest] = useState<{ requestId: string; count: number } | null>(null);
  const inFlight = useRef(false);
  const winnerCount = Number(count);
  const isValid = Number.isInteger(winnerCount) && winnerCount >= 1 && winnerCount <= Math.min(100, candidateCount);

  async function pickWinners() {
    if (inFlight.current || disabled || !isValid) return;
    if (!savedRequest && !window.confirm(`학생 ${candidateCount}명 중 ${winnerCount}명을 추첨하고 결과를 저장합니다. 진행할까요?`)) return;
    inFlight.current = true;
    setPending(true);
    setErrorMessage("");
    try {
      const request = savedRequest ?? { requestId: crypto.randomUUID(), count: winnerCount };
      setSavedRequest(request);
      const response = await fetch("/api/admin/winners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      const data = await response.json() as { draw?: LotteryDraw; errorMessage?: string };
      if (!response.ok || !data.draw) {
        if (response.status === 400) setSavedRequest(null);
        throw new Error(data.errorMessage || "추첨 결과를 확인하지 못했습니다.");
      }
      const draw = data.draw;
      setLatestDraw(draw);
      setDraws((current) => [draw, ...current.filter((item) => item.id !== draw.id)].slice(0, 20));
      setSavedRequest(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return <>
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-zinc-950">학생별 정답자 추첨</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">각 퀴즈의 가장 최근 제출 중 만점이 하나라도 있으면 후보가 됩니다. 여러 퀴즈를 맞혀도 학번당 응모권은 1개이며, 한 번의 추첨에서 같은 학생이 중복 당첨되지 않습니다.</p>
      <p className="mt-3 font-semibold text-zinc-950">현재 후보 {candidateCount}명 · 학생당 응모권 1개</p>
      <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm font-medium text-zinc-700">뽑을 학생 수<input type="number" min={1} max={Math.min(100, candidateCount)} value={count} onChange={(event) => setCount(event.target.value)} disabled={pending || savedRequest !== null} className="mt-1 block w-28 rounded-md border border-zinc-300 px-3 py-2 disabled:bg-zinc-100" /></label><button type="button" onClick={pickWinners} disabled={pending || disabled || !isValid} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{pending ? "결과 저장 중…" : savedRequest ? "같은 추첨 결과 다시 확인" : "추첨하고 저장"}</button></div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">새 추첨은 별도 기록으로 저장되며 이전 당첨자도 다시 후보가 됩니다. 여러 명을 선정할 때는 한 번에 뽑을 학생 수를 입력해 주세요.</p>
      {candidateCount === 0 ? <p className="mt-3 text-sm text-zinc-600">아직 추첨 조건을 충족한 학생이 없습니다.</p> : null}
      {errorMessage ? <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p> : null}
      {latestDraw ? <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-5"><p className="font-semibold text-emerald-900">추첨 결과를 저장했습니다.</p><ul className="mt-3 space-y-2">{latestDraw.winners.map((winner, index) => <li key={winner.studentNo} className="text-lg font-bold text-zinc-950">{index + 1}. {maskStudentNo(winner.studentNo)} {maskStudentName(winner.studentName)}</li>)}</ul><p className="mt-3 text-xs text-emerald-800">후보 {latestDraw.candidateCount}명 · {formatAdminDateTime(latestDraw.createdAt)}</p></div> : null}
    </section>
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-zinc-950">저장된 추첨 기록</h2><p className="mt-1 text-sm text-zinc-600">최근 20회 기록입니다. 지급 확인을 위한 전체 학번과 이름은 관리자에게만 표시됩니다.</p>{draws.length === 0 ? <p className="mt-4 text-sm text-zinc-600">저장된 추첨 기록이 없습니다.</p> : <div className="mt-4 space-y-3">{draws.map((draw) => <details key={draw.id} className="rounded-md border border-zinc-200 p-4"><summary className="cursor-pointer text-sm font-semibold">{formatAdminDateTime(draw.createdAt)} · 후보 {draw.candidateCount}명 중 {draw.requestedCount}명</summary><ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">{draw.winners.map((winner) => <li key={winner.studentNo}>{winner.studentNo} {winner.studentName}</li>)}</ol><p className="mt-3 break-all text-xs text-zinc-500">기록 번호: {draw.id}</p></details>)}</div>}</section>
  </>;
}