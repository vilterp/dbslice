import { queryToUrl, urlToQuery } from './urlState';
import { Filter, QueryStep, Query } from '../../src/types';
import { SortDirection } from './api';

describe('urlState pure functions', () => {
  const baseUrl = 'http://localhost:3000/';

  describe('queryToUrl', () => {
    it('should set table parameter in URL', () => {
      const query: Query = {
        tableName: 'products',
        filters: []
      };

      const result = queryToUrl(baseUrl, query);
      expect(result).toContain('table=products');
    });

    it('should set sort parameters in URL', () => {
      const query: Query = {
        tableName: 'products',
        filters: [],
        orderBy: 'name',
        orderDir: 'ASC'
      };

      const result = queryToUrl(baseUrl, query);
      expect(result).toContain('sort=name');
      expect(result).toContain('dir=asc');
    });

    it('should encode exact filters correctly', () => {
      const query: Query = {
        tableName: 'products',
        filters: [
          { type: 'exact', column: 'category', value: 'electronics' }
        ]
      };

      const result = queryToUrl(baseUrl, query);
      expect(result).toContain('filter_category=electronics%3Aexact');
    });

    it('should encode range filters correctly', () => {
      const query: Query = {
        tableName: 'products',
        filters: [
          { type: 'range', column: 'price', min: 10, max: 100 }
        ]
      };

      const result = queryToUrl(baseUrl, query);
      expect(result).toContain('filter_price=%3Arange%3A10%3A100');
    });

    it('should encode in filters correctly', () => {
      const query: Query = {
        tableName: 'products',
        filters: [
          { type: 'in', column: 'category_id', stepName: 'categories', stepColumn: 'id' }
        ]
      };

      const result = queryToUrl(baseUrl, query);
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

      const query: Query = {
        tableName: 'orders',
        filters: [],
        steps
      };

      const result = queryToUrl(baseUrl, query);
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
      const query: Query = {
        tableName: 'new_table',
        filters: [{ type: 'exact', column: 'new_col', value: 'new_value' }]
      };

      const result = queryToUrl(urlWithExistingParams, query);
      expect(result).not.toContain('filter_old=value');
      expect(result).not.toContain('step_0=old');
      expect(result).toContain('table=new_table');
      expect(result).toContain('filter_new_col=new_value%3Aexact');
    });
  });

  describe('urlToQuery', () => {
    it('should extract table from URL', () => {
      const url = 'http://localhost:3000/?table=products';
      const query = urlToQuery(url);
      expect(query.tableName).toBe('products');
    });

    it('should extract sort parameters from URL', () => {
      const url = 'http://localhost:3000/?sort=name&dir=desc';
      const query = urlToQuery(url);
      expect(query.orderBy).toBe('name');
      expect(query.orderDir).toBe('DESC');
    });

    it('should extract exact filters from URL', () => {
      const url = 'http://localhost:3000/?filter_category=electronics%3Aexact';
      const query = urlToQuery(url);
      expect(query.filters).toEqual([
        { type: 'exact', column: 'category', value: 'electronics' }
      ]);
    });

    it('should extract range filters from URL', () => {
      const url = 'http://localhost:3000/?filter_price=%3Arange%3A10%3A100';
      const query = urlToQuery(url);
      expect(query.filters).toEqual([
        { type: 'range', column: 'price', min: 10, max: 100 }
      ]);
    });

    it('should extract in filters from URL', () => {
      const url = 'http://localhost:3000/?filter_category_id=%3Ain%3Acategories%3Aid';
      const query = urlToQuery(url);
      expect(query.filters).toEqual([
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
      
      const query = urlToQuery(url);
      expect(query.steps).toEqual([stepData]);
    });

    it('should handle malformed step data gracefully', () => {
      const url = 'http://localhost:3000/?step_0=invalid_json';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const query = urlToQuery(url);
      expect(query.steps).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse step data:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should skip filters with empty values', () => {
      const url = 'http://localhost:3000/?filter_category=electronics%3Aexact&filter_empty=%3Aexact&filter_whitespace=%20%3Aexact';
      const query = urlToQuery(url);
      expect(query.filters).toEqual([
        { type: 'exact', column: 'category', value: 'electronics' }
      ]);
    });

    it('should handle the problematic URL case correctly', () => {
      const url = 'http://localhost:3002/?table=orders&step_0=%257B%2522name%2522%253A%2522customer_filtered%2522%252C%2522tableName%2522%253A%2522customer%2522%252C%2522filters%2522%253A%255B%257B%2522type%2522%253A%2522exact%2522%252C%2522column%2522%253A%2522c_custkey%2522%252C%2522value%2522%253A%25222%2522%257D%255D%257D&filter_o_custkey=%3Aexact';
      const query = urlToQuery(url);
      
      expect(query.tableName).toBe('orders');
      expect(query.filters).toEqual([]); // Should be empty because the filter value is empty
      expect(query.steps).toHaveLength(1);
      expect(query.steps![0].name).toBe('customer_filtered');
      expect(query.steps![0].tableName).toBe('customer');
      expect(query.steps![0].filters).toEqual([
        { type: 'exact', column: 'c_custkey', value: '2' }
      ]);
    });
  });

  describe('round-trip functionality', () => {
    it('should round-trip simple state correctly', () => {
      const originalQuery: Query = {
        tableName: 'products',
        filters: [
          { type: 'exact', column: 'category', value: 'electronics' },
          { type: 'range', column: 'price', min: 10, max: 100 }
        ],
        orderBy: 'name',
        orderDir: 'ASC'
      };

      const url = queryToUrl(baseUrl, originalQuery);
      const roundTripQuery = urlToQuery(url);

      expect(roundTripQuery.tableName).toBe(originalQuery.tableName);
      expect(roundTripQuery.filters).toEqual(originalQuery.filters);
      expect(roundTripQuery.orderBy).toBe(originalQuery.orderBy);
      expect(roundTripQuery.orderDir).toBe(originalQuery.orderDir);
      // Empty steps array is not returned by urlToQuery
      expect(roundTripQuery.steps).toBeUndefined();
    });

    it('should round-trip complex state with steps correctly', () => {
      const originalQuery: Query = {
        tableName: 'orders',
        filters: [
          { type: 'in', column: 'product_id', stepName: 'expensive_products', stepColumn: 'id' }
        ],
        orderBy: 'order_date',
        orderDir: 'DESC',
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

      const url = queryToUrl(baseUrl, originalQuery);
      const roundTripQuery = urlToQuery(url);

      expect(roundTripQuery.tableName).toBe(originalQuery.tableName);
      expect(roundTripQuery.filters).toEqual(originalQuery.filters);
      expect(roundTripQuery.orderBy).toBe(originalQuery.orderBy);
      expect(roundTripQuery.orderDir).toBe(originalQuery.orderDir);
      expect(roundTripQuery.steps).toEqual(originalQuery.steps);
    });

    it('should handle empty state correctly', () => {
      const originalQuery: Query = {
        tableName: '',
        filters: []
      };

      const url = queryToUrl(baseUrl, originalQuery);
      const roundTripQuery = urlToQuery(url);

      // Empty tableName should not be set in the query
      expect(roundTripQuery.tableName).toBeUndefined();
      expect(roundTripQuery.filters).toEqual([]);
      expect(roundTripQuery.orderBy).toBeUndefined();
      expect(roundTripQuery.orderDir).toBeUndefined();
      expect(roundTripQuery.steps).toBeUndefined();
    });

    it('should preserve URL parameters that are not related to query state', () => {
      const baseUrlWithParams = 'http://localhost:3000/?other_param=value&keep_me=true';
      const query: Query = {
        tableName: 'products',
        filters: []
      };

      const result = queryToUrl(baseUrlWithParams, query);
      expect(result).toContain('other_param=value');
      expect(result).toContain('keep_me=true');
      expect(result).toContain('table=products');
    });
  });
});
