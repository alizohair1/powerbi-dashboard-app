import type Anthropic from "@anthropic-ai/sdk";

export const CALU_TOOLS: Anthropic.Tool[] = [
  {
    name: "query_sales",
    description:
      "Order-level sales: totals, trends, branch comparisons, and channel breakdowns (e.g. delivery vs dine-in, or a specific delivery app). Also the only source of order counts. Combine group_by and branch freely, e.g.: a single total (group_by 'none'), a trend (group_by 'day'/'week'/'month'), a branch comparison (group_by 'branch', omit the branch field), or a channel breakdown (group_by 'channel_group' for broad categories like delivery/dine-in, or 'channel' for specific sources like a delivery app). Always compute start_date/end_date yourself from today's date.",
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
          enum: ["none", "day", "week", "month", "branch", "channel", "channel_group"],
          description:
            "'none' for a single total. 'day'/'week'/'month' for a trend. 'branch' to compare branches. 'channel_group' for broad categories (delivery/dine-in/etc). 'channel' for more specific sources within those.",
        },
      },
      required: ["start_date", "end_date", "group_by"],
    },
  },
  {
    name: "query_items",
    description:
      "Item-level sales: quantity and value sold, broken down by menu item, time, or branch. Use for 'how many X were sold', 'sales of X', or 'what are our best sellers'. No channel or order-count data here - use query_sales for that.",
    input_schema: {
      type: "object",
      properties: {
        branch: {
          type: "string",
          description:
            "Restrict to one exact branch name. Omit to include every branch the person is allowed to see - required when group_by is 'branch'.",
        },
        start_date: { type: "string", description: "YYYY-MM-DD, inclusive" },
        end_date: { type: "string", description: "YYYY-MM-DD, inclusive" },
        group_by: {
          type: "string",
          enum: ["none", "day", "week", "month", "branch", "item"],
          description:
            "'none' for a single total across all items (or the matched item_search). 'item' to break down by menu item - use this for 'best sellers'. 'day'/'week'/'month'/'branch' also available.",
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
