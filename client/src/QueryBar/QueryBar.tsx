import "./QueryBar.css";
import React from 'react';
import { Filter, QueryStep } from '../../../src/types';
import QuerySection from './QuerySection';

interface QueryBarProps {
  filters: Filter[];
  removeFilter: (column: string) => void;
  tables: Array<{ table_name: string }>;
  selectedTable: string;
  steps?: QueryStep[];
}

const QueryBar: React.FC<QueryBarProps> = ({
  filters,
  removeFilter,
  tables,
  selectedTable,
  steps = []
}) => {
  if (filters.length === 0 && steps.length === 0) return null;

  return (
    <div className="query-bar">
      {steps.length > 0 && (
        <div className="query-steps">
          {steps.map((step) => (
            <QuerySection
              key={step.name}
              title={step.name}
              tableName={step.tableName}
              tables={tables}
              filters={step.filters}
            />
          ))}
        </div>
      )}
      
      <QuerySection
        tableName={selectedTable}
        filters={filters}
        tables={tables}
        onRemoveFilter={removeFilter}
      />
    </div>
  );
};

export default QueryBar;