import "./Sidebar.css";
import React from 'react';
import { Filter, Query } from '../../src/types';
import { Column } from './api';
import Histogram from './histogram/Histogram';

interface SidebarProps {
  columns: Column[];
  query: Query;
  collapsedColumns: Set<string>;
  toggleColumnCollapse: (columnName: string) => void;
  isNumericalColumn: (dataType: string) => boolean;
  addFilter: (column: string, value: string, type?: 'exact' | 'range', min?: number, max?: number) => void;
  removeFilter: (column: string, value: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  columns,
  query,
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
              {column.no_histogram ? (
                <div style={{
                  padding: '10px',
                  textAlign: 'center',
                  color: '#666',
                  fontStyle: 'italic',
                  fontSize: '14px'
                }}>
                  Histogram disabled for this column
                </div>
              ) : (
                <Histogram
                  columnName={column.column_name}
                  column={column}
                  query={query}
                  isNumerical={isNumerical}
                  addFilter={addFilter}
                  removeFilter={removeFilter}
                />
              )}
            </div>
          )}
        </div>
      );
    })}
  </div>
);

export default Sidebar;
