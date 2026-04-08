import React, { useState, useEffect } from "react";
import "./App.css";
import Tab from "./Tab";
import TabBar from "./TabBar";
import {
  Table,
  SortDirection,
  fetchTables,
  fetchColumns,
  fetchTableData,
} from "./api";
import { Query } from "../../src/types";
import { updateURL, urlToAppState, AppUrlState, TabUrlState } from "./urlState";

// Import the TabState type from Tab component to avoid duplication
import { TabState } from './Tab';

const makeDefaultTab = (table?: string): TabState => ({
  id: Math.random().toString(36).slice(2),
  queryState: {
    query: {
      tableName: table || "",
      filters: [],
      orderBy: "",
      orderDir: undefined,
    },
    state: { type: "idle" },
  },
  columns: [],
  collapsedColumns: new Set(),
  headerMenu: null,
});

function App() {
  const [tables, setTables] = useState<Table[]>([]);
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  
  // Track query signatures to avoid unnecessary reloads
  const [querySignatures, setQuerySignatures] = useState<Map<string, string>>(new Map());
  
  // Track whether we're currently updating from URL (to avoid infinite loops)
  const [isUpdatingFromUrl, setIsUpdatingFromUrl] = useState(false);

  // Helper function to load state from URL
  const loadStateFromUrl = (urlString: string = window.location.href) => {
    const stateFromURL = urlToAppState(urlString);
    
    if (stateFromURL && stateFromURL.tabs.length > 0) {
      // Convert URL tab state to full TabState objects
      const urlTabs = stateFromURL.tabs.map(urlTab => ({
        id: urlTab.id,
        name: urlTab.name,
        queryState: {
          query: urlTab.query,
          state: { type: "idle" as const },
        },
        columns: [],
        collapsedColumns: new Set<string>(),
        headerMenu: null,
      }));
      
      setTabs(urlTabs);
      setSelectedTabId(stateFromURL.selectedTabId || urlTabs[0].id);
      return true;
    }
    return false;
  };

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      setIsUpdatingFromUrl(true);
      loadStateFromUrl();
      setIsUpdatingFromUrl(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // On mount, fetch tables and check for URL state
  useEffect(() => {
    fetchTables()
      .then((data) => {
        setTables(data);
        
        setIsUpdatingFromUrl(true);
        // Load app state from URL
        const loaded = loadStateFromUrl();
        
        if (!loaded) {
          // No state in URL - start with no tabs
        }
        setIsUpdatingFromUrl(false);
      })
      .catch((e) => console.error("Error fetching tables:", e));
    // eslint-disable-next-line
    // Only run on mount
    // We intentionally do not add tabs as a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper function to create app state for URL
  const getAppState = (): AppUrlState => {
    return {
      tabs: tabs.map(tab => ({
        id: tab.id,
        name: tab.name,
        query: tab.queryState.query
      })),
      selectedTabId: selectedTabId || undefined
    };
  };

  // Helper function to create query signature
  const getQuerySignature = (query: Query) => {
    return JSON.stringify({
      tableName: query.tableName,
      filters: query.filters,
      orderBy: query.orderBy,
      orderDir: query.orderDir,
    });
  };

  // Load data when query changes (not just when switching tabs)
  useEffect(() => {
    tabs.forEach((tab) => {
      if (!tab.queryState.query.tableName) return;
      
      const currentSignature = getQuerySignature(tab.queryState.query);
      const lastSignature = querySignatures.get(tab.id);
      
      // Check if we need to fetch columns
      if (tab.columns.length === 0) {
        fetchColumns(tab.queryState.query.tableName)
          .then((data) => {
            setTabs((prevTabs) =>
              prevTabs.map((t) => (t.id === tab.id ? { ...t, columns: data } : t))
            );
          })
          .catch((e) => console.error("Error fetching columns:", e));
      }
      
      // Only reload data if the query signature has changed
      if (currentSignature !== lastSignature && tab.queryState.state.type !== "loading") {
        // Update query signature
        setQuerySignatures((prev) => new Map(prev).set(tab.id, currentSignature));
        
        // Set loading state before fetching table data
        setTabs((prevTabs) =>
          prevTabs.map((t) =>
            t.id === tab.id ? { 
              ...t, 
              queryState: { 
                ...t.queryState, 
                state: { type: "loading" } 
              } 
            } : t
          )
        );
        
        // Fetch table data
        fetchTableData(tab.queryState.query)
          .then((result) => {
            setTabs((prevTabs) =>
              prevTabs.map((t) =>
                t.id === tab.id
                  ? {
                      ...t,
                      queryState: {
                        ...t.queryState,
                        state: { 
                          type: "loaded", 
                          data: result.data || [], 
                          total: typeof result.total === "number" ? result.total : 0 
                        }
                      }
                    }
                  : t
              )
            );
          })
          .catch((e) => {
            console.error("Error fetching table data:", e);
            setTabs((prevTabs) =>
              prevTabs.map((t) =>
                t.id === tab.id ? { 
                  ...t, 
                  queryState: {
                    ...t.queryState,
                    state: { 
                      type: "error", 
                      error: e instanceof Error ? e.message : 'Failed to load table data' 
                    }
                  }
                } : t
              )
            );
          });
      }
    });
  }, [tabs, querySignatures]);


  // All data loading functions are now imported from api.ts

  // Tab-specific state updater
  const updateTab = (tabId: string, updater: (tab: TabState) => TabState) => {
    setTabs((tabs) => tabs.map((t) => (t.id === tabId ? updater(t) : t)));
  };

  const handleForeignKeyNavigation = (
    targetTable: string,
    targetColumn: string,
    value: any,
    allColumns?: string[],
    allReferencedColumns?: string[],
    rowData?: any
  ) => {
    const newTab = makeDefaultTab(targetTable);

    // If this is a composite foreign key, add filters for all columns
    if (allColumns && allReferencedColumns && rowData) {
      newTab.queryState.query.filters = allReferencedColumns.map((refCol, index) => ({
        type: 'exact' as const,
        column: refCol,
        value: String(rowData[allColumns[index]])
      }));
    } else {
      // Single column foreign key
      newTab.queryState.query.filters = [{
        type: 'exact',
        column: targetColumn,
        value: String(value)
      }];
    }

    setTabs((tabs) => [...tabs, newTab]);
    setSelectedTabId(newTab.id);
  };

  const handleReverseForeignKeyNavigation = (
    targetTable: string,
    targetColumn: string,
    value: any,
    allSourceColumns?: string[],
    allReferencedColumns?: string[],
    rowData?: any
  ) => {
    const newTab = makeDefaultTab(targetTable);

    // If this is a composite foreign key, add filters for all columns
    if (allSourceColumns && allReferencedColumns && rowData) {
      newTab.queryState.query.filters = allSourceColumns.map((srcCol, index) => ({
        type: 'exact' as const,
        column: srcCol,
        value: String(rowData[allReferencedColumns[index]])
      }));
    } else {
      // Single column foreign key
      newTab.queryState.query.filters = [{
        type: 'exact',
        column: targetColumn,
        value: String(value)
      }];
    }

    setTabs((tabs) => [...tabs, newTab]);
    setSelectedTabId(newTab.id);
  };

  const handleJoinWithTable = (currentTable: string, currentFilters: any[], joinColumn: string, targetTable: string, targetColumn: string) => {
    const newTab = makeDefaultTab(targetTable);
    
    // Create the CTE step from the current table and filters
    const stepName = `${currentTable}_filtered`;
    const cteStep = {
      name: stepName,
      tableName: currentTable,
      filters: currentFilters,
      selectColumn: joinColumn
    };
    
    // Add the IN filter to join the tables
    const inFilter = {
      type: 'in' as const,
      column: targetColumn,
      stepName: stepName,
      stepColumn: joinColumn
    };
    
    // Set up the new query with CTE and IN filter
    newTab.queryState.query.steps = [cteStep];
    newTab.queryState.query.filters = [inFilter];
    
    setTabs((tabs) => [...tabs, newTab]);
    setSelectedTabId(newTab.id);
  };

  // Tab bar UI
  // When switching tabs, update the URL to reflect the selected tab's query state
  const handleTabClick = (tabId: string) => {
    setSelectedTabId(tabId);
  };
  const handleTabClose = (tabId: string) => {
    setTabs((tabs) => {
      const idx = tabs.findIndex((t) => t.id === tabId);
      const newTabs = tabs.filter((t) => t.id !== tabId);
      if (selectedTabId === tabId) {
        // Select next tab, or previous, or null
        if (newTabs.length > 0) {
          const newIdx = idx > 0 ? idx - 1 : 0;
          setSelectedTabId(newTabs[newIdx].id);
        } else {
          setSelectedTabId(null);
        }
      }
      return newTabs;
    });
    
    // Clean up query signature for closed tab
    setQuerySignatures((prev) => {
      const newMap = new Map(prev);
      newMap.delete(tabId);
      return newMap;
    });
  };

  const handleTabRename = (tabId: string, newName: string) => {
    setTabs((tabs) => 
      tabs.map((tab) => 
        tab.id === tabId ? { ...tab, name: newName } : tab
      )
    );
  };


  const currentTab = tabs.find((t) => t.id === selectedTabId);

  // Track if this is the initial load
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Update URL whenever tabs or selectedTabId changes
  useEffect(() => {
    if (tabs.length > 0 && !isUpdatingFromUrl) {
      updateURL(getAppState(), isInitialLoad);
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    }
  }, [tabs, selectedTabId, isUpdatingFromUrl, isInitialLoad]);

  return (
    <div className="App">
      <header className="header">
        <h1>DBSlice</h1>
      </header>

      {/* Tab bar */}

      <TabBar
        tabs={tabs}
        selectedTabId={selectedTabId}
        tables={tables}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        onAddTab={(tableName: string) => {
          const newTab = makeDefaultTab(tableName);
          setTabs((tabs) => [...tabs, newTab]);
          setSelectedTabId(newTab.id);
        }}
        onTabRename={handleTabRename}
      />

      {currentTab
        ? <Tab tab={currentTab} updateTab={updateTab} tables={tables} onForeignKeyNavigation={handleForeignKeyNavigation} onReverseForeignKeyNavigation={handleReverseForeignKeyNavigation} onJoinWithTable={handleJoinWithTable} />
        : <div className="no-table-selected"><h3>No table selected</h3><p>Please select a table from the dropdown above to begin exploring your data.</p></div>
      }
    </div>
  );
}

export default App;
