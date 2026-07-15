import Link from "next/link";
import { notFound } from "next/navigation";
import AdminQuizEditForm from "@/app/admin/quizzes/[quizId]/edit/AdminQuizEditForm";
import { getAdminQuizForEdit } from "@/lib/supabase/admin-queries";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    quizId: string;
  }>;
};

export default async function AdminQuizEditPage({ params }: Props) {
  const { quizId } = await params;
  const quiz = await getAdminQuizForEdit(quizId);

  if (!quiz) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/quizzes"
        className="text-sm font-medium text-zinc-600 hover:text-zinc-950"
      >
        퀴즈 목록으로
      </Link>
      <AdminQuizEditForm quiz={quiz} />
    </div>
  );
}
