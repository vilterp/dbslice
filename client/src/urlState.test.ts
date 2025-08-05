import { queryStateToUrl, urlToQueryState, QueryState } from './urlState';
import { Filter, QueryStep } from '../../src/types';
import { SortDirection } from './api';

describe('urlState pure functions', () => {
  const baseUrl = 'http://localhost:3000/';

  describe('queryStateToUrl', () => {
    it('should set table parameter in URL', () => {
      const state: QueryState = {
        table: 'products',
        filters: [],
        sortCol: '',
        sortDir: '' as SortDirection,
        steps: []
      };

      const result = queryStateToUrl(baseUrl, state);
      expect(result).toContain('table=products');
    });

    it('should set sort parameters in URL', () => {
      const state: QueryState = {
        table: 'products',
        filters: [],
        sortCol: 'name',
        sortDir: 'asc',
        steps: []
      };

      const result = queryStateToUrl(baseUrl, state);
      expect(result).toContain('sort=name');
      expect(result).toContain('dir=asc');
    });

    it('should encode exact filters correctly', () => {
      const state: QueryState = {
        table: 'products',
        filters: [
          { type: 'exact', column: 'category', value: 'electronics' }
        ],
        sortCol: '',
        sortDir: '' as SortDirection,
        steps: []
      };

      const result = queryStateToUrl(baseUrl, state);
      expect(result).toContain('filter_category=electronics%3Aexact');
    });

    it('should encode range filters correctly', () => {
      const state: QueryState = {
        table: 'products',
        filters: [
          { type: 'range', column: 'price', min: 10, max: 100 }
        ],
        sortCol: '',
        sortDir: '' as SortDirection,
        steps: []
      };

      const result = queryStateToUrl(baseUrl, state);
      expect(result).toContain('filter_price=%3Arange%3A10%3A100');
    });

    it('should encode in filters correctly', () => {
      const state: QueryState = {
        table: 'products',
        filters: [
          { type: 'in', column: 'category_id', stepName: 'categories', stepColumn: 'id' }
        ],
        sortCol: '',
        sortDir: '' as SortDirection,
        steps: []
      };

      const result = queryStateToUrl(baseUrl, state);
      expect(result).toContain('filter_category_id=%3Ain%3Acategories%3Aid');
    });

    it('should encode steps correctly', () => {
      const steps: QueryStep[] = [
        {
          name: 'expensive_products',
          tableName: 'products',
          filters: [{ type: 'range', column: 'price', min: 100, max: 1000 }]
        }
      ];

      const state: QueryState = {
        table: 'orders',
        filters: [],
        sortCol: '',
        sortDir: '' as SortDirection,
        steps
      };

      const result = queryStateToUrl(baseUrl, state);
      expect(result).toContain('step_0=');
      
      // Decode the step to verify it's correct
      const url = new URL(result);
      const stepParam = url.searchParams.get('step_0');
      expect(stepParam).toBeTruthy();
      const stepData = JSON.parse(decodeURIComponent(stepParam!));
      expect(stepData.name).toBe('expensive_products');
      expect(stepData.tableName).toBe('products');
      expect(stepData.filters).toEqual([{ type: 'range', column: 'price', min: 100, max: 1000 }]);
    });

    it('should clear existing filter and step params', () => {
      const urlWithExistingParams = 'http://localhost:3000/?table=old&filter_old=value&step_0=old';
      const state: QueryState = {
        table: 'new_table',
        filters: [{ type: 'exact', column: 'new_col', value: 'new_value' }],
        sortCol: '',
        sortDir: '' as SortDirection,
        steps: []
      };

      const result = queryStateToUrl(urlWithExistingParams, state);
      expect(result).not.toContain('filter_old=value');
      expect(result).not.toContain('step_0=old');
      expect(result).toContain('table=new_table');
      expect(result).toContain('filter_new_col=new_value%3Aexact');
    });
  });

  describe('urlToQueryState', () => {
    it('should extract table from URL', () => {
      const url = 'http://localhost:3000/?table=products';
      const state = urlToQueryState(url);
      expect(state.table).toBe('products');
    });

    it('should extract sort parameters from URL', () => {
      const url = 'http://localhost:3000/?sort=name&dir=desc';
      const state = urlToQueryState(url);
      expect(state.sortCol).toBe('name');
      expect(state.sortDir).toBe('desc');
    });

    it('should extract exact filters from URL', () => {
      const url = 'http://localhost:3000/?filter_category=electronics%3Aexact';
      const state = urlToQueryState(url);
      expect(state.filters).toEqual([
        { type: 'exact', column: 'category', value: 'electronics' }
      ]);
    });

    it('should extract range filters from URL', () => {
      const url = 'http://localhost:3000/?filter_price=%3Arange%3A10%3A100';
      const state = urlToQueryState(url);
      expect(state.filters).toEqual([
        { type: 'range', column: 'price', min: 10, max: 100 }
      ]);
    });

    it('should extract in filters from URL', () => {
      const url = 'http://localhost:3000/?filter_category_id=%3Ain%3Acategories%3Aid';
      const state = urlToQueryState(url);
      expect(state.filters).toEqual([
        { type: 'in', column: 'category_id', stepName: 'categories', stepColumn: 'id' }
      ]);
    });

    it('should extract steps from URL', () => {
      const stepData = {
        name: 'expensive_products',
        tableName: 'products',
        filters: [{ type: 'range', column: 'price', min: 100, max: 1000 }]
      };
      const encodedStep = encodeURIComponent(JSON.stringify(stepData));
      const url = `http://localhost:3000/?step_0=${encodedStep}`;
      
      const state = urlToQueryState(url);
      expect(state.steps).toEqual([stepData]);
    });

    it('should handle malformed step data gracefully', () => {
      const url = 'http://localhost:3000/?step_0=invalid_json';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const state = urlToQueryState(url);
      expect(state.steps).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse step data:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('round-trip functionality', () => {
    it('should round-trip simple state correctly', () => {
      const originalState: QueryState = {
        table: 'products',
        filters: [
          { type: 'exact', column: 'category', value: 'electronics' },
          { type: 'range', column: 'price', min: 10, max: 100 }
        ],
        sortCol: 'name',
        sortDir: 'asc',
        steps: []
      };

      const url = queryStateToUrl(baseUrl, originalState);
      const roundTripState = urlToQueryState(url);

      expect(roundTripState.table).toBe(originalState.table);
      expect(roundTripState.filters).toEqual(originalState.filters);
      expect(roundTripState.sortCol).toBe(originalState.sortCol);
      expect(roundTripState.sortDir).toBe(originalState.sortDir);
      // Empty steps array is not returned by urlToQueryState
      expect(roundTripState.steps).toBeUndefined();
    });

    it('should round-trip complex state with steps correctly', () => {
      const originalState: QueryState = {
        table: 'orders',
        filters: [
          { type: 'in', column: 'product_id', stepName: 'expensive_products', stepColumn: 'id' }
        ],
        sortCol: 'order_date',
        sortDir: 'desc',
        steps: [
          {
            name: 'expensive_products',
            tableName: 'products',
            filters: [
              { type: 'range', column: 'price', min: 100, max: 1000 },
              { type: 'exact', column: 'category', value: 'electronics' }
            ]
          },
          {
            name: 'recent_orders',
            tableName: 'orders',
            filters: [
              { type: 'exact', column: 'status', value: 'completed' }
            ]
          }
        ]
      };

      const url = queryStateToUrl(baseUrl, originalState);
      const roundTripState = urlToQueryState(url);

      expect(roundTripState.table).toBe(originalState.table);
      expect(roundTripState.filters).toEqual(originalState.filters);
      expect(roundTripState.sortCol).toBe(originalState.sortCol);
      expect(roundTripState.sortDir).toBe(originalState.sortDir);
      expect(roundTripState.steps).toEqual(originalState.steps);
    });

    it('should handle empty state correctly', () => {
      const originalState: QueryState = {
        table: '',
        filters: [],
        sortCol: '',
        sortDir: '' as SortDirection,
        steps: []
      };

      const url = queryStateToUrl(baseUrl, originalState);
      const roundTripState = urlToQueryState(url);

      // Empty values should not be set in the state
      expect(roundTripState.table).toBeUndefined();
      expect(roundTripState.filters).toBeUndefined();
      expect(roundTripState.sortCol).toBeUndefined();
      expect(roundTripState.sortDir).toBeUndefined();
      expect(roundTripState.steps).toBeUndefined();
    });

    it('should preserve URL parameters that are not related to query state', () => {
      const baseUrlWithParams = 'http://localhost:3000/?other_param=value&keep_me=true';
      const state: QueryState = {
        table: 'products',
        filters: [],
        sortCol: '',
        sortDir: '' as SortDirection,
        steps: []
      };

      const result = queryStateToUrl(baseUrlWithParams, state);
      expect(result).toContain('other_param=value');
      expect(result).toContain('keep_me=true');
      expect(result).toContain('table=products');
    });
  });
});
