import React, { useState, useEffect } from "react";
import "./App.css";
import Tab from "./Tab";
import TabBar from "./TabBar";
import { Database } from "../../src/database";
import { Query, Table } from "../../src/types";
import { updateURL, urlToAppState, AppUrlState, TabUrlState } from "./urlState";

// Import the TabState type from Tab component to avoid duplication
import { TabState } from './Tab';

interface ExplorerProps {
  database: Database;
}

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

const Explorer: React.FC<ExplorerProps> = ({ database }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  
  // Track query signatures to avoid unnecessary reloads
  const [querySignatures, setQuerySignatures] = useState<Map<string, string>>(new Map());

  // On mount, fetch tables and check for URL state
  useEffect(() => {
    database.getTables()
      .then((data) => {
        setTables(data);
        
        // Load app state from URL
        const stateFromURL = urlToAppState(window.location.href);
        
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
        } else {
          // No state in URL - create a default tab
          const defaultTab = makeDefaultTab();
          setTabs([defaultTab]);
          setSelectedTabId(defaultTab.id);
        }
      })
      .catch((e) => console.error("Error fetching tables:", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [database]);

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
        database.getColumns(tab.queryState.query.tableName)
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
        database.getTableData(tab.queryState.query)
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
  }, [tabs, querySignatures, database]);

  // Tab-specific state updater
  const updateTab = (tabId: string, updater: (tab: TabState) => TabState) => {
    setTabs((tabs) => tabs.map((t) => (t.id === tabId ? updater(t) : t)));
  };

  const handleForeignKeyNavigation = (targetTable: string, targetColumn: string, value: any) => {
    const newTab = makeDefaultTab(targetTable);
    // Add filter for the foreign key value
    newTab.queryState.query.filters = [{
      type: 'exact',
      column: targetColumn,
      value: String(value)
    }];
    setTabs((tabs) => [...tabs, newTab]);
    setSelectedTabId(newTab.id);
  };

  const handleReverseForeignKeyNavigation = (targetTable: string, targetColumn: string, value: any) => {
    const newTab = makeDefaultTab(targetTable);
    // Add filter for the reverse foreign key value
    newTab.queryState.query.filters = [{
      type: 'exact',
      column: targetColumn,
      value: String(value)
    }];
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

  // Update URL whenever tabs or selectedTabId changes
  useEffect(() => {
    if (tabs.length > 0) {
      updateURL(getAppState());
    }
  }, [tabs, selectedTabId]);

  return (
    <div className="App">
      <header className="header">
        <h1>DuckDB Explorer</h1>
      </header>

      {/* Tab bar */}
      <TabBar
        tabs={tabs}
        selectedTabId={selectedTabId}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        onAddTab={() => {
          const newTab = makeDefaultTab();
          setTabs((tabs) => [...tabs, newTab]);
          setSelectedTabId(newTab.id);
        }}
        onTabRename={handleTabRename}
      />

      {currentTab && 
        <Tab 
          tab={currentTab} 
          updateTab={updateTab} 
          tables={tables} 
          onForeignKeyNavigation={handleForeignKeyNavigation} 
          onReverseForeignKeyNavigation={handleReverseForeignKeyNavigation} 
          onJoinWithTable={handleJoinWithTable}
          database={database}
        />
      }
    </div>
  );
};

export default Explorer;