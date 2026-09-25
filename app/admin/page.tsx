import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import AdminUserManager from "@/components/AdminUserManager";
import CaluFloatingButton from "@/components/CaluFloatingButton";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="clay flex h-12 w-32 items-center justify-center p-2">
            <Image src="/logo.png" alt="Johnny & Jugnu" width={803} height={104} className="h-auto w-full" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-accentDeep font-medium">Admin</p>
            <p className="font-display font-semibold text-ink">{profile?.full_name || user.email}</p>
          </div>
        </div>
        <LogoutButton />
      </header>
      <main className="max-w-5xl mx-auto px-6 pb-10">
        <AdminUserManager />
      </main>
      <CaluFloatingButton />
    </div>
  );
}
