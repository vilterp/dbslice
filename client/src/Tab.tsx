import { NUMERICAL_COLUMN_TYPES } from '../../src/common';
import React from "react";
import FilterBar from "./FilterBar";
import Sidebar from "./Sidebar";
import DataTable from "./DataTable/DataTable";
import { abbreviateNumber } from "./utils";
import { Column, SortDirection } from "./api";
import { QueryState } from '../../src/common';

type TabState = {
  id: string;
  queryState: QueryState;
  columns: Column[];
  collapsedColumns: Set<string>;
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
      const existingFilter = tab.queryState.query.filters.find((f) => f.column === column);
      let newFilters;
      if (existingFilter) {
        newFilters = tab.queryState.query.filters.map((f) =>
          f.column === column ? { column, value, type, min, max } : f
        );
      } else {
        newFilters = [...tab.queryState.query.filters, { column, value, type, min, max }];
      }
      return { ...tab, queryState: { ...tab.queryState, query: { ...tab.queryState.query, filters: newFilters } } };
    });
  };

  const removeFilter = (column: string) => {
    updateTab(tab.id, (tab) => ({
      ...tab,
      queryState: {
        ...tab.queryState,
        query: {
          ...tab.queryState.query,
          filters: tab.queryState.query.filters.filter((f) => f.column !== column),
        },
      },
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
    return NUMERICAL_COLUMN_TYPES.some((type) => dataType.toUpperCase().includes(type));
  };


  return (
    <div className="main-content">
      <FilterBar filters={tab.queryState.query.filters} removeFilter={removeFilter} />
      <div className="content-wrapper">
        <Sidebar
          columns={tab.columns}
          selectedTable={tab.queryState.query.tableName}
          filters={tab.queryState.query.filters}
          collapsedColumns={tab.collapsedColumns}
          toggleColumnCollapse={toggleColumnCollapse}
          isNumericalColumn={isNumericalColumn}
          addFilter={addFilter}
          removeFilter={removeFilter}
        />
        <div className="main-panel">
          {tab.queryState.loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <div className="data-table">
              <h3>Data ({tab.queryState.dataLoading ? 'Loading...' : `${abbreviateNumber(tab.queryState.total)} rows`})</h3>
              <DataTable
                tableData={tab.queryState.data}
                sortColumn={tab.queryState.query.orderBy || ''}
                sortDirection={tab.queryState.query.orderDir === 'ASC' ? 'asc' : tab.queryState.query.orderDir === 'DESC' ? 'desc' : ''}
                headerMenu={tab.headerMenu}
                loading={tab.queryState.dataLoading}
                setHeaderMenu={(menu) =>
                  updateTab(tab.id, (t) => ({
                    ...t,
                    headerMenu: menu,
                  }))
                }
                setSortColumn={(col) =>
                  updateTab(tab.id, (t) => ({
                    ...t,
                    queryState: { ...t.queryState, query: { ...t.queryState.query, orderBy: col } },
                  }))
                }
                setSortDirection={(dir) =>
                  updateTab(tab.id, (t) => ({
                    ...t,
                    queryState: { ...t.queryState, query: { ...t.queryState.query, orderDir: dir === 'asc' ? 'ASC' : dir === 'desc' ? 'DESC' : undefined } },
                  }))
                }
                addFilter={addFilter}
                error={tab.queryState.error}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};



export default Tab;
