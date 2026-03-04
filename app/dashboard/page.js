import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BoardApp } from "@/components/board-app";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return <BoardApp user={session.user} />;
}
