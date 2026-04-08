import React from 'react';
import { Filter as FilterType } from '../../../src/types';

interface FilterProps {
  filter: FilterType;
  onRemove: (column: string) => void;
  onToggleNegation?: (column: string) => void;
}

const Filter: React.FC<FilterProps> = ({ filter, onRemove, onToggleNegation }) => {
  const negated = filter.negated ?? false;

  const operator = (() => {
    switch (filter.type) {
      case 'exact':    return negated ? '≠' : '=';
      case 'contains': return negated ? '!~' : '~';
      case 'range':    return negated ? '∉' : '∈';
      case 'in':       return negated ? '∉' : '∈';
    }
  })();

  const renderValue = (filter: FilterType) => {
    switch (filter.type) {
      case 'exact':
        return filter.value;
      case 'contains':
        return `"${filter.value}"`;
      case 'range':
        return `${filter.min} – ${filter.max}`;
      case 'in':
        return (
          <span style={{ color: '#6f42c1', fontWeight: 600 }}>
            {filter.stepName}
          </span>
        );
    }
  };

  return (
    <div className={`filter-tag${negated ? ' filter-tag-negated' : ''}`}>
      <span>
        {filter.column}{' '}
        <button
          className="filter-operator"
          onClick={() => onToggleNegation?.(filter.column)}
          title="Toggle include/exclude"
        >
          {operator}
        </button>
        {' '}{renderValue(filter)}
      </span>
      <button onClick={() => onRemove(filter.column)} className="remove-filter">
        ×
      </button>
    </div>
  );
};

export default Filter;
