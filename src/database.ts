import { 
  Table, 
  Column, 
  Query, 
  HistogramQuery, 
  TableDataResponse, 
  HistogramResult 
} from './types';

export interface DatabaseInfo {
  database: {
    path?: string;
    type?: string;
    tables: number;
  };
  config: {
    maxRows: number;
    maxHistogramBins?: number;
  };
}

export interface Database {
  getTables(): Promise<Table[]>;
  getColumns(tableName: string): Promise<Column[]>;
  getTableData(query: Query): Promise<TableDataResponse>;
  getHistogram(histogramQuery: HistogramQuery): Promise<HistogramResult>;
  getInfo(): Promise<DatabaseInfo>;
}