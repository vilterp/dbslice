import "./QueryBar.css";
import React from 'react';
import { Filter } from '../../src/types';

interface QueryBarProps {
  filters: Filter[];
  removeFilter: (column: string) => void;
  tables: Array<{ table_name: string }>;
  selectedTable: string;
  onTableSelect: (tableName: string) => void;
}

const QueryBar: React.FC<QueryBarProps> = ({ filters, removeFilter, tables, selectedTable, onTableSelect }) => (
  <div className="query-bar">
    <div className="table-selector">
      <label htmlFor="table-select">Table:</label>
      <select 
        id="table-select"
        value={selectedTable} 
        onChange={(e) => onTableSelect(e.target.value)}
      >
        <option value="">Select a table...</option>
        {tables.map(table => (
          <option key={table.table_name} value={table.table_name}>
            {table.table_name}
          </option>
        ))}
      </select>
    </div>
    <div className="filters">
      {filters.map(filter => (
        <div key={filter.column} className="filter-tag">
          <span>
            {filter.column}: {
              filter.type === 'exact' ? filter.value : `${filter.min} - ${filter.max}`
            }
          </span>
          <button onClick={() => removeFilter(filter.column)} className="remove-filter">
            ×
          </button>
        </div>
      ))}
    </div>
  </div>
);

export default QueryBar;
