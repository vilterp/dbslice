import React from "react";
import FilterBar from "./FilterBar";
import Sidebar from "./Sidebar";
import DataTable from "./DataTable/DataTable";
import { abbreviateNumber } from "./utils";
import { Column, Filter, SortDirection } from "./api";

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
  tableDataError?: string;
  tableDataLoading: boolean;
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


  return (
    <div className="main-content">
      <FilterBar filters={tab.filters} removeFilter={removeFilter} />
      <div className="content-wrapper">
        <Sidebar
          columns={tab.columns}
          selectedTable={tab.table}
          filters={tab.filters}
          collapsedColumns={tab.collapsedColumns}
          toggleColumnCollapse={toggleColumnCollapse}
          isNumericalColumn={isNumericalColumn}
          addFilter={addFilter}
          removeFilter={removeFilter}
        />
        <div className="main-panel">
          {tab.loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <div className="data-table">
              <h3>Data ({tab.tableDataLoading ? 'Loading...' : `${abbreviateNumber(tab.tableTotal)} rows`})</h3>
              <DataTable
                tableData={tab.tableData}
                sortColumn={tab.sortColumn}
                sortDirection={tab.sortDirection}
                headerMenu={tab.headerMenu}
                loading={tab.tableDataLoading}
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
                addFilter={addFilter}
                error={tab.tableDataError}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};



export default Tab;
