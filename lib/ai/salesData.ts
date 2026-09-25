import { Pool } from "pg";

const SCHEMA = "pos";

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

// ─────────────────────────────────────────────────────────────────────────
// Schema discovery. Calu calls these itself, every conversation, instead of
// anyone hardcoding table/column names. Both queries only read Postgres's
// own metadata catalog (information_schema) - they can never return a row
// of actual business data, so there's nothing sensitive to leak here even
// before permission checks apply.
// ─────────────────────────────────────────────────────────────────────────

export interface TableInfo {
  tableName: string;
  tableType: string;
}

export async function listPosTables(): Promise<TableInfo[]> {
  const db = getPool();
  const result = await db.query(
    `select table_name, table_type
     from information_schema.tables
     where table_schema = $1
     order by table_name`,
    [SCHEMA]
  );
  return result.rows.map((r) => ({
    tableName: r.table_name as string,
    tableType: r.table_type as string,
  }));
}

export interface ColumnInfo {
  columnName: string;
  dataType: string;
}

export async function describeTable(tableName: string): Promise<ColumnInfo[]> {
  const db = getPool();
  const result = await db.query(
    `select column_name, data_type
     from information_schema.columns
     where table_schema = $1 and table_name = $2
     order by ordinal_position`,
    [SCHEMA, tableName]
  );
  return result.rows.map((r) => ({
    columnName: r.column_name as string,
    dataType: r.data_type as string,
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// Query execution. Every table/column name below comes from Claude, but
// none of it is ever interpolated into SQL until it's been checked against
// a fresh, real describeTable()/listPosTables() result - so the only way
// an identifier reaches the query is if it's the literal name of something
// that actually exists in the read-only "pos" schema. That's what makes
// this safe without falling back to a parameterized-values-only query,
// which can't parameterize column/table names at all.
// ─────────────────────────────────────────────────────────────────────────

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

async function assertTableExists(tableName: string): Promise<void> {
  const tables = await listPosTables();
  if (!tables.some((t) => t.tableName === tableName)) {
    throw new Error(`"${tableName}" is not a real table/view in the pos schema.`);
  }
}

async function assertColumnsExist(
  tableName: string,
  columns: string[]
): Promise<void> {
  const cols = await describeTable(tableName);
  const validNames = new Set(cols.map((c) => c.columnName));
  for (const c of columns) {
    if (!validNames.has(c)) {
      throw new Error(`"${c}" is not a real column on pos.${tableName}.`);
    }
  }
}

export interface QueryColumns {
  table: string;
  branchColumn: string;
  dateColumn: string;
  amountColumn: string;
  orderIdColumn: string;
}

export interface BranchSummary {
  branch: string;
  totalSales: number;
  orderCount: number;
}

export async function getSalesSummary(
  cols: QueryColumns,
  branch: string,
  period: Period
): Promise<BranchSummary> {
  await assertTableExists(cols.table);
  await assertColumnsExist(cols.table, [
    cols.branchColumn,
    cols.dateColumn,
    cols.amountColumn,
    cols.orderIdColumn,
  ]);

  const { start, end } = periodToRange(period);
  const db = getPool();
  const result = await db.query(
    `select
       coalesce(sum(${quoteIdent(cols.amountColumn)}), 0) as total_sales,
       count(distinct ${quoteIdent(cols.orderIdColumn)}) as order_count
     from ${SCHEMA}.${quoteIdent(cols.table)}
     where ${quoteIdent(cols.branchColumn)} = $1
       and ${quoteIdent(cols.dateColumn)} >= $2
       and ${quoteIdent(cols.dateColumn)} < $3`,
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
  cols: QueryColumns,
  branches: string[],
  period: Period
): Promise<BranchSummary[]> {
  return Promise.all(branches.map((b) => getSalesSummary(cols, b, period)));
}

export interface DailyPoint {
  date: string;
  totalSales: number;
}

export async function getSalesTrend(
  cols: QueryColumns,
  branch: string,
  days: number
): Promise<DailyPoint[]> {
  await assertTableExists(cols.table);
  await assertColumnsExist(cols.table, [
    cols.branchColumn,
    cols.dateColumn,
    cols.amountColumn,
  ]);

  const db = getPool();
  const clampedDays = Math.min(Math.max(Math.round(days), 1), 90);
  const result = await db.query(
    `select
       date_trunc('day', ${quoteIdent(cols.dateColumn)}) as day,
       coalesce(sum(${quoteIdent(cols.amountColumn)}), 0) as total_sales
     from ${SCHEMA}.${quoteIdent(cols.table)}
     where ${quoteIdent(cols.branchColumn)} = $1
       and ${quoteIdent(cols.dateColumn)} >= now() - ($2 || ' days')::interval
     group by 1
     order by 1`,
    [branch, clampedDays]
  );
  return result.rows.map((r) => ({
    date: new Date(r.day as string).toISOString().slice(0, 10),
    totalSales: Number(r.total_sales),
  }));
}
