import React from 'react';
import { Filter as FilterType } from '../../../src/types';

interface FilterProps {
  filter: FilterType;
  onRemove: (column: string) => void;
}

const Filter: React.FC<FilterProps> = ({ filter, onRemove }) => {
  const renderFilterValue = (filter: FilterType) => {
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
    <div className="filter-tag">
      <span>
        {filter.column}: {renderFilterValue(filter)}
      </span>
      <button onClick={() => onRemove(filter.column)} className="remove-filter">
        ×
      </button>
    </div>
  );
};

export default Filter;