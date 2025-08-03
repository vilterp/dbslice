// urlState.ts
// Handles reading and writing app state to the URL (table, filters, sorting)

import { Filter } from '../../src/common';
import { SortDirection } from './api';

export function updateURL(
  table: string,
  filters: Filter[],
  sortCol: string,
  sortDir: SortDirection
) {
  const url = new URL(window.location.href);

  if (table) {
    url.searchParams.set('table', table);
  } else {
    url.searchParams.delete('table');
  }

  // Clear existing filter params
  const keysToDelete = Array.from(url.searchParams.keys()).filter(key => key.startsWith('filter_'));
  keysToDelete.forEach(key => url.searchParams.delete(key));

  // Add current filters
  filters.forEach((filter) => {
    const filterData = filter.type === 'range' ? 
      `:${filter.type}:${filter.min}:${filter.max}` : 
      `${filter.value}:${filter.type}`;
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
      urlFilters.push({
        column,
        value: filterValue,
        type: type as 'exact' | 'range',
        min: min ? parseFloat(min) : undefined,
        max: max ? parseFloat(max) : undefined
      });
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
