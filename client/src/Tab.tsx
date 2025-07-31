import React from "react";
import FilterBar from "./FilterBar";
import Sidebar from "./Sidebar";
import DataTable from "./DataTable/DataTable";
import { abbreviateNumber } from "./utils";
import { Column, HistogramData, Filter, SortDirection } from "./api";

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

interface TabProps {
  tab: TabState;
  updateTab: (tabId: string, updater: (tab: TabState) => TabState) => void;
}

const Tab: React.FC<TabProps> = ({ tab, updateTab }) => {
  // Add filter for this tab
  const addFilter = (
    column: string,
    value: string,
    type: "exact" | "range" = "exact",
    min?: number,
    max?: number
  ) => {
    updateTab(tab.id, (tab) => {
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
    updateTab(tab.id, (tab) => ({
      ...tab,
      filters: tab.filters.filter((f) => f.column !== column),
    }));
  };

  const toggleColumnCollapse = (columnName: string) => {
    updateTab(tab.id, (tab) => {
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
    if (!item.bin_start || !item.bin_end) return;
    updateTab(tab.id, (tab) => {
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

  return (
    <div className="main-content">
      <FilterBar filters={tab.filters} removeFilter={removeFilter} />
      <div className="content-wrapper">
        <Sidebar
          columns={tab.columns}
          histograms={tab.histograms}
          filters={tab.filters}
          collapsedColumns={tab.collapsedColumns}
          rangeSelections={tab.rangeSelections}
          toggleColumnCollapse={toggleColumnCollapse}
          isNumericalColumn={isNumericalColumn}
          handleRangeSelection={handleRangeSelection}
          addFilter={addFilter}
        />
        <div className="main-panel">
          {tab.loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <div className="data-table">
              <h3>Data ({abbreviateNumber(tab.tableTotal)} rows)</h3>
              {tab.tableData.length > 0 && (
                <DataTable
                  tableData={tab.tableData}
                  tableTotal={tab.tableTotal}
                  sortColumn={tab.sortColumn}
                  sortDirection={tab.sortDirection}
                  headerMenu={tab.headerMenu}
                  setHeaderMenu={(menu) =>
                    updateTab(tab.id, (t) => ({
                      ...t,
                      headerMenu: menu,
                    }))
                  }
                  setSortColumn={(col) =>
                    updateTab(tab.id, (t) => ({
                      ...t,
                      sortColumn: col,
                    }))
                  }
                  setSortDirection={(dir) =>
                    updateTab(tab.id, (t) => ({
                      ...t,
                      sortDirection: dir as SortDirection,
                    }))
                  }
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};



export default Tab;
