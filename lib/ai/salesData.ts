import { Pool } from "pg";

// ─────────────────────────────────────────────────────────────────────────
// ⚠️  CONFIRM THESE FOUR NAMES before trusting real numbers from Calu.
// They match what the CMS app already uses (pos.vw_order_items on the same
// S4U_Sales_data database) but the exact column names are a best guess
// until you run inspect-db.js and check them. If any differ, this is the
// only place in the whole feature that needs to change.
const TABLE = "pos.vw_order_items";
const COL_BRANCH = "branch";
const COL_DATE = "order_date";
const COL_AMOUNT = "net_sales";
const COL_ORDER_ID = "order_number";
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

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function toSqlString(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

// Ranges are computed in Pakistan time (UTC+5) and returned as naive
// "YYYY-MM-DD HH:MM:SS" strings, matching how the rest of the org's systems
// store PKT timestamps without a timezone offset in this database.
function periodToRange(period: Period): { start: string; end: string } {
  const nowPkt = new Date(Date.now() + PKT_OFFSET_MS);
  const todayStart = startOfDayUtc(nowPkt);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  let start: Date;
  let end: Date;

  if (period === "today") {
    start = todayStart;
    end = tomorrowStart;
  } else if (period === "yesterday") {
    end = todayStart;
    start = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  } else if (period === "last_7_days") {
    end = tomorrowStart;
    start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "this_month") {
    start = new Date(Date.UTC(nowPkt.getUTCFullYear(), nowPkt.getUTCMonth(), 1));
    end = tomorrowStart;
  } else {
    const firstOfThisMonth = new Date(
      Date.UTC(nowPkt.getUTCFullYear(), nowPkt.getUTCMonth(), 1)
    );
    start = new Date(Date.UTC(nowPkt.getUTCFullYear(), nowPkt.getUTCMonth() - 1, 1));
    end = firstOfThisMonth;
  }

  return { start: toSqlString(start), end: toSqlString(end) };
}

export interface BranchSummary {
  branch: string;
  totalSales: number;
  orderCount: number;
}

export async function getSalesSummary(
  branch: string,
  period: Period
): Promise<BranchSummary> {
  const { start, end } = periodToRange(period);
  const db = getPool();
  const result = await db.query(
    `select
       coalesce(sum(${COL_AMOUNT}), 0) as total_sales,
       count(distinct ${COL_ORDER_ID}) as order_count
     from ${TABLE}
     where ${COL_BRANCH} = $1
       and ${COL_DATE} >= $2
       and ${COL_DATE} < $3`,
    [branch, start, end]
  );
  const row = result.rows[0];
  return {
    branch,
    totalSales: Number(row?.total_sales ?? 0),
    orderCount: Number(row?.order_count ?? 0),
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
       date_trunc('day', ${COL_DATE}) as day,
       coalesce(sum(${COL_AMOUNT}), 0) as total_sales
     from ${TABLE}
     where ${COL_BRANCH} = $1
       and ${COL_DATE} >= now() - ($2 || ' days')::interval
     group by 1
     order by 1`,
    [branch, clampedDays]
  );
  return result.rows.map((r) => ({
    date: new Date(r.day as string).toISOString().slice(0, 10),
    totalSales: Number(r.total_sales),
  }));
}
