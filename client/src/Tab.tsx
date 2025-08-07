import { NUMERICAL_COLUMN_TYPES } from '../../src/types';
import React from "react";
import QueryBar from "./QueryBar/QueryBar";
import Sidebar from "./Sidebar";
import DataTable from "./DataTable/DataTable";
import { abbreviateNumber } from "./utils";
import { Column } from "./api";
import { QueryState } from './clientTypes';
import { Database } from '../../src/database';

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
  database: Database;
  onForeignKeyNavigation?: (targetTable: string, targetColumn: string, value: any) => void;
  onReverseForeignKeyNavigation?: (targetTable: string, targetColumn: string, value: any) => void;
  onJoinWithTable?: (currentTable: string, currentFilters: any[], joinColumn: string, targetTable: string, targetColumn: string) => void;
}

const Tab: React.FC<TabProps> = ({ tab, updateTab, tables, database, onForeignKeyNavigation, onReverseForeignKeyNavigation, onJoinWithTable }) => {
  // Helper function to update query state
  const updateQuery = (updater: (query: typeof tab.queryState.query) => typeof tab.queryState.query) => {
    updateTab(tab.id, (tab) => ({
      ...tab,
      queryState: {
        ...tab.queryState,
        query: updater(tab.queryState.query),
      },
    }));
  };

  // Add filter for this tab
  const addFilter = (
    column: string,
    value: string,
    type: "exact" | "range" = "exact",
    min?: number,
    max?: number
  ) => {
    updateQuery((query) => {
      const existingFilterIndex = query.filters.findIndex((f) => f.column === column);
      let newFilters;
      
      const newFilter = type === "exact" 
        ? { type: "exact" as const, column, value }
        : { type: "range" as const, column, min: min!, max: max! };
      
      if (existingFilterIndex >= 0) {
        newFilters = [...query.filters];
        newFilters[existingFilterIndex] = newFilter;
      } else {
        newFilters = [...query.filters, newFilter];
      }
      
      return { ...query, filters: newFilters };
    });
  };

  const removeFilter = (column: string) => {
    updateQuery((query) => ({
      ...query,
      filters: query.filters.filter((f) => f.column !== column),
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
        query: {
          ...tab.queryState.query,
          tableName,
          filters: [], // Clear filters when changing tables
          orderBy: "",
          orderDir: undefined,
        },
        state: { type: "idle" }, // Reset state when changing tables
      },
      columns: [], // Clear columns when changing tables
    }));
  };

  const handleJoinWithTable = (joinColumn: string, targetTable: string, targetColumn: string) => {
    if (onJoinWithTable) {
      onJoinWithTable(tab.queryState.query.tableName, tab.queryState.query.filters, joinColumn, targetTable, targetColumn);
    }
  };

  return (
    <div className="main-content">
      <QueryBar 
        filters={tab.queryState.query.filters} 
        removeFilter={removeFilter}
        tables={tables}
        selectedTable={tab.queryState.query.tableName}
        onTableSelect={handleTableSelect}
        steps={tab.queryState.query.steps}
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
              query={tab.queryState.query}
              collapsedColumns={tab.collapsedColumns}
              toggleColumnCollapse={toggleColumnCollapse}
              isNumericalColumn={isNumericalColumn}
              addFilter={addFilter}
              removeFilter={removeFilter}
              database={database}
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
                          columns={tab.columns}
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
                            updateQuery((query) => ({ ...query, orderBy: col }))
                          }
                          setSortDirection={(dir) =>
                            updateQuery((query) => ({ 
                              ...query, 
                              orderDir: dir === 'asc' ? 'ASC' : dir === 'desc' ? 'DESC' : undefined 
                            }))
                          }
                          addFilter={addFilter}
                          onNavigateToForeignKey={onForeignKeyNavigation}
                          onNavigateToReferencingTable={onReverseForeignKeyNavigation}
                          onJoinWithTable={handleJoinWithTable}
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
