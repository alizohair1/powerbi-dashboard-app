import type Anthropic from "@anthropic-ai/sdk";

export const CALU_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_sales_summary",
    description:
      "Get total sales for ONE specific branch over a date range. Only call this for a branch the person is authorized to see - unauthorized branches are rejected by the system, not by you, so it's fine to try and let the system enforce it.",
    input_schema: {
      type: "object",
      properties: {
        branch: {
          type: "string",
          description: "Exact branch name, e.g. 'Gulberg'",
        },
        period: {
          type: "string",
          enum: ["today", "yesterday", "last_7_days", "this_month", "last_month"],
        },
      },
      required: ["branch", "period"],
    },
  },
  {
    name: "get_sales_by_branch",
    description:
      "Compare sales across every branch the current person is allowed to see, for a date range. Use this when they don't name one specific branch, or explicitly ask to compare branches.",
    input_schema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["today", "yesterday", "last_7_days", "this_month", "last_month"],
        },
      },
      required: ["period"],
    },
  },
  {
    name: "get_sales_trend",
    description:
      "Get a day-by-day sales trend for one branch over the last N days. Good for 'how has X branch been doing lately' type questions, and for drawing a line chart.",
    input_schema: {
      type: "object",
      properties: {
        branch: { type: "string" },
        days: {
          type: "number",
          description: "How many days back to look, e.g. 7 or 30",
        },
      },
      required: ["branch", "days"],
    },
  },
];
