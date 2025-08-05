import { 
  Filter, 
  Query,
  SortDirection, 
  Table, 
  Column, 
  HistogramData, 
  HistogramResult, 
  TableDataResponse 
} from '../../src/types';

// Re-export for client components
export type { Filter, SortDirection, Table, Column, HistogramData, HistogramResult, TableDataResponse };

// Configuration constants
const DEFAULT_TOP_N_CATEGORIES = 5;
const DEFAULT_HISTOGRAM_BINS = 20;


export async function fetchTables(): Promise<Table[]> {
  const response = await fetch('http://localhost:3001/api/tables');
  if (!response.ok) {
    throw new Error(`Failed to fetch tables: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function fetchColumns(selectedTable: string): Promise<Column[]> {
  const url = `http://localhost:3001/api/tables/${selectedTable}/columns`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch columns: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function fetchTableData(query: Query): Promise<TableDataResponse> {
  const body: any = { 
    filters: query.filters,
    steps: query.steps || [],
    limit: query.limit || 100 
  };
  if (query.orderBy && query.orderDir) {
    body.orderBy = query.orderBy;
    body.orderDir = query.orderDir === 'ASC' ? 'asc' : 'desc';
  }

  const response = await fetch(`http://localhost:3001/api/tables/${query.tableName}/data`, {
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

// Individual histogram fetch function for single column - can be used by individual components
export async function fetchHistogram(
  selectedTable: string,
  column: Column,
  filters: Filter[]
): Promise<HistogramResult> {
  const exactFilters = filters.reduce((acc, filter) => {
    if (filter.type === 'exact') {
      acc[filter.column] = filter.value;
    }
    return acc;
  }, {} as { [key: string]: string });

  const rangeFilters = filters.reduce((acc, filter) => {
    if (filter.type === 'range') {
      acc[filter.column] = { min: filter.min, max: filter.max };
    }
    return acc;
  }, {} as { [key: string]: { min: number; max: number } });

  try {
    const response = await fetch(`http://localhost:3001/api/tables/${selectedTable}/columns/${column.column_name}/histogram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bins: DEFAULT_HISTOGRAM_BINS,
        column_type: column.data_type,
        filters: exactFilters,
        rangeFilters: rangeFilters,
        top_n: DEFAULT_TOP_N_CATEGORIES, // Number of top categories to show for discrete histograms
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

