import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import CaluFloatingButton from "@/components/CaluFloatingButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, branch, dashboard_url, role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") redirect("/admin");

  return (
    <div className="h-screen overflow-hidden relative">
      <header className="absolute inset-x-0 top-0 h-20 flex items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-4">
          <div className="clay flex h-12 w-32 items-center justify-center p-2">
            <Image src="/logo.png" alt="Johnny & Jugnu" width={803} height={104} className="h-auto w-full" />
          </div>
          <div>
            <p className="font-display font-semibold text-ink">{profile?.full_name || user.email}</p>
          </div>
        </div>
        <LogoutButton />
      </header>
      <main className="absolute inset-x-0 bottom-0 top-20 px-6 pb-6">
        {profile?.dashboard_url ? (
          <div className="clay h-full overflow-hidden p-2">
            <iframe src={profile.dashboard_url} title="Dashboard" className="rounded-clay-sm border-0"
              style={{ width: "100%", height: "100%" }} allowFullScreen />
          </div>
        ) : (
          <div className="clay flex h-full items-center justify-center">
            <p className="text-ink/50 text-center max-w-sm px-4">
              No dashboard has been assigned to your account yet. Contact your admin to get access.
            </p>
          </div>
        )}
      </main>
      <CaluFloatingButton />
    </div>
  );
}
