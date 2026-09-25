import { Pool } from "pg";

// ─────────────────────────────────────────────────────────────────────────
// Confirmed live against the pos schema on 2026-09-25 via information_schema
// and a full column check across vw_orders, vw_order_items, and related
// tables. If the schema ever changes, this is the only file to update.
//
// Two different grains of data live here on purpose, queried separately:
//   - vw_orders: one row per ORDER. Has branch, date, net/gross sales,
//     channel, channel_group, payment method. This is the source for
//     totals, order counts, and channel breakdowns.
//   - vw_order_items: one row per LINE ITEM. Has item name and quantity,
//     but no channel. This is the source for item-level breakdowns.
// Both deliberately exclude order_master's customer_name/phone/full_address
// columns - Calu never queries anything with those in it.
const SCHEMA = "pos";

const ORDERS_TABLE = "vw_orders";
const ITEMS_TABLE = "vw_order_items";

const COL_BRANCH = "branch_name"; // present on both views
const COL_DATE = "business_date"; // plain `date` column on both, no time component
const COL_NET_SALES = "net_sales"; // vw_orders only
const COL_GROSS_SALES = "gross_sales"; // vw_orders only
const COL_CHANNEL = "channel"; // vw_orders only, e.g. a specific delivery app
const COL_CHANNEL_GROUP = "channel_group"; // vw_orders only, broader bucket e.g. delivery vs dine-in
const COL_LINE_VALUE = "line_value"; // vw_order_items only
const COL_ITEM_NAME = "item_name"; // vw_order_items only
const COL_QTY = "qty"; // vw_order_items only
// ─────────────────────────────────────────────────────────────────────────

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    // Some Postgres setups (especially ones originally meant for
    // same-network access, like this one's other internal callers) don't
    // have SSL configured at all - forcing an SSL handshake against those
    // fails with a generic connection error. Default to no SSL; set
    // POS_DATABASE_SSL=true in Vercel's env vars if the real server does
    // require/prefer it.
    const useSsl = process.env.POS_DATABASE_SSL === "true";
    pool = new Pool({
      connectionString: process.env.POS_DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: 3,
      connectionTimeoutMillis: 8000,
    });
  }
  return pool;
}

export const ALL_BRANCHES = [
  "Bahria Town",
  "DHA Phase 4",
  "DHA Phase 6",
  "Emporium",
  "Gulberg",
  "Johar Town",
  "Valencia",
];

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

// Calu is told this every conversation so it can compute any relative or
// named range itself ("today", "June 2026", "last 30 days", "this quarter")
// instead of the app only supporting a fixed list of periods.
export function todayInPkt(): string {
  return new Date(Date.now() + PKT_OFFSET_MS).toISOString().slice(0, 10);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_MS = 2 * 366 * 24 * 60 * 60 * 1000; // ~2 years, generous cap

function assertValidRange(startDate: string, endDate: string): void {
  if (!DATE_RE.test(startDate)) {
    throw new Error(`start_date must be YYYY-MM-DD, got "${startDate}"`);
  }
  if (!DATE_RE.test(endDate)) {
    throw new Error(`end_date must be YYYY-MM-DD, got "${endDate}"`);
  }
  if (endDate < startDate) {
    throw new Error("end_date is before start_date");
  }
  const ms =
    new Date(`${endDate}T00:00:00Z`).getTime() -
    new Date(`${startDate}T00:00:00Z`).getTime();
  if (ms > MAX_RANGE_MS) {
    throw new Error("That range is too large - try asking for at most a couple of years at a time");
  }
}

function groupingSql(
  groupBy: string,
  dateCol: string,
  branchCol: string,
  extraCols: Record<string, string>
): { groupExpr: string; labelExpr: string; isTimeGrouping: boolean } {
  const isTimeGrouping = groupBy === "day" || groupBy === "week" || groupBy === "month";

  if (groupBy === "day") {
    return { groupExpr: dateCol, labelExpr: `to_char(${dateCol}, 'YYYY-MM-DD')`, isTimeGrouping };
  }
  if (groupBy === "week" || groupBy === "month") {
    const expr = `date_trunc('${groupBy}', ${dateCol})`;
    return { groupExpr: expr, labelExpr: `to_char(${expr}, 'YYYY-MM-DD')`, isTimeGrouping };
  }
  if (groupBy === "branch") {
    return { groupExpr: branchCol, labelExpr: branchCol, isTimeGrouping };
  }
  if (groupBy in extraCols) {
    const col = extraCols[groupBy];
    return { groupExpr: col, labelExpr: col, isTimeGrouping };
  }
  return { groupExpr: "", labelExpr: "'Total'", isTimeGrouping };
}

// ─────────────────────────────────────────────────────────────────────────
// Order-level queries (vw_orders): totals, trends, branch comparisons,
// channel breakdowns, and order counts.
// ─────────────────────────────────────────────────────────────────────────

export type OrderGroupBy = "none" | "day" | "week" | "month" | "branch" | "channel" | "channel_group";

export interface OrderQueryRow {
  label: string;
  netSales: number;
  grossSales: number;
  orderCount: number;
}

export interface OrderQueryParams {
  // Already permission-filtered by the caller.
  branches: string[];
  startDate: string;
  endDate: string;
  groupBy: OrderGroupBy;
}

export async function runOrdersQuery(params: OrderQueryParams): Promise<OrderQueryRow[]> {
  assertValidRange(params.startDate, params.endDate);
  if (params.branches.length === 0) return [];

  const { groupExpr, labelExpr, isTimeGrouping } = groupingSql(
    params.groupBy,
    COL_DATE,
    COL_BRANCH,
    { channel: COL_CHANNEL, channel_group: COL_CHANNEL_GROUP }
  );

  const groupClause = groupExpr ? `group by ${groupExpr}` : "";
  const orderClause =
    params.groupBy === "none" ? "" : isTimeGrouping ? `order by ${groupExpr}` : `order by net_sales desc`;
  const limitClause = isTimeGrouping ? "limit 200" : params.groupBy === "none" ? "" : "limit 50";

  const sql = `
    select
      ${labelExpr} as label,
      coalesce(sum(${COL_NET_SALES}), 0) as net_sales,
      coalesce(sum(${COL_GROSS_SALES}), 0) as gross_sales,
      count(*) as order_count
    from ${SCHEMA}.${ORDERS_TABLE}
    where ${COL_BRANCH} = ANY($1)
      and ${COL_DATE} >= $2::date
      and ${COL_DATE} <= $3::date
    ${groupClause}
    ${orderClause}
    ${limitClause}
  `;

  const db = getPool();
  const result = await db.query(sql, [params.branches, params.startDate, params.endDate]);
  return result.rows.map((r) => ({
    label: String(r.label),
    netSales: Number(r.net_sales),
    grossSales: Number(r.gross_sales),
    orderCount: Number(r.order_count),
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// Item-level queries (vw_order_items): quantity/value by menu item.
// ─────────────────────────────────────────────────────────────────────────

export type ItemGroupBy = "none" | "day" | "week" | "month" | "branch" | "item";

export interface ItemQueryRow {
  label: string;
  totalValue: number;
  quantity: number;
}

export interface ItemQueryParams {
  // Already permission-filtered by the caller.
  branches: string[];
  startDate: string;
  endDate: string;
  groupBy: ItemGroupBy;
  itemSearch?: string;
}

export async function runItemsQuery(params: ItemQueryParams): Promise<ItemQueryRow[]> {
  assertValidRange(params.startDate, params.endDate);
  if (params.branches.length === 0) return [];

  const conditions = [
    `${COL_BRANCH} = ANY($1)`,
    `${COL_DATE} >= $2::date`,
    `${COL_DATE} <= $3::date`,
  ];
  const values: unknown[] = [params.branches, params.startDate, params.endDate];

  if (params.itemSearch) {
    values.push(`%${params.itemSearch}%`);
    conditions.push(`${COL_ITEM_NAME} ilike $${values.length}`);
  }

  const { groupExpr, labelExpr, isTimeGrouping } = groupingSql(
    params.groupBy,
    COL_DATE,
    COL_BRANCH,
    { item: COL_ITEM_NAME }
  );

  const groupClause = groupExpr ? `group by ${groupExpr}` : "";
  const orderClause =
    params.groupBy === "none" ? "" : isTimeGrouping ? `order by ${groupExpr}` : `order by total_value desc`;
  const limitClause = isTimeGrouping ? "limit 200" : params.groupBy === "none" ? "" : "limit 50";

  const sql = `
    select
      ${labelExpr} as label,
      coalesce(sum(${COL_LINE_VALUE}), 0) as total_value,
      coalesce(sum(${COL_QTY}), 0) as quantity
    from ${SCHEMA}.${ITEMS_TABLE}
    where ${conditions.join(" and ")}
    ${groupClause}
    ${orderClause}
    ${limitClause}
  `;

  const db = getPool();
  const result = await db.query(sql, values);
  return result.rows.map((r) => ({
    label: String(r.label),
    totalValue: Number(r.total_value),
    quantity: Number(r.quantity),
  }));
}
