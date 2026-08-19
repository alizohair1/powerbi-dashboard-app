"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError("Incorrect email or password.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-ink/70 mb-1.5"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="clay-well w-full border-0 px-4 py-3 text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/40"
          placeholder="you@company.com"
          autoComplete="email"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-ink/70 mb-1.5"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="clay-well w-full border-0 px-4 py-3 text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/40"
          placeholder="••••••••"
          autoComplete="current-password"
        />
      </div>

      {error && (
        <p className="text-sm text-warn bg-warn/10 rounded-clay-sm px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="clay-btn w-full bg-accent text-white font-medium py-3 hover:bg-accentDeep transition-colors disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
