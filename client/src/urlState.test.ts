import { appStateToUrl, urlToAppState, urlToQuery, AppUrlState } from './urlState';

describe('urlState pure functions', () => {
  const baseUrl = 'http://localhost:3000/';

  describe('appStateToUrl', () => {
    it('should set state parameter in URL for single tab', () => {
      const state: AppUrlState = {
        tabs: [{
          id: 'tab1',
          name: 'Products Tab',
          query: {
            tableName: 'products',
            filters: [],
            orderBy: '',
            orderDir: undefined
          }
        }],
        selectedTabId: 'tab1'
      };

      const result = appStateToUrl(baseUrl, state);
      const url = new URL(result);
      
      expect(url.searchParams.has('state')).toBe(true);
      
      // Decode and parse the state
      const stateParam = url.searchParams.get('state');
      const decodedState = JSON.parse(atob(stateParam!));
      expect(decodedState.tabs).toHaveLength(1);
      expect(decodedState.tabs[0].query.tableName).toBe('products');
      expect(decodedState.selectedTabId).toBe('tab1');
    });

    it('should handle multiple tabs', () => {
      const state: AppUrlState = {
        tabs: [
          {
            id: 'tab1',
            name: 'Products',
            query: {
              tableName: 'products',
              filters: [{ type: 'exact', column: 'category', value: 'Electronics' }],
              orderBy: 'name',
              orderDir: 'ASC'
            }
          },
          {
            id: 'tab2',
            name: 'Customers',
            query: {
              tableName: 'customers',
              filters: [],
              orderBy: '',
              orderDir: undefined
            }
          }
        ],
        selectedTabId: 'tab2'
      };

      const result = appStateToUrl(baseUrl, state);
      const url = new URL(result);
      
      const stateParam = url.searchParams.get('state');
      const decodedState = JSON.parse(atob(stateParam!));
      
      expect(decodedState.tabs).toHaveLength(2);
      expect(decodedState.selectedTabId).toBe('tab2');
      expect(decodedState.tabs[0].query.tableName).toBe('products');
      expect(decodedState.tabs[1].query.tableName).toBe('customers');
    });

    it('should remove state parameter when no tabs', () => {
      const state: AppUrlState = {
        tabs: [],
        selectedTabId: undefined
      };

      const result = appStateToUrl(baseUrl + '?state=something', state);
      const url = new URL(result);
      
      expect(url.searchParams.has('state')).toBe(false);
    });
  });

  describe('urlToAppState', () => {
    it('should return null for URL without state parameter', () => {
      const result = urlToAppState(baseUrl);
      expect(result).toBeNull();
    });

    it('should return null for invalid state parameter', () => {
      const url = baseUrl + '?state=invalid';
      const result = urlToAppState(url);
      expect(result).toBeNull();
    });

    it('should extract single tab state from URL', () => {
      const originalState: AppUrlState = {
        tabs: [{
          id: 'tab1',
          name: 'Products',
          query: {
            tableName: 'products',
            filters: [{ type: 'exact', column: 'category', value: 'Electronics' }],
            orderBy: 'name',
            orderDir: 'ASC'
          }
        }],
        selectedTabId: 'tab1'
      };

      const url = appStateToUrl(baseUrl, originalState);
      const result = urlToAppState(url);
      
      expect(result).not.toBeNull();
      expect(result!.tabs).toHaveLength(1);
      expect(result!.selectedTabId).toBe('tab1');
      expect(result!.tabs[0].query.tableName).toBe('products');
      expect(result!.tabs[0].query.filters).toHaveLength(1);
      expect(result!.tabs[0].query.orderBy).toBe('name');
      expect(result!.tabs[0].query.orderDir).toBe('ASC');
    });
  });

  describe('round-trip functionality', () => {
    it('should maintain state through round-trip conversion', () => {
      const originalState: AppUrlState = {
        tabs: [
          {
            id: 'tab1',
            name: 'Complex Query',
            query: {
              tableName: 'products',
              filters: [
                { type: 'exact', column: 'category', value: 'Electronics' },
                { type: 'range', column: 'price', min: 50, max: 500 },
                { type: 'in', column: 'supplier_id', stepName: 'top_suppliers', stepColumn: 'id' }
              ],
              orderBy: 'name',
              orderDir: 'ASC',
              steps: [
                {
                  name: 'top_suppliers',
                  tableName: 'suppliers',
                  filters: [{ type: 'exact', column: 'rating', value: '5' }]
                }
              ]
            }
          }
        ],
        selectedTabId: 'tab1'
      };

      const url = appStateToUrl(baseUrl, originalState);
      const roundTripState = urlToAppState(url);
      
      expect(roundTripState).toEqual(originalState);
    });
  });

  describe('legacy urlToQuery (for backward compatibility)', () => {
    it('should extract table from old URL format', () => {
      const url = baseUrl + '?table=products';
      const query = urlToQuery(url);
      expect(query.tableName).toBe('products');
    });

    it('should extract filters from old URL format', () => {
      const url = baseUrl + '?table=products&filter_category=Electronics%3Aexact&filter_price=%3Arange%3A10%3A100';
      const query = urlToQuery(url);
      
      expect(query.filters).toHaveLength(2);
      expect(query.filters![0]).toEqual({
        type: 'exact',
        column: 'category',
        value: 'Electronics'
      });
      expect(query.filters![1]).toEqual({
        type: 'range',
        column: 'price',
        min: 10,
        max: 100
      });
    });

    it('should skip empty filters', () => {
      const url = baseUrl + '?table=products&filter_category=%3Aexact';
      const query = urlToQuery(url);
      
      expect(query.filters).toHaveLength(0);
    });

    it('should extract sort from old URL format', () => {
      const url = baseUrl + '?table=products&sort=name&dir=asc';
      const query = urlToQuery(url);
      
      expect(query.orderBy).toBe('name');
      expect(query.orderDir).toBe('ASC');
    });
  });
});
