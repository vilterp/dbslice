// urlState.ts
// Handles reading and writing app state to the URL (table, filters, sorting)

import { Filter, QueryStep } from '../../src/types';
import { SortDirection } from './api';

export function updateURL(
  table: string,
  filters: Filter[],
  sortCol: string,
  sortDir: SortDirection,
  steps: QueryStep[] = []
) {
  const url = new URL(window.location.href);

  if (table) {
    url.searchParams.set('table', table);
  } else {
    url.searchParams.delete('table');
  }

  // Clear existing filter and step params
  const keysToDelete = Array.from(url.searchParams.keys()).filter(key => 
    key.startsWith('filter_') || key.startsWith('step_')
  );
  keysToDelete.forEach(key => url.searchParams.delete(key));

  // Add current steps
  steps.forEach((step, index) => {
    const stepData = {
      name: step.name,
      tableName: step.tableName,
      filters: step.filters
    };
    url.searchParams.set(`step_${index}`, encodeURIComponent(JSON.stringify(stepData)));
  });

  // Add current filters
  filters.forEach((filter) => {
    let filterData: string;
    if (filter.type === 'range') {
      filterData = `:${filter.type}:${filter.min}:${filter.max}`;
    } else if (filter.type === 'in') {
      filterData = `:${filter.type}:${filter.stepName}`;
    } else {
      filterData = `${filter.value}:${filter.type}`;
    }
    url.searchParams.set(`filter_${filter.column}`, filterData);
  });

  // Remove old sort params
  url.searchParams.delete('sort');
  url.searchParams.delete('dir');
  // Add sort params if set
  if (sortCol && sortDir) {
    url.searchParams.set('sort', sortCol);
    url.searchParams.set('dir', sortDir);
  }
  window.history.replaceState({}, '', url.toString());
}

export function loadFromURL(
  tables: { table_name: string }[],
  setSelectedTable: (t: string) => void,
  setFilters: (f: Filter[]) => void,
  setSortColumn: (c: string) => void,
  setSortDirection: (d: SortDirection) => void
) {
  const url = new URL(window.location.href);
  const tableFromURL = url.searchParams.get('table');

  if (tableFromURL && tables.some(table => table.table_name === tableFromURL)) {
    setSelectedTable(tableFromURL);
  }

  // Load filters from URL
  const urlFilters: Filter[] = [];
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith('filter_')) {
      const column = key.replace('filter_', '');
      const [filterValue, type = 'exact', min, max] = value.split(':');
      
      if (type === 'range' && min && max) {
        urlFilters.push({
          type: 'range',
          column,
          min: parseFloat(min),
          max: parseFloat(max)
        });
      } else {
        urlFilters.push({
          type: 'exact',
          column,
          value: filterValue
        });
      }
    }
  }

  if (urlFilters.length > 0) {
    setFilters(urlFilters);
  }
  // Load sort from URL
  const sortCol = url.searchParams.get('sort') || '';
  const sortDir = (url.searchParams.get('dir') as SortDirection) || '';
  if (sortCol && sortDir) {
    setSortColumn(sortCol);
    setSortDirection(sortDir);
  }
}
