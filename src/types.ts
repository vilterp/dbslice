// Shared types between frontend and backend

// Query types (highest level)
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

export interface BaseQuery {
  tableName: string;
  filters: Filter[];
}

// Filter types
export type Filter = ExactFilter | RangeFilter;

export interface ExactFilter {
  type: 'exact';
  column: string;
  value: string;
}

export interface RangeFilter {
  type: 'range';
  column: string;
  min: number;
  max: number;
}

// API data types
export interface TableDataResponse {
  data: any[];
  total: number;
}

export interface HistogramResult {
  data: HistogramData[];
  error?: string;
  isEmpty?: boolean;
}

export interface HistogramData {
  [key: string]: any;
  count: number;
  bin_start?: number;
  bin_end?: number;
  bin_num?: number;
  is_others?: boolean;
}

export interface Table {
  table_name: string;
}

export interface Column {
  column_name: string;
  data_type: string;
  no_histogram?: boolean;
}

// Basic types
export type SortDirection = 'asc' | 'desc' | '';

// Constants
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