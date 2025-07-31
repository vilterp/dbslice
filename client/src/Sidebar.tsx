import React from 'react';
import { Column, HistogramData, Filter } from './api';
import Histogram from './Histogram';

interface RangeSelection {
  start: number;
  end: number;
  isSelecting: boolean;
}

interface SidebarProps {
  columns: Column[];
  histograms: { [key: string]: HistogramData[] };
  filters: Filter[];
  collapsedColumns: Set<string>;
  rangeSelections: { [key: string]: RangeSelection };
  toggleColumnCollapse: (columnName: string) => void;
  isNumericalColumn: (dataType: string) => boolean;
  handleRangeSelection: (columnName: string, item: HistogramData) => void;
  addFilter: (column: string, value: string, type?: 'exact' | 'range', min?: number, max?: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  columns,
  histograms,
  collapsedColumns,
  rangeSelections,
  toggleColumnCollapse,
  isNumericalColumn,
  handleRangeSelection,
  addFilter,
}) => (
  <div className="sidebar">
    <h3>Filters</h3>
    {columns.map(column => {
      const isCollapsed = collapsedColumns.has(column.column_name);
      const isNumerical = isNumericalColumn(column.data_type);
      const currentRange = rangeSelections[column.column_name];
      return (
        <div key={column.column_name} className="column-filter">
          <h4
            className="column-header"
            onClick={() => toggleColumnCollapse(column.column_name)}
          >
            <span className={`collapse-icon ${isCollapsed ? 'collapsed' : ''}`}>▼</span>
            {column.column_name}
            <span className="column-type">({column.data_type})</span>
          </h4>
          {!isCollapsed && (
            <div className="histogram">
              {!histograms[column.column_name] || !Array.isArray(histograms[column.column_name]) || histograms[column.column_name].length === 0 ? (
                <div className="histogram-loading">
                  {histograms[column.column_name] && !Array.isArray(histograms[column.column_name])
                    ? `Error: ${JSON.stringify(histograms[column.column_name])}`
                    : 'Loading histogram...'}
                </div>
              ) : (
                <>
                  <Histogram
                    columnName={column.column_name}
                    data={histograms[column.column_name]}
                    isNumerical={isNumerical}
                    currentRange={currentRange}
                    handleRangeSelection={handleRangeSelection}
                    addFilter={addFilter}
                  />
                </>
              )}
            </div>
          )}
        </div>
      );
    })}
  </div>
);

export default Sidebar;
