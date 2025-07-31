import React from "react";
import FilterBar from "./FilterBar";
import Sidebar from "./Sidebar";
import TableHeader from "./TableHeader";
import HeaderMenu from "./HeaderMenu";
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
  removeFilter: (column: string) => void;
  toggleColumnCollapse: (columnName: string) => void;
  isNumericalColumn: (dataType: string) => boolean;
  handleRangeSelection: (columnName: string, item: HistogramData) => void;
  addFilter: (
    column: string,
    value: string,
    type?: "exact" | "range",
    min?: number,
    max?: number
  ) => void;
  updateTab: (tabId: string, updater: (tab: TabState) => TabState) => void;
}

const Tab: React.FC<TabProps> = ({
  tab,
  removeFilter,
  toggleColumnCollapse,
  isNumericalColumn,
  handleRangeSelection,
  addFilter,
  updateTab,
}) => (
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
              <div style={{ position: "relative" }}>
                <table>
                  <thead>
                    <tr>
                      <TableHeader
                        columns={Object.keys(tab.tableData[0])}
                        sortColumn={tab.sortColumn}
                        sortDirection={tab.sortDirection}
                        headerMenu={tab.headerMenu}
                        setHeaderMenu={(menu) =>
                          updateTab(tab.id, (t) => ({
                            ...t,
                            headerMenu: menu,
                          }))
                        }
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {tab.tableData.map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((value, cellIndex) => (
                          <td key={cellIndex}>{String(value)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <HeaderMenu
                  headerMenu={tab.headerMenu}
                  sortColumn={tab.sortColumn}
                  setSortColumn={(col) =>
                    updateTab(tab.id, (t) => ({
                      ...t,
                      sortColumn: col,
                    }))
                  }
                  sortDirection={tab.sortDirection}
                  setSortDirection={(dir) =>
                    updateTab(tab.id, (t) => ({
                      ...t,
                      sortDirection: dir as SortDirection,
                    }))
                  }
                  setHeaderMenu={(menu) =>
                    updateTab(tab.id, (t) => ({
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
);

export default Tab;
