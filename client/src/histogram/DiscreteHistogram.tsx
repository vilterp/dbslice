import React, { useState } from 'react';
import OtherValues from './OtherValues';
import { HistogramData } from '../api';
import { abbreviateNumber } from '../utils';
import Tooltip from '../components/Tooltip';
import { useTooltip } from '../components/Tooltip';
import { Filter } from '../../../src/common';

// Configuration constants (should match api.ts)
const DEFAULT_TOP_N_CATEGORIES = 5;
const BAR_HEIGHT = 24;

type DiscreteHistogramProps = {
  columnName: string;
  data: HistogramData[];
  error?: string;
  isEmpty?: boolean;
  addFilter: (column: string, value: string, type?: 'exact' | 'range', min?: number, max?: number) => void;
  removeFilter: (column: string, value: string) => void;
  filters?: Filter[];
};

const DiscreteHistogram: React.FC<DiscreteHistogramProps> = ({
  columnName,
  data,
  error,
  isEmpty,
  addFilter,
  removeFilter,
  filters = [],
}) => {
  const { tooltip, showTooltip, hideTooltip } = useTooltip();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Calculate proper height: (DEFAULT_TOP_N_CATEGORIES + 1 for "others") * BAR_HEIGHT
  const calculatedHeight = (DEFAULT_TOP_N_CATEGORIES + 1) * BAR_HEIGHT;
  
  if (error) {
    return (
      <div className="histogram-error" style={{ minHeight: `${calculatedHeight}px` }}>
        <div className="histogram-error-title">Error loading histogram</div>
        <div>{error}</div>
      </div>
    );
  }
  
  if (isEmpty || !data || data.length === 0) {
    return (
      <div className="histogram-empty" style={{ minHeight: `${calculatedHeight}px` }}>
        No data available for this column
      </div>
    );
  }
  
  // Exclude 'others' from scaling calculation
  const nonOthersData = data.filter(h => !h.is_others);
  const maxCount = nonOthersData.length > 0 ? nonOthersData.reduce((max, h) => Math.max(max, h.count), 0) : 1;
  
  // Data is assumed to be sorted by the backend
  const sortedData = data;
  return (
    <div className="discrete-histogram" style={{ minHeight: `${calculatedHeight}px` }}>
      {sortedData.map((item, index) => {
        const barWidth = (item.count / maxCount) * 100;
        const isOthers = item.is_others === true;
        const value = String(item[columnName]);
        const checked = filters.some((f: Filter) => f.column === columnName && f.value === value);
        let displayValue;
        if (isOthers) {
          // Use distinct_count for the "X other values" text, not the row count
          const distinctCount = item.distinct_count || item.count;
          displayValue = `${abbreviateNumber(distinctCount)} other value${distinctCount === 1 ? '' : 's'}`;
        } else {
          displayValue = value;
        }
        if (isOthers) {
          return (
            <OtherValues
              key={index}
              distinctCount={item.distinct_count || item.count}
              count={item.count}
              addFilter={addFilter}
              columnName={columnName}
            />
          );
        }
        // Render normal bars
        return (
          <div
            key={index}
            className={`histogram-bar discrete-bar${checked ? ' checked' : ''}`}
            onClick={() => {
              if (checked) {
                removeFilter(columnName, value);
              } else {
                addFilter(columnName, value);
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                if (checked) {
                  removeFilter(columnName, value);
                } else {
                  addFilter(columnName, value);
                }
              }
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <input
              type="checkbox"
              checked={checked}
              readOnly
              tabIndex={-1}
              className="histogram-checkbox"
            />
            <div className="bar-label-container">
              <div
                className={`bar-fill${hoveredIndex === index ? ' hovered' : ''}`}
                style={{ width: `${barWidth}%` }}
              />
              <span 
                className="bar-label"
                onMouseEnter={(e) => {
                  const element = e.currentTarget;
                  const isOverflowing = element.scrollWidth > element.clientWidth;
                  if (isOverflowing) {
                    const rect = element.getBoundingClientRect();
                    showTooltip(rect.left + rect.width / 2, rect.top, displayValue);
                  }
                }}
                onMouseLeave={hideTooltip}
              >
                {displayValue}
              </span>
            </div>
            <span 
              className="bar-count"
            >
              {abbreviateNumber(item.count)}
            </span>
          </div>
        );
      })}
      <Tooltip 
        visible={tooltip.visible}
        x={tooltip.x}
        y={tooltip.y}
        content={tooltip.content}
      />
    </div>
  );
};


export default DiscreteHistogram;
