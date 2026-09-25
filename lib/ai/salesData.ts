import { Pool } from "pg";

// ─────────────────────────────────────────────────────────────────────────
// Confirmed live against pos.vw_order_items via information_schema on
// 2026-09-25. If the schema ever changes, this is the only file to update.
//
// NOTE: there's no confirmed order/invoice-id column, so order counts and
// average order value aren't available yet - only total sales value.
// branch_name is assumed to match the branch names used in /admin (e.g.
// "Gulberg"), pending a distinct-values check - see conversation.
const TABLE = "vw_order_items";
const COL_BRANCH = "branch_name";
const COL_DATE = "business_date"; // plain `date` column, no time component
const COL_AMOUNT = "line_value";
const SCHEMA = "pos";
// ─────────────────────────────────────────────────────────────────────────

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.POS_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
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

export type Period =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "this_month"
  | "last_month";

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// business_date is a plain calendar date already (no time-of-day), so we
// just need to know which calendar date "today" is in Pakistan and do
// simple date arithmetic - no timestamp/timezone conversion required.
function periodToRange(period: Period): { start: string; end: string } {
  const nowPkt = new Date(Date.now() + PKT_OFFSET_MS);
  const y = nowPkt.getUTCFullYear();
  const m = nowPkt.getUTCMonth();
  const d = nowPkt.getUTCDate();

  const today = new Date(Date.UTC(y, m, d));
  const tomorrow = new Date(Date.UTC(y, m, d + 1));

  let start: Date;
  let end: Date;

  if (period === "today") {
    start = today;
    end = tomorrow;
  } else if (period === "yesterday") {
    end = today;
    start = new Date(Date.UTC(y, m, d - 1));
  } else if (period === "last_7_days") {
    end = tomorrow;
    start = new Date(Date.UTC(y, m, d - 7));
  } else if (period === "this_month") {
    start = new Date(Date.UTC(y, m, 1));
    end = tomorrow;
  } else {
    start = new Date(Date.UTC(y, m - 1, 1));
    end = new Date(Date.UTC(y, m, 1));
  }

  return { start: toDateStr(start), end: toDateStr(end) };
}

export interface BranchSummary {
  branch: string;
  totalSales: number;
}

export async function getSalesSummary(
  branch: string,
  period: Period
): Promise<BranchSummary> {
  const { start, end } = periodToRange(period);
  const db = getPool();
  const result = await db.query(
    `select coalesce(sum(${COL_AMOUNT}), 0) as total_sales
     from ${SCHEMA}.${TABLE}
     where ${COL_BRANCH} = $1
       and ${COL_DATE} >= $2::date
       and ${COL_DATE} < $3::date`,
    [branch, start, end]
  );
  return {
    branch,
    totalSales: Number(result.rows[0]?.total_sales ?? 0),
  };
}

export async function getSalesByBranch(
  branches: string[],
  period: Period
): Promise<BranchSummary[]> {
  return Promise.all(branches.map((b) => getSalesSummary(b, period)));
}

export interface DailyPoint {
  date: string;
  totalSales: number;
}

export async function getSalesTrend(
  branch: string,
  days: number
): Promise<DailyPoint[]> {
  const db = getPool();
  const clampedDays = Math.min(Math.max(Math.round(days), 1), 90);
  const result = await db.query(
    `select
       ${COL_DATE} as day,
       coalesce(sum(${COL_AMOUNT}), 0) as total_sales
     from ${SCHEMA}.${TABLE}
     where ${COL_BRANCH} = $1
       and ${COL_DATE} >= (now() at time zone 'Asia/Karachi')::date - ($2 || ' days')::interval
     group by 1
     order by 1`,
    [branch, clampedDays]
  );
  return result.rows.map((r) => ({
    date: new Date(r.day as string).toISOString().slice(0, 10),
    totalSales: Number(r.total_sales),
  }));
}
