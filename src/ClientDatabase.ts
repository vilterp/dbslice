import { Database } from './database';
import { 
  Table, 
  Column, 
  Query, 
  HistogramQuery, 
  TableDataResponse, 
  HistogramResult 
} from './types';

export class ClientDatabase implements Database {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  async getTables(): Promise<Table[]> {
    const response = await fetch(`${this.baseUrl}/api/tables`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tables: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async getColumns(tableName: string): Promise<Column[]> {
    const response = await fetch(`${this.baseUrl}/api/tables/${tableName}/columns`);
    if (!response.ok) {
      throw new Error(`Failed to fetch columns: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async getTableData(query: Query): Promise<TableDataResponse> {
    const body: any = { 
      filters: query.filters,
      steps: query.steps || [],
      limit: query.limit || 100 
    };
    if (query.orderBy && query.orderDir) {
      body.orderBy = query.orderBy;
      body.orderDir = query.orderDir === 'ASC' ? 'asc' : 'desc';
    }

    const response = await fetch(`${this.baseUrl}/api/tables/${query.tableName}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch table data: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async getHistogram(histogramQuery: HistogramQuery): Promise<HistogramResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tables/${histogramQuery.tableName}/columns/${histogramQuery.columnName}/histogram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bins: histogramQuery.bins || 20,
          column_type: histogramQuery.columnType,
          filters: histogramQuery.filters,
          steps: histogramQuery.steps || [],
          top_n: histogramQuery.topN || 5,
        }),
      });
      
      if (!response.ok) {
        return { 
          data: [], 
          error: `HTTP ${response.status}: ${response.statusText}` 
        };
      }
      
      const data = await response.json();
      if (data.error) {
        return { 
          data: [], 
          error: data.error 
        };
      }
      
      const histogramData = Array.isArray(data) ? data : [];
      return { 
        data: histogramData, 
        isEmpty: histogramData.length === 0 
      };
    } catch (error) {
      return { 
        data: [], 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async getInfo(): Promise<{
    database: {
      path?: string;
      type?: string;
      tables: number;
    };
    config: {
      maxRows: number;
      maxHistogramBins?: number;
    };
  }> {
    const response = await fetch(`${this.baseUrl}/api/info`);
    if (!response.ok) {
      throw new Error(`Failed to fetch info: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
}