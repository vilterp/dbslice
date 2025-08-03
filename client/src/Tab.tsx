import { NUMERICAL_COLUMN_TYPES } from '../../src/types';
import React from "react";
import QueryBar from "./QueryBar";
import Sidebar from "./Sidebar";
import DataTable from "./DataTable/DataTable";
import { abbreviateNumber } from "./utils";
import { Column } from "./api";
import { QueryState } from './clientTypes';

export type TabState = {
  id: string;
  name?: string;
  queryState: QueryState;
  columns: Column[];
  collapsedColumns: Set<string>;
  headerMenu: { column: string; x: number; y: number } | null;
};

interface TabProps {
  tab: TabState;
  updateTab: (tabId: string, updater: (tab: TabState) => TabState) => void;
  tables: Array<{ table_name: string }>;
}

const Tab: React.FC<TabProps> = ({ tab, updateTab, tables }) => {
  // Add filter for this tab
  const addFilter = (
    column: string,
    value: string,
    type: "exact" | "range" = "exact",
    min?: number,
    max?: number
  ) => {
    updateTab(tab.id, (tab) => {
      const existingFilterIndex = tab.queryState.query.filters.findIndex((f) => f.column === column);
      let newFilters;
      
      const newFilter = type === "exact" 
        ? { type: "exact" as const, column, value }
        : { type: "range" as const, column, min: min!, max: max! };
      
      if (existingFilterIndex >= 0) {
        newFilters = [...tab.queryState.query.filters];
        newFilters[existingFilterIndex] = newFilter;
      } else {
        newFilters = [...tab.queryState.query.filters, newFilter];
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

  const handleTableSelect = (tableName: string) => {
    updateTab(tab.id, (tab) => ({
      ...tab,
      queryState: {
        ...tab.queryState,
        query: {
          ...tab.queryState.query,
          tableName,
          filters: [], // Clear filters when changing tables
        },
        state: { type: "idle" }, // Reset state when changing tables
      },
      columns: [], // Clear columns when changing tables
    }));
  };

  return (
    <div className="main-content">
      <QueryBar 
        filters={tab.queryState.query.filters} 
        removeFilter={removeFilter}
        tables={tables}
        selectedTable={tab.queryState.query.tableName}
        onTableSelect={handleTableSelect}
      />
      <div className="content-wrapper">
        {!tab.queryState.query.tableName ? (
          <div className="no-table-selected">
            <h3>No table selected</h3>
            <p>Please select a table from the dropdown above to begin exploring your data.</p>
          </div>
        ) : (
          <>
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
              {(() => {
                switch (tab.queryState.state.type) {
                  case "idle":
                    return <div className="idle">No data loaded</div>;
                  case "loading":
                    return <div className="loading">Loading...</div>;
                  case "error":
                    return <div className="error">Error: {tab.queryState.state.error}</div>;
                  case "loaded":
                    return (
                      <div className="data-table">
                        <h3>Data ({`${abbreviateNumber(tab.queryState.state.total)} rows`})</h3>
                        <DataTable
                          tableData={tab.queryState.state.data}
                          sortColumn={tab.queryState.query.orderBy || ''}
                          sortDirection={tab.queryState.query.orderDir === 'ASC' ? 'asc' : tab.queryState.query.orderDir === 'DESC' ? 'desc' : ''}
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
                        />
                      </div>
                    );
                }
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
};



export default Tab;
