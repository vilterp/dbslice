import "./QueryBar.css";
import React from 'react';
import { Filter, QueryStep } from '../../src/types';

interface QueryBarProps {
  filters: Filter[];
  removeFilter: (column: string) => void;
  tables: Array<{ table_name: string }>;
  selectedTable: string;
  onTableSelect: (tableName: string) => void;
  steps?: QueryStep[];
}

const QueryBar: React.FC<QueryBarProps> = ({ filters, removeFilter, tables, selectedTable, onTableSelect, steps = [] }) => {
  const renderFilterValue = (filter: Filter) => {
    switch (filter.type) {
      case 'exact':
        return filter.value;
      case 'range':
        return `${filter.min} - ${filter.max}`;
      case 'in':
        return `IN ${filter.stepName}`;
    }
  };

  return (
    <div className="query-bar">
      {steps.length > 0 && (
        <div className="query-steps">
          <div className="steps-header">Query Steps:</div>
          {steps.map((step, index) => (
            <div key={step.name} className="query-step">
              <div className="step-name">
                {index + 1}. {step.name}:
              </div>
              <div className="step-query">
                SELECT * FROM {step.tableName}
                {step.filters.length > 0 && (
                  <span className="step-filters">
                    {' WHERE '}
                    {step.filters.map((stepFilter, i) => (
                      <span key={stepFilter.column}>
                        {i > 0 && ' AND '}
                        {stepFilter.column} = {renderFilterValue(stepFilter)}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="main-query">
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
                {filter.column}: {renderFilterValue(filter)}
              </span>
              <button onClick={() => removeFilter(filter.column)} className="remove-filter">
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QueryBar;
