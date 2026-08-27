/**
 * `@types/sql.js` types the package root rather than this asm subpath, and
 * drags in the `emscripten` global types with it. Only the members
 * `SqlJsAdapter` actually calls are declared here.
 */
declare module 'sql.js/dist/sql-asm.js' {
  export type SqlJsValue = string | number | null;

  export interface SqlJsResult {
    columns: string[];
    values: SqlJsValue[][];
  }

  export interface SqlJsDatabase {
    run(sql: string, params?: readonly SqlJsValue[]): void;
    exec(sql: string, params?: readonly SqlJsValue[]): SqlJsResult[];
    close(): void;
  }

  export interface SqlJsStatic {
    Database: new () => SqlJsDatabase;
  }

  export default function initSqlJs(): Promise<SqlJsStatic>;
}
