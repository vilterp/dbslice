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
import { updateURL } from "./urlState";

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

  // On mount, fetch tables and check for URL state
  useEffect(() => {
    fetchTables()
      .then((data) => {
        setTables(data);
        // Custom URL state loader for tabs
        const url = new URL(window.location.href);
        const tableFromURL = url.searchParams.get("table");
        if (tableFromURL && !tabs.some((t) => t.queryState.query.tableName === tableFromURL)) {
          // Parse steps
          const urlSteps = [];
          for (const [key, value] of url.searchParams.entries()) {
            if (key.startsWith("step_")) {
              try {
                const stepData = JSON.parse(decodeURIComponent(value));
                urlSteps.push(stepData);
              } catch (e) {
                console.warn("Failed to parse step data from URL:", value);
              }
            }
          }
          
          // Parse filters
          const urlFilters = [];
          for (const [key, value] of url.searchParams.entries()) {
            if (key.startsWith("filter_")) {
              const column = key.replace("filter_", "");
              const [filterValue, type = "exact", min, max, stepColumn] = value.split(":");
              
              if (type === "range" && min && max) {
                urlFilters.push({
                  type: "range" as const,
                  column,
                  min: parseFloat(min),
                  max: parseFloat(max),
                });
              } else if (type === "in" && min && stepColumn) {
                urlFilters.push({
                  type: "in" as const,
                  column,
                  stepName: min,
                  stepColumn: stepColumn,
                });
              } else {
                urlFilters.push({
                  type: "exact" as const,
                  column,
                  value: filterValue,
                });
              }
            }
          }
          // Parse sort
          const sortCol = url.searchParams.get("sort") || "";
          const sortDir = (url.searchParams.get("dir") as SortDirection) || "";
          const newTab = makeDefaultTab(tableFromURL);
          newTab.queryState.query.filters = urlFilters;
          newTab.queryState.query.orderBy = sortCol;
          newTab.queryState.query.orderDir = sortDir === "asc" ? "ASC" : sortDir === "desc" ? "DESC" : undefined;
          newTab.queryState.query.steps = urlSteps;
          setTabs((tabs) => [...tabs, newTab]);
          setSelectedTabId(newTab.id);
        }
      })
      .catch((e) => console.error("Error fetching tables:", e));
    // eslint-disable-next-line
    // Only run on mount
    // We intentionally do not add tabs as a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // When switching tabs, update the URL to reflect the selected tab's query state
  const handleTabClick = (tabId: string) => {
    setSelectedTabId(tabId);
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      updateURL({
        table: tab.queryState.query.tableName,
        filters: tab.queryState.query.filters,
        sortCol: tab.queryState.query.orderBy || "",
        sortDir: tab.queryState.query.orderDir === "ASC" ? "asc" : tab.queryState.query.orderDir === "DESC" ? "desc" : "",
        steps: tab.queryState.query.steps || []
      });
    }
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

  // When filters or sort change on the selected tab, update the URL
  useEffect(() => {
    const tab = tabs.find((t) => t.id === selectedTabId);
    if (tab) {
      updateURL({
        table: tab.queryState.query.tableName,
        filters: tab.queryState.query.filters,
        sortCol: tab.queryState.query.orderBy || "",
        sortDir: tab.queryState.query.orderDir === "ASC" ? "asc" : tab.queryState.query.orderDir === "DESC" ? "desc" : "",
        steps: tab.queryState.query.steps || []
      });
    }
    // Only run when selectedTabId or relevant tab state changes
  }, [
    selectedTabId,
    tabs.find((t) => t.id === selectedTabId)?.queryState.query.filters,
    tabs.find((t) => t.id === selectedTabId)?.queryState.query.orderBy,
    tabs.find((t) => t.id === selectedTabId)?.queryState.query.orderDir,
  ]);

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

      {currentTab && <Tab tab={currentTab} updateTab={updateTab} tables={tables} onForeignKeyNavigation={handleForeignKeyNavigation} onReverseForeignKeyNavigation={handleReverseForeignKeyNavigation} onJoinWithTable={handleJoinWithTable} />}
    </div>
  );
}

export default App;
