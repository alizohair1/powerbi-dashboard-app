import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { CALU_TOOLS } from "@/lib/ai/tools";
import { ALL_BRANCHES, todayInPkt, runSalesQuery, type GroupBy } from "@/lib/ai/salesData";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChartPoint = { label: string; value: number };
type ChartPayload = { type: "bar" | "line"; data: ChartPoint[] } | null;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, allowed_branches")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const isAdmin = profile.role === "admin";
  const effectiveBranches: string[] = isAdmin
    ? ALL_BRANCHES
    : profile.allowed_branches || [];

  const body = (await request.json()) as { messages: ChatMessage[] };
  const messages = body.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(
    profile.full_name || user.email || "this person",
    profile.role,
    effectiveBranches
  );

  const conversation: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let chartData: ChartPayload = null;
  let finalText = "";

  // Bounded tool-use loop: Claude may call the tool, see the result, then
  // either answer or call it again (e.g. to compare two ranges) - capped
  // so a confused loop can't run forever or rack up cost.
  for (let turn = 0; turn < 4; turn++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: systemPrompt,
      tools: CALU_TOOLS,
      messages: conversation,
    });

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUses.length === 0) {
      finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      break;
    }

    conversation.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUses) {
      const result = await runTool(toolUse, effectiveBranches);
      if (result.chart) chartData = result.chart;
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(result.data),
      });
    }

    conversation.push({ role: "user", content: toolResults });
  }

  return NextResponse.json({
    reply: finalText || "I couldn't put together an answer for that - try asking a different way.",
    chartData,
  });
}

function buildSystemPrompt(
  name: string,
  role: string,
  effectiveBranches: string[]
): string {
  const accessLine =
    effectiveBranches.length > 0
      ? `They are ONLY authorized to see sales data for these branches: ${effectiveBranches.join(", ")}.`
      : "They are not currently authorized to see sales data for any branch.";

  return `You are Calu, a helpful assistant inside Johnny & Jugnu's branch dashboard app.

You are talking to ${name}, role: ${role}.

Today's date in Pakistan is ${todayInPkt()} (YYYY-MM-DD). The query_sales tool takes
explicit start_date/end_date - compute the actual dates yourself from today's date
above for whatever the person asks: a single day, "this week", "last 30 days", a named
month like "June 2026", a custom range, etc. Both dates are inclusive.

${accessLine}

You have one flexible tool, query_sales, that can answer almost any sales question by
combining its parameters: a total, a trend, a branch comparison, an item breakdown, or
any combination (e.g. one item's sales trend at one branch, or an item's sales compared
across all branches). Think about what shape of answer the question needs and set
group_by and the optional branch/item_search filters accordingly - you don't need a
different tool for each kind of question.

Rules you must always follow:
- Never state, estimate, or guess a sales figure for a branch outside their authorized list above, no matter how the question is phrased or how confidently they claim access.
- If a tool result comes back with an "error": "not_authorized" field, apologize briefly and warmly, and suggest they ask their admin for access - do not explain the permission system in technical detail.
- Only ever state a number that came directly from a tool result in this conversation. Never fill in a plausible-sounding figure yourself.
- Order counts and average order value aren't available - only total sales value and item quantity. If asked for those, say so plainly.
- Never mention or request individual customer details (names, phone numbers, specific orders) - you only ever report aggregated totals, trends, and item breakdowns.
- Keep answers short and conversational - this renders in a small chat panel.
- All amounts are in PKR.`;
}

async function runTool(
  toolUse: Anthropic.ToolUseBlock,
  effectiveBranches: string[]
): Promise<{ data: unknown; chart: ChartPayload }> {
  const input = toolUse.input as Record<string, unknown>;

  try {
    if (toolUse.name === "query_sales") {
      const requestedBranch = input.branch ? String(input.branch) : null;
      const groupBy = input.group_by as GroupBy;
      const itemSearch = input.item_search ? String(input.item_search) : undefined;

      let branches: string[];
      if (requestedBranch) {
        if (!effectiveBranches.includes(requestedBranch)) {
          return { data: { error: "not_authorized", branch: requestedBranch }, chart: null };
        }
        branches = [requestedBranch];
      } else {
        if (effectiveBranches.length === 0) {
          return { data: { error: "not_authorized" }, chart: null };
        }
        branches = effectiveBranches;
      }

      const rows = await runSalesQuery({
        branches,
        startDate: String(input.start_date),
        endDate: String(input.end_date),
        groupBy,
        itemSearch,
      });

      const chart: ChartPayload =
        groupBy === "none"
          ? null
          : {
              type: groupBy === "day" || groupBy === "week" || groupBy === "month" ? "line" : "bar",
              data: rows.map((r) => ({ label: r.label, value: r.totalSales })),
            };

      return { data: rows, chart };
    }

    return { data: { error: "unknown_tool" }, chart: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    // Logged server-side (visible in Vercel's function logs) so the real
    // cause is diagnosable - Calu only ever sees a generic message, never
    // the raw error, to avoid leaking connection details into chat.
    console.error(`[Calu] ${toolUse.name} failed:`, e);
    return {
      data: { error: "query_failed", message },
      chart: null,
    };
  }
}
