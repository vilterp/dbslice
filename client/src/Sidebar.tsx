import React from 'react';
import { Column, HistogramData, Filter } from './api';

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
                  {isNumerical && currentRange?.isSelecting && (
                    <div className="range-selection-hint">
                      Click another bar to complete range selection
                    </div>
                  )}
                  {histograms[column.column_name].map((item, index) => {
                    const maxCount = Math.max(...(histograms[column.column_name] || []).map(h => h.count));
                    const barWidth = (item.count / maxCount) * 100;
                    const displayValue = item.bin_start !== undefined && item.bin_end !== undefined
                      ? `${item.bin_start.toFixed(1)}-${item.bin_end.toFixed(1)}`
                      : String(item[column.column_name]);
                    const isInRange = currentRange?.isSelecting &&
                      item.bin_start !== undefined &&
                      item.bin_start >= Math.min(currentRange.start, currentRange.end) &&
                      item.bin_end !== undefined &&
                      item.bin_end <= Math.max(currentRange.start, currentRange.end);
                    const isOthers = item.is_others === true;
                    return (
                      <div
                        key={index}
                        className={`histogram-bar ${isInRange ? 'in-range' : ''} ${isOthers ? 'others-bar' : ''}`}
                        onClick={() => {
                          if (isOthers) return;
                          if (isNumerical && item.bin_start !== undefined) {
                            handleRangeSelection(column.column_name, item);
                          } else {
                            addFilter(column.column_name, String(item[column.column_name]));
                          }
                        }}
                        style={{ cursor: isOthers ? 'default' : 'pointer' }}
                      >
                        <div className="bar-label">{displayValue}</div>
                        <div className="bar-container">
                          <div
                            className="bar-fill"
                            style={{ width: `${barWidth}%` }}
                          ></div>
                          <span className="bar-count">{item.count}</span>
                        </div>
                      </div>
                    );
                  })}
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
