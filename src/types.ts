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
  steps?: QueryStep[];
}

// Query step type for CTE support
export interface QueryStep {
  name: string;
  tableName: string;
  filters: Filter[];
  selectColumn?: string; // Column to select for joining, defaults to * if not specified
}

// Filter types
export type Filter = ExactFilter | RangeFilter | InFilter;

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

export interface InFilter {
  type: 'in';
  column: string;
  stepName: string;
  stepColumn: string;
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
  foreign_key?: ForeignKeyInfo;
  reverse_foreign_keys?: ReverseForeignKeyInfo[];
}

export interface ForeignKeyInfo {
  referenced_table: string;
  referenced_column: string;
  // For composite foreign keys
  all_columns?: string[];  // All columns in this table that are part of the FK
  all_referenced_columns?: string[];  // All columns in referenced table
}

export interface ReverseForeignKeyInfo {
  source_table: string;
  source_column: string;
  // For composite foreign keys
  all_source_columns?: string[];  // All columns in source table
  all_referenced_columns?: string[];  // All columns in this table
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