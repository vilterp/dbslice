export type SortDirection = 'asc' | 'desc' | '';

export interface Table {
  table_name: string;
}

export interface Column {
  column_name: string;
  data_type: string;
}

export interface HistogramData {
  [key: string]: any;
  count: number;
  bin_start?: number;
  bin_end?: number;
  bin_num?: number;
  is_others?: boolean;
}

export interface TableDataResponse {
  data: any[];
  total: number;
}

export interface Filter {
  column: string;
  value: string;
  type?: 'exact' | 'range';
  min?: number;
  max?: number;
}

export async function fetchTables(): Promise<Table[]> {
  const response = await fetch('http://localhost:3001/api/tables');
  return response.json();
}

export async function fetchColumns(selectedTable: string): Promise<Column[]> {
  const url = `http://localhost:3001/api/tables/${selectedTable}/columns`;
  const response = await fetch(url);
  return response.json();
}

export async function fetchTableData(
  selectedTable: string,
  filters: Filter[],
  sortColumn: string,
  sortDirection: SortDirection
): Promise<TableDataResponse> {
  const exactFilters = filters.reduce((acc, filter) => {
    if (filter.type === 'exact' || !filter.type) {
      acc[filter.column] = filter.value;
    }
    return acc;
  }, {} as { [key: string]: string });

  const rangeFilters = filters.reduce((acc, filter) => {
    if (filter.type === 'range' && filter.min !== undefined && filter.max !== undefined) {
      acc[filter.column] = { min: filter.min, max: filter.max };
    }
    return acc;
  }, {} as { [key: string]: { min: number; max: number } });

  const body: any = { 
    filters: exactFilters, 
    rangeFilters: rangeFilters,
    limit: 100 
  };
  if (sortColumn && sortDirection) {
    body.orderBy = sortColumn;
    body.orderDir = sortDirection;
  }

  const response = await fetch(`http://localhost:3001/api/tables/${selectedTable}/data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return response.json();
}

export async function fetchHistograms(
  selectedTable: string,
  columns: Column[],
  filters: Filter[]
): Promise<{ [key: string]: HistogramData[] }> {
  if (columns.length === 0) return {};
  const exactFilters = filters.reduce((acc, filter) => {
    if (filter.type === 'exact' || !filter.type) {
      acc[filter.column] = filter.value;
    }
    return acc;
  }, {} as { [key: string]: string });

  const rangeFilters = filters.reduce((acc, filter) => {
    if (filter.type === 'range' && filter.min !== undefined && filter.max !== undefined) {
      acc[filter.column] = `${filter.min}-${filter.max}`;
    }
    return acc;
  }, {} as { [key: string]: string });

  const histogramPromises = columns.map(async (column) => {
    const params = new URLSearchParams({
      bins: '10',
      column_type: column.data_type,
      ...exactFilters,
      ...rangeFilters,
    });
    const url = `http://localhost:3001/api/tables/${selectedTable}/columns/${column.column_name}/histogram?${params}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
      return { column: column.column_name, data: [] };
    }
    const histogramData = Array.isArray(data) ? data : [];
    return { column: column.column_name, data: histogramData };
  });

  const results = await Promise.all(histogramPromises);
  return results.reduce((acc, result) => {
    acc[result.column] = result.data;
    return acc;
  }, {} as { [key: string]: HistogramData[] });
}
