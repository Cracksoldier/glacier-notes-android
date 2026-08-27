/** The value types a `STRICT` SQLite table can hold, plus the binding types we send. */
export type SqlValue = string | number | null;

export type SqlRow = Record<string, SqlValue>;

/** SQLite has no boolean type; `STRICT` tables store 0/1 under a CHECK constraint. */
export function toSqlBoolean(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

export function fromSqlBoolean(value: number): boolean {
  return value !== 0;
}
