import { Pool } from "pg";

// ─────────────────────────────────────────────────────────────────────────
// Confirmed live against pos.vw_order_items via information_schema and a
// distinct-values check on 2026-09-25. If the schema ever changes, this is
// the only file to update.
//
// NOTE: there's no confirmed order/invoice-id column, so order counts and
// average order value aren't available yet - only total sales value.
const TABLE = "vw_order_items";
const COL_BRANCH = "branch_name";
const COL_DATE = "business_date"; // plain `date` column, no time component
const COL_AMOUNT = "line_value";
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

export interface BranchSummary {
  branch: string;
  totalSales: number;
}

// Both dates are inclusive.
export async function getSalesTotal(
  branch: string,
  startDate: string,
  endDate: string
): Promise<BranchSummary> {
  assertValidRange(startDate, endDate);
  const db = getPool();
  const result = await db.query(
    `select coalesce(sum(${COL_AMOUNT}), 0) as total_sales
     from ${SCHEMA}.${TABLE}
     where ${COL_BRANCH} = $1
       and ${COL_DATE} >= $2::date
       and ${COL_DATE} <= $3::date`,
    [branch, startDate, endDate]
  );
  return { branch, totalSales: Number(result.rows[0]?.total_sales ?? 0) };
}

export async function getSalesByBranch(
  branches: string[],
  startDate: string,
  endDate: string
): Promise<BranchSummary[]> {
  return Promise.all(branches.map((b) => getSalesTotal(b, startDate, endDate)));
}

export type GroupBy = "day" | "week" | "month";

export interface SeriesPoint {
  period: string;
  totalSales: number;
}

// Breaks one branch's sales into equal buckets (day/week/month) across an
// arbitrary range - this is what lets Calu answer "break June down by week"
// or "daily trend for the last 30 days" with the same underlying query.
export async function getSalesSeries(
  branch: string,
  startDate: string,
  endDate: string,
  groupBy: GroupBy
): Promise<SeriesPoint[]> {
  assertValidRange(startDate, endDate);
  const trunc = groupBy === "day" ? "day" : groupBy === "week" ? "week" : "month";
  const db = getPool();
  const result = await db.query(
    `select
       date_trunc('${trunc}', ${COL_DATE}) as period,
       coalesce(sum(${COL_AMOUNT}), 0) as total_sales
     from ${SCHEMA}.${TABLE}
     where ${COL_BRANCH} = $1
       and ${COL_DATE} >= $2::date
       and ${COL_DATE} <= $3::date
     group by 1
     order by 1`,
    [branch, startDate, endDate]
  );
  return result.rows.map((r) => ({
    period: new Date(r.period as string).toISOString().slice(0, 10),
    totalSales: Number(r.total_sales),
  }));
}
