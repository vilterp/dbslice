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

// API types shared between client and server
export type SortDirection = 'asc' | 'desc' | '';

export interface Table {
  table_name: string;
}

export interface Column {
  column_name: string;
  data_type: string;
  no_histogram?: boolean;
}

export interface HistogramData {
  [key: string]: any;
  count: number;
  bin_start?: number;
  bin_end?: number;
  bin_num?: number;
  is_others?: boolean;
}

export interface HistogramResult {
  data: HistogramData[];
  error?: string;
  isEmpty?: boolean;
}

export interface TableDataResponse {
  data: any[];
  total: number;
}
