import type Anthropic from "@anthropic-ai/sdk";

export const CALU_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_pos_tables",
    description:
      "List every table/view in the sales database's 'pos' schema. Call this first, before any sales question, if you don't already know which table holds order/sales data in this conversation.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "describe_pos_table",
    description:
      "Get the real column names and types for one table/view in the pos schema. Call this before your first query against a table, so you use its actual column names instead of guessing. Look for columns that represent: branch/location, order date or timestamp, sales amount, and an order/invoice identifier (for counting distinct orders).",
    input_schema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Exact table/view name from list_pos_tables" },
      },
      required: ["table_name"],
    },
  },
  {
    name: "get_sales_summary",
    description:
      "Get total sales and order count for ONE specific branch over a date range. Requires the real table and column names you discovered with describe_pos_table. Only call this for a branch the person is authorized to see - unauthorized branches are rejected by the system.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string" },
        branch_column: { type: "string" },
        date_column: { type: "string" },
        amount_column: { type: "string" },
        order_id_column: { type: "string" },
        branch: { type: "string", description: "Exact branch name, e.g. 'Gulberg'" },
        period: {
          type: "string",
          enum: ["today", "yesterday", "last_7_days", "this_month", "last_month"],
        },
      },
      required: [
        "table",
        "branch_column",
        "date_column",
        "amount_column",
        "order_id_column",
        "branch",
        "period",
      ],
    },
  },
  {
    name: "get_sales_by_branch",
    description:
      "Compare sales across every branch the current person is allowed to see, for a date range. Use this when they don't name one specific branch, or explicitly ask to compare branches. Requires the real table/column names from describe_pos_table.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string" },
        branch_column: { type: "string" },
        date_column: { type: "string" },
        amount_column: { type: "string" },
        order_id_column: { type: "string" },
        period: {
          type: "string",
          enum: ["today", "yesterday", "last_7_days", "this_month", "last_month"],
        },
      },
      required: [
        "table",
        "branch_column",
        "date_column",
        "amount_column",
        "order_id_column",
        "period",
      ],
    },
  },
  {
    name: "get_sales_trend",
    description:
      "Get a day-by-day sales trend for one branch over the last N days. Good for 'how has X branch been doing lately' questions and for drawing a line chart. Requires the real table/column names from describe_pos_table.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string" },
        branch_column: { type: "string" },
        date_column: { type: "string" },
        amount_column: { type: "string" },
        branch: { type: "string" },
        days: { type: "number", description: "How many days back to look, e.g. 7 or 30" },
      },
      required: ["table", "branch_column", "date_column", "amount_column", "branch", "days"],
    },
  },
];
