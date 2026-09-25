import type Anthropic from "@anthropic-ai/sdk";

export const CALU_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_sales_total",
    description:
      "Get total sales for ONE branch over an explicit date range (both dates inclusive). Use for a specific day, week, month, or any custom range - e.g. 'sales in June 2026', 'sales last Tuesday', 'sales from Jan 1 to Mar 31 2026'. Compute the actual start_date/end_date yourself from today's date. Only call this for a branch the person is authorized to see - unauthorized branches are rejected by the system, not by you, so it's fine to try and let the system enforce it.",
    input_schema: {
      type: "object",
      properties: {
        branch: { type: "string", description: "Exact branch name, e.g. 'Gulberg'" },
        start_date: { type: "string", description: "YYYY-MM-DD, inclusive" },
        end_date: { type: "string", description: "YYYY-MM-DD, inclusive" },
      },
      required: ["branch", "start_date", "end_date"],
    },
  },
  {
    name: "get_sales_by_branch",
    description:
      "Compare total sales across every branch the person is allowed to see, for one explicit date range (both dates inclusive). Use when they don't name a specific branch, or explicitly want to compare branches.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "YYYY-MM-DD, inclusive" },
        end_date: { type: "string", description: "YYYY-MM-DD, inclusive" },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "get_sales_series",
    description:
      "Get a sales trend for ONE branch across a date range, broken into equal periods for charting. Use for 'how has X been doing', 'break June down by week', 'daily trend for the last 30 days', 'monthly sales this year', etc. Choose group_by sensibly: 'day' for ranges under ~6 weeks, 'week' for a few months, 'month' for a year or more - don't return hundreds of daily points for a multi-year range.",
    input_schema: {
      type: "object",
      properties: {
        branch: { type: "string" },
        start_date: { type: "string", description: "YYYY-MM-DD, inclusive" },
        end_date: { type: "string", description: "YYYY-MM-DD, inclusive" },
        group_by: { type: "string", enum: ["day", "week", "month"] },
      },
      required: ["branch", "start_date", "end_date", "group_by"],
    },
  },
];
