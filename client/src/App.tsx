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

  // On mount, fetch tables and check for URL state
  useEffect(() => {
    fetchTables()
      .then((data) => {
        setTables(data);
        // Custom URL state loader for tabs
        const url = new URL(window.location.href);
        const tableFromURL = url.searchParams.get("table");
        if (tableFromURL && !tabs.some((t) => t.queryState.query.tableName === tableFromURL)) {
          // Parse filters
          const urlFilters = [];
          for (const [key, value] of url.searchParams.entries()) {
            if (key.startsWith("filter_")) {
              const column = key.replace("filter_", "");
              const [filterValue, type = "exact", min, max] = value.split(":");
              urlFilters.push({
                column,
                value: filterValue,
                type: type as "exact" | "range",
                min: min ? parseFloat(min) : undefined,
                max: max ? parseFloat(max) : undefined,
              });
            }
          }
          // Parse sort
          const sortCol = url.searchParams.get("sort") || "";
          const sortDir = (url.searchParams.get("dir") as SortDirection) || "";
          const newTab = makeDefaultTab(tableFromURL);
          newTab.queryState.query.filters = urlFilters;
          newTab.queryState.query.orderBy = sortCol;
          newTab.queryState.query.orderDir = sortDir === "asc" ? "ASC" : sortDir === "desc" ? "DESC" : undefined;
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

  // Load data for the selected tab
  useEffect(() => {
    const tab = tabs.find((t) => t.id === selectedTabId);
    if (!tab) return;
    if (!tab.queryState.query.tableName) return;
    // Fetch columns
    fetchColumns(tab.queryState.query.tableName)
      .then((data) => {
        setTabs((tabs) =>
          tabs.map((t) => (t.id === tab.id ? { ...t, columns: data } : t))
        );
      })
      .catch((e) => console.error("Error fetching columns:", e));
    // Set loading state before fetching table data
    setTabs((tabs) =>
      tabs.map((t) =>
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
    fetchTableData(
      tab.queryState.query.tableName, 
      tab.queryState.query.filters, 
      tab.queryState.query.orderBy || "", 
      tab.queryState.query.orderDir === "ASC" ? "asc" : tab.queryState.query.orderDir === "DESC" ? "desc" : ""
    )
      .then((result) => {
        setTabs((tabs) =>
          tabs.map((t) =>
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
        setTabs((tabs) =>
          tabs.map((t) =>
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
  }, [
    selectedTabId,
    tabs.find((t) => t.id === selectedTabId)?.queryState.query.filters,
    tabs.find((t) => t.id === selectedTabId)?.queryState.query.orderBy,
    tabs.find((t) => t.id === selectedTabId)?.queryState.query.orderDir,
  ]);


  // All data loading functions are now imported from api.ts

  // Tab-specific state updater
  const updateTab = (tabId: string, updater: (tab: TabState) => TabState) => {
    setTabs((tabs) => tabs.map((t) => (t.id === tabId ? updater(t) : t)));
  };

  // Tab bar UI
  // When switching tabs, update the URL to reflect the selected tab's query state
  const handleTabClick = (tabId: string) => {
    setSelectedTabId(tabId);
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      updateURL(
        tab.queryState.query.tableName, 
        tab.queryState.query.filters, 
        tab.queryState.query.orderBy || "", 
        tab.queryState.query.orderDir === "ASC" ? "asc" : tab.queryState.query.orderDir === "DESC" ? "desc" : ""
      );
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
      updateURL(
        tab.queryState.query.tableName, 
        tab.queryState.query.filters, 
        tab.queryState.query.orderBy || "", 
        tab.queryState.query.orderDir === "ASC" ? "asc" : tab.queryState.query.orderDir === "DESC" ? "desc" : ""
      );
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

      {currentTab && <Tab tab={currentTab} updateTab={updateTab} tables={tables} />}
    </div>
  );
}

export default App;
