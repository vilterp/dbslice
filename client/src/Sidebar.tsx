import "./Sidebar.css";
import React from 'react';
import { Column, Filter } from './api';
import Histogram from './histogram/Histogram';

interface SidebarProps {
  columns: Column[];
  selectedTable: string;
  filters: Filter[];
  collapsedColumns: Set<string>;
  toggleColumnCollapse: (columnName: string) => void;
  isNumericalColumn: (dataType: string) => boolean;
  addFilter: (column: string, value: string, type?: 'exact' | 'range', min?: number, max?: number) => void;
  removeFilter: (column: string, value: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  columns,
  selectedTable,
  filters,
  collapsedColumns,
  toggleColumnCollapse,
  isNumericalColumn,
  addFilter,
  removeFilter,
}) => (
  <div className="sidebar">
    <h3>Filters</h3>
    {columns.map(column => {
      const isCollapsed = collapsedColumns.has(column.column_name);
      const isNumerical = isNumericalColumn(column.data_type);
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
              <Histogram
                columnName={column.column_name}
                column={column}
                selectedTable={selectedTable}
                isNumerical={isNumerical}
                addFilter={addFilter}
                removeFilter={removeFilter}
                filters={filters}
              />
            </div>
          )}
        </div>
      );
    })}
  </div>
);

export default Sidebar;
