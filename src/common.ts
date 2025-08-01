// Shared constants and types between frontend and backend
export const NUMERICAL_COLUMN_TYPES = [
  "DECIMAL",
  "DOUBLE",
  "FLOAT",
  "NUMERIC",
  "REAL",
  // these are usually used for ids
  // 'INTEGER',
  // 'BIGINT',
];

export interface Filter {
  column: string;
  value: string;
  type?: 'exact' | 'range';
  min?: number;
  max?: number;
}

export interface RangeFilter {
  column: string;
  min: number;
  max: number;
}

export interface BaseQuery {
  tableName: string;
  exactFilters?: Record<string, string | number | boolean>;
  rangeFilters?: Record<string, RangeFilter>;
}

export interface Query extends BaseQuery {
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface HistogramQuery extends BaseQuery {
  columnName: string;
  columnType: string;
  topN?: number;
  bins?: number;
}

export type QueryRunner = (sql: string, params?: any[]) => Promise<any[]>;
