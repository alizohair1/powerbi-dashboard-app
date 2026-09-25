import type Anthropic from "@anthropic-ai/sdk";

export const CALU_TOOLS: Anthropic.Tool[] = [
  {
    name: "query_sales",
    description:
      "The general-purpose way to explore sales data - covers totals, trends, branch comparisons, and item breakdowns through one flexible shape. Slice it however the question calls for and combine filters freely, e.g.: a single total (group_by 'none'), a trend over time (group_by 'day'/'week'/'month'), a comparison across every branch the person can see (group_by 'branch', omit the branch field), a breakdown of menu items (group_by 'item'), or any of these filtered to one item search term (e.g. 'how did burgers sell across all my branches last month' = group_by 'branch' + item_search 'burger'). Always compute start_date/end_date yourself from today's date - there's no built-in 'today' or 'this month' shortcut.",
    input_schema: {
      type: "object",
      properties: {
        branch: {
          type: "string",
          description:
            "Restrict to one exact branch name, e.g. 'Gulberg'. Omit to include every branch the person is allowed to see - required when group_by is 'branch'.",
        },
        start_date: { type: "string", description: "YYYY-MM-DD, inclusive" },
        end_date: { type: "string", description: "YYYY-MM-DD, inclusive" },
        group_by: {
          type: "string",
          enum: ["none", "day", "week", "month", "branch", "item"],
          description:
            "'none' for a single total. 'day'/'week'/'month' for a trend over time (pick one that keeps the result to a reasonable number of points). 'branch' to compare branches. 'item' to break down by menu item.",
        },
        item_search: {
          type: "string",
          description:
            "Optional: filter to items whose name contains this text (case-insensitive, partial match), e.g. 'burger' or 'wehsi'. Leave out to include all items.",
        },
      },
      required: ["start_date", "end_date", "group_by"],
    },
  },
];
