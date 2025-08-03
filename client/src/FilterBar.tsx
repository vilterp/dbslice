import "./FilterBar.css";
import React from 'react';
import { Filter } from '../../src/common';

interface FilterBarProps {
  filters: Filter[];
  removeFilter: (column: string) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, removeFilter }) => (
  <div className="filter-bar">
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
);

export default FilterBar;
