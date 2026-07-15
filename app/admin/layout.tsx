import Link from "next/link";
import AdminLoginForm from "@/app/admin/AdminLoginForm";
import AdminLogoutButton from "@/app/admin/AdminLogoutButton";
import { isAdminAuthenticated, isAdminPasswordConfigured } from "@/lib/admin-auth";

const navItems = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/quizzes", label: "퀴즈 관리" },
  { href: "/admin/submissions", label: "제출 현황" },
  { href: "/admin/winners", label: "정답자 추첨" },
  { href: "/admin/stats", label: "통계" },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isPasswordConfigured = isAdminPasswordConfigured();
  const isAuthenticated = await isAdminAuthenticated();

  if (!isPasswordConfigured || !isAuthenticated) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-zinc-500">관리자 보호</p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-950">
            관리자 페이지 접근
          </h1>

          {!isPasswordConfigured ? (
            <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              <p className="font-semibold">ADMIN_PASSWORD가 설정되지 않았습니다.</p>
              <p className="mt-1">
                `.env.local`에 `ADMIN_PASSWORD` 값을 추가한 뒤 개발 서버를 다시
                시작해 주세요.
              </p>
            </div>
          ) : (
            <>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                관리자 기능을 사용하려면 비밀번호를 입력해 주세요. 인증 후 일정
                시간 동안 관리자 페이지를 사용할 수 있습니다.
              </p>
              <AdminLoginForm />
            </>
          )}

          <Link
            href="/"
            className="mt-5 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-950"
          >
            학생용 퀴즈 목록으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-500">관리자 화면</p>
              <h1 className="mt-1 text-2xl font-bold text-zinc-950">
                배움나눔 퀴즈 관리
              </h1>
            </div>
            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-900 hover:text-zinc-950"
                >
                  {item.label}
                </Link>
              ))}
              <AdminLogoutButton />
            </nav>
          </div>
        </header>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
