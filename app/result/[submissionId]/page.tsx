import ResultView from "@/app/result/[submissionId]/ResultView";

export default function ResultPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <ResultView />
      </div>
    </main>
  );
}
