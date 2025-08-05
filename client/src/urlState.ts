// urlState.ts
// Handles reading and writing app state to the URL (table, filters, sorting)

import { Filter, QueryStep, Query } from '../../src/types';
import { SortDirection } from './api';

// Pure function to convert query to URL string
export function queryToUrl(baseUrl: string, query: Query): string {
  const url = new URL(baseUrl);
  
  // Clear existing filter and step params
  const keysToDelete = Array.from(url.searchParams.keys()).filter(key => 
    key.startsWith('filter_') || key.startsWith('step_')
  );
  keysToDelete.forEach(key => url.searchParams.delete(key));

  if (query.tableName) {
    url.searchParams.set('table', query.tableName);
  } else {
    url.searchParams.delete('table');
  }

  // Add current steps
  (query.steps || []).forEach((step, index) => {
    const stepData = {
      name: step.name,
      tableName: step.tableName,
      filters: step.filters
    };
    url.searchParams.set(`step_${index}`, encodeURIComponent(JSON.stringify(stepData)));
  });

  // Add current filters
  query.filters.forEach((filter) => {
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
  if (query.orderBy && query.orderDir) {
    url.searchParams.set('sort', query.orderBy);
    url.searchParams.set('dir', query.orderDir === 'ASC' ? 'asc' : 'desc');
  }

  return url.toString();
}

// Pure function to extract query from URL string
export function urlToQuery(urlString: string): Partial<Query> {
  const url = new URL(urlString);
  const query: Partial<Query> = {
    // Always provide filters array (required by BaseQuery)
    filters: []
  };

  // Extract table - only set if present in URL
  const table = url.searchParams.get('table');
  if (table) {
    query.tableName = table;
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
      } else if (filterValue && filterValue.trim() !== '') {
        // Only add exact filters if the value is not empty
        filters.push({
          type: 'exact',
          column,
          value: filterValue
        });
      }
    }
  }
  // Always set filters array (even if empty)
  query.filters = filters;

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
    query.steps = steps;
  }

  // Extract sort
  const sortCol = url.searchParams.get('sort');
  const sortDir = url.searchParams.get('dir');
  if (sortCol && sortDir) {
    query.orderBy = sortCol;
    query.orderDir = sortDir === 'asc' ? 'ASC' : 'DESC';
  }

  return query;
}

// Wrapper functions for browser usage
export function updateURL(query: Query) {
  const newUrl = queryToUrl(window.location.href, query);
  window.history.replaceState({}, '', newUrl);
}
