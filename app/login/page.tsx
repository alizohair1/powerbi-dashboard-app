import Image from "next/image";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="clay mx-auto mb-8 flex h-24 w-full max-w-[280px] items-center justify-center p-4">
          <Image
            src="/logo.png"
            alt="Johnny & Jugnu"
            width={803}
            height={104}
            priority
            className="h-auto w-full"
          />
        </div>

        <div className="clay p-7">
          <h1 className="font-display text-xl font-semibold text-ink mb-6 text-center">
            Sign in to view your dashboard
          </h1>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}