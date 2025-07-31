import React, { useState, useEffect } from "react";
import "./App.css";
import Tab from "./Tab";
import TabBar from "./TabBar";
import {
  Table,
  Column,
  HistogramData,
  SortDirection,
  Filter,
  fetchTables,
  fetchColumns,
  fetchTableData,
  fetchHistograms,
} from "./api";
import { updateURL } from "./urlState";

interface RangeSelection {
  start: number;
  end: number;
  isSelecting: boolean;
}

type TabState = {
  id: string;
  table: string;
  columns: Column[];
  filters: Filter[];
  tableData: any[];
  tableTotal: number;
  histograms: { [key: string]: HistogramData[] };
  loading: boolean;
  collapsedColumns: Set<string>;
  rangeSelections: { [key: string]: RangeSelection };
  sortColumn: string;
  sortDirection: SortDirection;
  headerMenu: { column: string; x: number; y: number } | null;
};

const makeDefaultTab = (table: string): TabState => ({
  id: Math.random().toString(36).slice(2),
  table,
  columns: [],
  filters: [],
  tableData: [],
  tableTotal: 0,
  histograms: {},
  loading: false,
  collapsedColumns: new Set(),
  rangeSelections: {},
  sortColumn: "",
  sortDirection: "",
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
        if (tableFromURL && !tabs.some((t) => t.table === tableFromURL)) {
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
          newTab.filters = urlFilters;
          newTab.sortColumn = sortCol;
          newTab.sortDirection = sortDir;
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
    if (!tab.table) return;
    // Fetch columns
    fetchColumns(tab.table)
      .then((data) => {
        setTabs((tabs) =>
          tabs.map((t) => (t.id === tab.id ? { ...t, columns: data } : t))
        );
      })
      .catch((e) => console.error("Error fetching columns:", e));
    // Fetch table data
    fetchTableData(tab.table, tab.filters, tab.sortColumn, tab.sortDirection)
      .then((result) => {
        setTabs((tabs) =>
          tabs.map((t) =>
            t.id === tab.id
              ? {
                  ...t,
                  tableData: result.data || [],
                  tableTotal:
                    typeof result.total === "number" ? result.total : 0,
                }
              : t
          )
        );
      })
      .catch((e) => {
        console.error("Error fetching table data:", e);
        setTabs((tabs) =>
          tabs.map((t) =>
            t.id === tab.id ? { ...t, tableData: [], tableTotal: 0 } : t
          )
        );
      });
  }, [
    selectedTabId,
    tabs.find((t) => t.id === selectedTabId)?.filters,
    tabs.find((t) => t.id === selectedTabId)?.sortColumn,
    tabs.find((t) => t.id === selectedTabId)?.sortDirection,
  ]);

  useEffect(() => {
    const tab = tabs.find((t) => t.id === selectedTabId);
    if (!tab) return;
    if (!tab.table || tab.columns.length === 0) return;
    fetchHistograms(tab.table, tab.columns, tab.filters)
      .then((data) => {
        setTabs((tabs) =>
          tabs.map((t) => (t.id === tab.id ? { ...t, histograms: data } : t))
        );
      })
      .catch((e) => console.error("Error fetching histograms:", e));
  }, [
    selectedTabId,
    tabs.find((t) => t.id === selectedTabId)?.columns,
    tabs.find((t) => t.id === selectedTabId)?.filters,
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
      updateURL(tab.table, tab.filters, tab.sortColumn, tab.sortDirection);
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

  // When selecting a table, open a new tab
  const handleTableSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const table = e.target.value;
    if (!table) return;
    const newTab = makeDefaultTab(table);
    setTabs((tabs) => [...tabs, newTab]);
    setSelectedTabId(newTab.id);
    // Update URL for new tab
    updateURL(table, [], "", "");
  };

  const currentTab = tabs.find((t) => t.id === selectedTabId);

  // When filters or sort change on the selected tab, update the URL
  useEffect(() => {
    const tab = tabs.find((t) => t.id === selectedTabId);
    if (tab) {
      updateURL(tab.table, tab.filters, tab.sortColumn, tab.sortDirection);
    }
    // Only run when selectedTabId or relevant tab state changes
  }, [
    selectedTabId,
    tabs.find((t) => t.id === selectedTabId)?.filters,
    tabs.find((t) => t.id === selectedTabId)?.sortColumn,
    tabs.find((t) => t.id === selectedTabId)?.sortDirection,
  ]);

  return (
    <div className="App">
      <header className="header">
        <h1>DuckDB Explorer</h1>
        <div className="table-selector">
          <select
            value=""
            onChange={handleTableSelect}
            className="table-select"
          >
            <option value="">Open table...</option>
            {tables.map((table) => (
              <option key={table.table_name} value={table.table_name}>
                {table.table_name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Tab bar */}
      <TabBar
        tabs={tabs}
        selectedTabId={selectedTabId}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
      />

      {currentTab && <Tab tab={currentTab} updateTab={updateTab} />}
    </div>
  );
}

export default App;
