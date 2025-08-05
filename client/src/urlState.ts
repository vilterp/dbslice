// urlState.ts
// Handles reading and writing app state to the URL (table, filters, sorting)

import { Filter, QueryStep } from '../../src/types';
import { SortDirection } from './api';

export interface QueryState {
  table: string;
  filters: Filter[];
  sortCol: string;
  sortDir: SortDirection;
  steps: QueryStep[];
}

// Pure function to convert query state to URL string
export function queryStateToUrl(baseUrl: string, state: QueryState): string {
  const url = new URL(baseUrl);
  
  // Clear existing filter and step params
  const keysToDelete = Array.from(url.searchParams.keys()).filter(key => 
    key.startsWith('filter_') || key.startsWith('step_')
  );
  keysToDelete.forEach(key => url.searchParams.delete(key));

  if (state.table) {
    url.searchParams.set('table', state.table);
  } else {
    url.searchParams.delete('table');
  }

  // Add current steps
  state.steps.forEach((step, index) => {
    const stepData = {
      name: step.name,
      tableName: step.tableName,
      filters: step.filters
    };
    url.searchParams.set(`step_${index}`, encodeURIComponent(JSON.stringify(stepData)));
  });

  // Add current filters
  state.filters.forEach((filter) => {
    let filterData: string;
    if (filter.type === 'range') {
      filterData = `:${filter.type}:${filter.min}:${filter.max}`;
    } else if (filter.type === 'in') {
      filterData = `:${filter.type}:${filter.stepName}:${filter.stepColumn}`;
    } else {
      filterData = `${filter.value}:${filter.type}`;
    }
    url.searchParams.set(`filter_${filter.column}`, filterData);
  });

  // Remove old sort params
  url.searchParams.delete('sort');
  url.searchParams.delete('dir');
  // Add sort params if set
  if (state.sortCol && state.sortDir) {
    url.searchParams.set('sort', state.sortCol);
    url.searchParams.set('dir', state.sortDir);
  }

  return url.toString();
}

// Pure function to extract query state from URL string
export function urlToQueryState(urlString: string): Partial<QueryState> {
  const url = new URL(urlString);
  const state: Partial<QueryState> = {};

  // Extract table
  const table = url.searchParams.get('table');
  if (table) {
    state.table = table;
  }

  // Extract filters
  const filters: Filter[] = [];
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith('filter_')) {
      const column = key.replace('filter_', '');
      const [filterValue, type = 'exact', min, max] = value.split(':');
      
      if (type === 'range' && min && max) {
        filters.push({
          type: 'range',
          column,
          min: parseFloat(min),
          max: parseFloat(max)
        });
      } else if (type === 'in' && min && max) {
        filters.push({
          type: 'in',
          column,
          stepName: min,
          stepColumn: max
        });
      } else {
        filters.push({
          type: 'exact',
          column,
          value: filterValue
        });
      }
    }
  }
  if (filters.length > 0) {
    state.filters = filters;
  }

  // Extract steps
  const steps: QueryStep[] = [];
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith('step_')) {
      try {
        const stepData = JSON.parse(decodeURIComponent(value));
        steps.push(stepData);
      } catch (error) {
        console.warn('Failed to parse step data:', error);
      }
    }
  }
  if (steps.length > 0) {
    state.steps = steps;
  }

  // Extract sort
  const sortCol = url.searchParams.get('sort');
  const sortDir = url.searchParams.get('dir') as SortDirection;
  if (sortCol && sortDir) {
    state.sortCol = sortCol;
    state.sortDir = sortDir;
  }

  return state;
}

// Wrapper functions for browser usage
export function updateURL(state: QueryState) {
  const newUrl = queryStateToUrl(window.location.href, state);
  window.history.replaceState({}, '', newUrl);
}

export function loadFromURL(
  tables: { table_name: string }[],
  setSelectedTable: (t: string) => void,
  setFilters: (f: Filter[]) => void,
  setSortColumn: (c: string) => void,
  setSortDirection: (d: SortDirection) => void
) {
  const state = urlToQueryState(window.location.href);

  if (state.table && tables.some(table => table.table_name === state.table)) {
    setSelectedTable(state.table);
  }

  if (state.filters) {
    setFilters(state.filters);
  }

  if (state.sortCol && state.sortDir) {
    setSortColumn(state.sortCol);
    setSortDirection(state.sortDir);
  }
}
