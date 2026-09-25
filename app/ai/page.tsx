import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import CaluChatPanel from "@/components/CaluChatPanel";

export default async function CaluPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="h-screen overflow-hidden relative">
      <header className="absolute inset-x-0 top-0 h-20 flex items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <div className="clay flex h-12 w-12 items-center justify-center overflow-hidden p-1">
            <Image src="/calu.png" alt="Calu" width={48} height={48} className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-accentDeep font-medium">
              Calu
            </p>
            <p className="font-display font-semibold text-ink">
              {profile?.full_name || user.email}
            </p>
          </div>
        </div>
        <LogoutButton />
      </header>
      <main className="absolute inset-x-0 bottom-0 top-20 px-6 pb-6">
        <CaluChatPanel />
      </main>
    </div>
  );
}
