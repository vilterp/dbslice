// urlState.ts
// Handles reading and writing app state to the URL (all tabs and selected tab)

import { Query } from '../../src/types';

// Interface for tab state that we store in the URL
export interface TabUrlState {
  id: string;
  name?: string;
  query: Query;
}

export interface AppUrlState {
  tabs: TabUrlState[];
  selectedTabId?: string;
}

// Pure function to convert app state to URL string
export function appStateToUrl(baseUrl: string, state: AppUrlState): string {
  const url = new URL(baseUrl);
  
  if (state.tabs.length > 0) {
    const stateJson = JSON.stringify(state);
    url.searchParams.set('state', btoa(stateJson)); // base64 encode to make URL cleaner
  } else {
    url.searchParams.delete('state');
  }
  
  // Clean up old query params if they exist
  const keysToDelete = Array.from(url.searchParams.keys()).filter(key => 
    key.startsWith('filter_') || key.startsWith('step_') || key === 'table' || key === 'sort' || key === 'dir'
  );
  keysToDelete.forEach(key => url.searchParams.delete(key));

  return url.toString();
}

// Pure function to extract app state from URL string
export function urlToAppState(urlString: string): AppUrlState | null {
  const url = new URL(urlString);
  const stateParam = url.searchParams.get('state');
  
  if (!stateParam) {
    return null;
  }
  
  try {
    const stateJson = atob(stateParam); // base64 decode
    const state = JSON.parse(stateJson) as AppUrlState;
    return state;
  } catch (error) {
    console.warn('Failed to parse state from URL:', error);
    return null;
  }
}

// Legacy function to extract single query from URL (for backward compatibility with tests)
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
  const filters: any[] = [];
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
  const steps: any[] = [];
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
export function updateURL(state: AppUrlState, replace: boolean = false) {
  const newUrl = appStateToUrl(window.location.href, state);
  if (replace) {
    window.history.replaceState(state, '', newUrl);
  } else {
    window.history.pushState(state, '', newUrl);
  }
}
