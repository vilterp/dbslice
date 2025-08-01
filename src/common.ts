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

export interface Query {
  tableName: string;
  exactFilters?: Record<string, any>;
  rangeFilters?: Record<string, RangeFilter>;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export type QueryRunner = (sql: string, params?: any[]) => Promise<any[]>;

export interface HistogramQuery {
  tableName: string;
  columnName: string;
  columnType: string;
  exactFilters?: Record<string, string | number | boolean>;
  rangeFilters?: Record<string, RangeFilter>;
  topN?: number;
  bins?: number;
}
