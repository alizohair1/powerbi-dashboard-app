import { Pool } from "pg";

// ─────────────────────────────────────────────────────────────────────────
// Confirmed live against pos.vw_order_items via information_schema and a
// distinct-values check on 2026-09-25. If the schema ever changes, this is
// the only file to update.
//
// NOTE: there's no confirmed order/invoice-id column, so order counts and
// average order value aren't available - only total sales value and
// item quantity.
const TABLE = "vw_order_items";
const COL_BRANCH = "branch_name";
const COL_DATE = "business_date"; // plain `date` column, no time component
const COL_AMOUNT = "line_value";
const COL_ITEM_NAME = "item_name";
const COL_QTY = "qty";
const SCHEMA = "pos";
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

export type GroupBy = "none" | "day" | "week" | "month" | "branch" | "item";

export interface QueryRow {
  label: string;
  totalSales: number;
  quantity: number;
}

export interface SalesQueryParams {
  // Already permission-filtered by the caller - this function trusts the
  // list it's given, so all enforcement must happen before calling this.
  branches: string[];
  startDate: string;
  endDate: string;
  groupBy: GroupBy;
  itemSearch?: string;
}

// The one general-purpose query behind every sales question Calu can
// answer: a total, a trend over time, a branch comparison, or an item
// breakdown - all through the same safe, parameterized shape. Every
// identifier below (table/column names) is a fixed constant from this
// file, never something supplied by the model - only values (branch
// names, dates, the item search text) come from the caller, and those
// are always passed as bound query parameters, never concatenated into
// the SQL text.
export async function runSalesQuery(params: SalesQueryParams): Promise<QueryRow[]> {
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

  let groupExpr = "";
  let labelExpr = "'Total'";
  const isTimeGrouping =
    params.groupBy === "day" || params.groupBy === "week" || params.groupBy === "month";

  if (params.groupBy === "day") {
    groupExpr = COL_DATE;
    labelExpr = `to_char(${COL_DATE}, 'YYYY-MM-DD')`;
  } else if (params.groupBy === "week" || params.groupBy === "month") {
    const trunc = params.groupBy;
    groupExpr = `date_trunc('${trunc}', ${COL_DATE})`;
    labelExpr = `to_char(date_trunc('${trunc}', ${COL_DATE}), 'YYYY-MM-DD')`;
  } else if (params.groupBy === "branch") {
    groupExpr = COL_BRANCH;
    labelExpr = COL_BRANCH;
  } else if (params.groupBy === "item") {
    groupExpr = COL_ITEM_NAME;
    labelExpr = COL_ITEM_NAME;
  }

  const groupClause = groupExpr ? `group by ${groupExpr}` : "";
  const orderClause =
    params.groupBy === "none"
      ? ""
      : isTimeGrouping
        ? `order by ${groupExpr}`
        : `order by total_sales desc`;
  const limitClause = isTimeGrouping ? "limit 200" : params.groupBy === "none" ? "" : "limit 50";

  const sql = `
    select
      ${labelExpr} as label,
      coalesce(sum(${COL_AMOUNT}), 0) as total_sales,
      coalesce(sum(${COL_QTY}), 0) as quantity
    from ${SCHEMA}.${TABLE}
    where ${conditions.join(" and ")}
    ${groupClause}
    ${orderClause}
    ${limitClause}
  `;

  const db = getPool();
  const result = await db.query(sql, values);
  return result.rows.map((r) => ({
    label: String(r.label),
    totalSales: Number(r.total_sales),
    quantity: Number(r.quantity),
  }));
}
