import React from 'react';
import { Filter as FilterType } from '../../../src/types';
import Filter from './Filter';

interface QuerySectionProps {
  title?: string;
  tableName: string;
  filters: FilterType[];
  tables: Array<{ table_name: string }>;
  onTableSelect?: (tableName: string) => void;
  onRemoveFilter?: (column: string) => void;
}

const QuerySection: React.FC<QuerySectionProps> = ({ 
  title,
  tableName, 
  filters, 
  tables, 
  onTableSelect, 
  onRemoveFilter
}) => {
  return (
    <div className="query-section">
      <div className="query-content">
        {title && <div className="query-section-title">{title}<span className="colon">:</span></div>}
        
        <div className="table-selector">
          <label htmlFor="table-select">Table:</label>
          <select 
            id="table-select"
            value={tableName} 
            onChange={(e) => onTableSelect?.(e.target.value)}
          >
            <option value="">Select a table...</option>
            {tables.map(table => (
              <option key={table.table_name} value={table.table_name}>
                {table.table_name}
              </option>
            ))}
          </select>
        </div>
        
        {filters.length > 0 && (
          <div className="filters">
            {filters.map(filter => (
              <Filter 
                key={filter.column} 
                filter={filter} 
                onRemove={onRemoveFilter || (() => {})} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuerySection;