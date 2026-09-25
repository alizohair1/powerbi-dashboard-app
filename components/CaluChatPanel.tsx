"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Role = "user" | "assistant";
type ChartPoint = { label: string; value: number };
type ChartData = { type: "bar" | "line"; data: ChartPoint[] } | null;

interface Message {
  role: Role;
  content: string;
  chartData?: ChartData;
}

const SUGGESTIONS = [
  "What were today's sales?",
  "Compare my branches this week",
  "How's this month looking?",
];

export default function CaluChatPanel({ compact = false }: { compact?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi, I'm Calu. Ask me about sales for the branches you have access to.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error || "Something went wrong." },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply, chartData: data.chartData },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I couldn't reach the server - try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="clay flex h-full flex-col overflow-hidden">
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto p-5"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "flex justify-end"
                : "flex items-end gap-2 justify-start"
            }
          >
            {m.role === "assistant" && (
              <div className="clay flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden p-0.5">
                <Image src="/calu.png" alt="" width={32} height={32} className="h-full w-full object-cover" />
              </div>
            )}
            <div
              className={
                m.role === "user"
                  ? "clay-btn max-w-[85%] bg-accent px-4 py-2.5 text-sm text-white"
                  : "clay-well max-w-[85%] px-4 py-2.5 text-sm text-ink"
              }
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.chartData && m.chartData.data.length > 0 && (
                <div className={compact ? "mt-3 h-40 w-full" : "mt-3 h-56 w-full"}>
                  <ResponsiveContainer width="100%" height="100%">
                    {m.chartData.type === "bar" ? (
                      <BarChart data={m.chartData.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E7D9C4" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#FF6B4A" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    ) : (
                      <LineChart data={m.chartData.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E7D9C4" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#FF6B4A"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-end gap-2 justify-start">
            <div className="clay flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden p-0.5">
              <Image src="/calu.png" alt="" width={32} height={32} className="h-full w-full object-cover" />
            </div>
            <div className="clay-well px-4 py-2.5 text-sm text-ink/50">Thinking…</div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 px-5 pb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="clay-chip px-3 py-1.5 text-xs text-ink/70"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 p-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Calu about your sales…"
          className="clay-well flex-1 border-0 px-4 py-2.5 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="clay-btn bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accentDeep transition-colors disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  );
}
