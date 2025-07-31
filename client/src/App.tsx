import React, { useState, useEffect } from "react";
import "./App.css";
import TableHeader from "./TableHeader";
import FilterBar from "./FilterBar";
import Sidebar from "./Sidebar";
import HeaderMenu from "./HeaderMenu";
import {
  Table,
  Column,
  HistogramData,
  TableDataResponse,
  SortDirection,
  Filter,
  fetchTables,
  fetchColumns,
  fetchTableData,
  fetchHistograms,
} from "./api";
import { updateURL, loadFromURL } from "./urlState";
import { abbreviateNumber } from "./utils";

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

  useEffect(() => {
    fetchTables()
      .then((data) => setTables(data))
      .catch((e) => console.error("Error fetching tables:", e));
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

  // Tab-specific state updaters
  const updateTab = (tabId: string, updater: (tab: TabState) => TabState) => {
    setTabs((tabs) => tabs.map((t) => (t.id === tabId ? updater(t) : t)));
  };

  const addFilter = (
    column: string,
    value: string,
    type: "exact" | "range" = "exact",
    min?: number,
    max?: number
  ) => {
    if (!selectedTabId) return;
    updateTab(selectedTabId, (tab) => {
      const existingFilter = tab.filters.find((f) => f.column === column);
      let newFilters;
      if (existingFilter) {
        newFilters = tab.filters.map((f) =>
          f.column === column ? { column, value, type, min, max } : f
        );
      } else {
        newFilters = [...tab.filters, { column, value, type, min, max }];
      }
      return { ...tab, filters: newFilters };
    });
  };

  const removeFilter = (column: string) => {
    if (!selectedTabId) return;
    updateTab(selectedTabId, (tab) => ({
      ...tab,
      filters: tab.filters.filter((f) => f.column !== column),
    }));
  };

  const toggleColumnCollapse = (columnName: string) => {
    if (!selectedTabId) return;
    updateTab(selectedTabId, (tab) => {
      const newCollapsed = new Set(tab.collapsedColumns);
      if (newCollapsed.has(columnName)) {
        newCollapsed.delete(columnName);
      } else {
        newCollapsed.add(columnName);
      }
      return { ...tab, collapsedColumns: newCollapsed };
    });
  };

  const isNumericalColumn = (dataType: string) => {
    return [
      "INTEGER",
      "BIGINT",
      "DECIMAL",
      "DOUBLE",
      "FLOAT",
      "NUMERIC",
      "REAL",
    ].some((type) => dataType.toUpperCase().includes(type));
  };

  const handleRangeSelection = (columnName: string, item: HistogramData) => {
    if (!selectedTabId) return;
    if (!item.bin_start || !item.bin_end) return;
    updateTab(selectedTabId, (tab) => {
      const currentRange = tab.rangeSelections[columnName];
      if (!currentRange || !currentRange.isSelecting) {
        // Start new selection, ensure bin_start/bin_end are numbers
        const start = typeof item.bin_start === "number" ? item.bin_start : 0;
        const end = typeof item.bin_end === "number" ? item.bin_end : 0;
        return {
          ...tab,
          rangeSelections: {
            ...tab.rangeSelections,
            [columnName]: {
              start,
              end,
              isSelecting: true,
            } as RangeSelection,
          },
        };
      } else {
        // Complete selection, ensure all are numbers
        const s1 =
          typeof currentRange.start === "number" ? currentRange.start : 0;
        const s2 = typeof item.bin_start === "number" ? item.bin_start : 0;
        const e1 = typeof currentRange.end === "number" ? currentRange.end : 0;
        const e2 = typeof item.bin_end === "number" ? item.bin_end : 0;
        const min = Math.min(s1, s2);
        const max = Math.max(e1, e2);
        addFilter(columnName, `${min}-${max}`, "range", min, max);
        return {
          ...tab,
          rangeSelections: {
            ...tab.rangeSelections,
            [columnName]: {
              start: 0,
              end: 0,
              isSelecting: false,
            } as RangeSelection,
          },
        };
      }
    });
  };

  // Tab bar UI
  const handleTabClick = (tabId: string) => setSelectedTabId(tabId);
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
  };

  const currentTab = tabs.find((t) => t.id === selectedTabId);

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
      <div
        className="tab-bar"
        style={{
          display: "flex",
          background: "#f8f9fa",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={tab.id === selectedTabId ? "tab active" : "tab"}
            style={{
              padding: "0.5rem 1rem",
              borderRight: "1px solid #e0e0e0",
              background: tab.id === selectedTabId ? "white" : "inherit",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              position: "relative",
            }}
            onClick={() => handleTabClick(tab.id)}
          >
            <span>{tab.table}</span>
            <button
              style={{
                marginLeft: 8,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#888",
                fontSize: 16,
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleTabClose(tab.id);
              }}
              aria-label="Close tab"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {currentTab && (
        <div className="main-content">
          <FilterBar filters={currentTab.filters} removeFilter={removeFilter} />

          <div className="content-wrapper">
            <Sidebar
              columns={currentTab.columns}
              histograms={currentTab.histograms}
              filters={currentTab.filters}
              collapsedColumns={currentTab.collapsedColumns}
              rangeSelections={currentTab.rangeSelections}
              toggleColumnCollapse={toggleColumnCollapse}
              isNumericalColumn={isNumericalColumn}
              handleRangeSelection={handleRangeSelection}
              addFilter={addFilter}
            />

            <div className="main-panel">
              {currentTab.loading ? (
                <div className="loading">Loading...</div>
              ) : (
                <div className="data-table">
                  <h3>Data ({abbreviateNumber(currentTab.tableTotal)} rows)</h3>
                  {currentTab.tableData.length > 0 && (
                    <div style={{ position: "relative" }}>
                      <table>
                        <thead>
                          <tr>
                            <TableHeader
                              columns={Object.keys(currentTab.tableData[0])}
                              sortColumn={currentTab.sortColumn}
                              sortDirection={currentTab.sortDirection}
                              headerMenu={currentTab.headerMenu}
                              setHeaderMenu={(menu) =>
                                updateTab(currentTab.id, (t) => ({
                                  ...t,
                                  headerMenu: menu,
                                }))
                              }
                            />
                          </tr>
                        </thead>
                        <tbody>
                          {currentTab.tableData.map((row, index) => (
                            <tr key={index}>
                              {Object.values(row).map((value, cellIndex) => (
                                <td key={cellIndex}>{String(value)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <HeaderMenu
                        headerMenu={currentTab.headerMenu}
                        sortColumn={currentTab.sortColumn}
                        setSortColumn={(col) =>
                          updateTab(currentTab.id, (t) => ({
                            ...t,
                            sortColumn: col,
                          }))
                        }
                        sortDirection={currentTab.sortDirection}
                        setSortDirection={(dir) =>
                          updateTab(currentTab.id, (t) => ({
                            ...t,
                            sortDirection: dir as SortDirection,
                          }))
                        }
                        setHeaderMenu={(menu) =>
                          updateTab(currentTab.id, (t) => ({
                            ...t,
                            headerMenu: menu,
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
