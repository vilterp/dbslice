import React from 'react';
import OtherValues from './OtherValues';
import { HistogramData, Filter } from '../api';

type DiscreteHistogramProps = {
  columnName: string;
  data: HistogramData[];
  addFilter: (column: string, value: string, type?: 'exact' | 'range', min?: number, max?: number) => void;
  removeFilter: (column: string, value: string) => void;
  filters?: Filter[];
};

const DiscreteHistogram: React.FC<DiscreteHistogramProps> = ({
  columnName,
  data,
  addFilter,
  removeFilter,
  filters = [],
}) => {
  // Exclude 'others' from scaling calculation
  const nonOthersData = data.filter(h => !h.is_others);
  const maxCount = nonOthersData.length > 0 ? Math.max(...nonOthersData.map(h => h.count)) : 1;
  
  // Sort by count descending, then alphabetically by value if counts are equal, but always put 'others' at the end
  const sortedData = [...data].sort((a, b) => {
    if (a.is_others) return 1;
    if (b.is_others) return -1;
    if (b.count !== a.count) return b.count - a.count;
    const aVal = String(a[columnName]);
    const bVal = String(b[columnName]);
    return aVal.localeCompare(bVal);
  });
  return (
    <div className="discrete-histogram">
      {sortedData.map((item, index) => {
        const barWidth = (item.count / maxCount) * 100;
        const isOthers = item.is_others === true;
        const value = String(item[columnName]);
        const checked = filters.some((f: Filter) => f.column === columnName && f.value === value);
        let displayValue;
        if (isOthers) {
          displayValue = `${item.count} other value${item.count === 1 ? '' : 's'}`;
        } else {
          displayValue = value;
        }
        if (isOthers) {
          return (
            <OtherValues
              key={index}
              barWidth={barWidth}
              displayValue={displayValue}
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
            className={`histogram-bar discrete-bar`}
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
            style={{
              display: 'flex',
              alignItems: 'center',
              minHeight: 24,
              cursor: 'pointer',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              readOnly
              tabIndex={-1}
              style={{ marginRight: 6, pointerEvents: 'none' }}
            />
            <div
              className="bar-fill"
              style={{
                width: `${barWidth}%`,
                minWidth: 16,
                display: 'flex',
                alignItems: 'center',
                padding: '0 6px',
                position: 'relative',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                fontWeight: 500,
                borderRadius: 2,
                flex: '0 1 auto',
                zIndex: 1,
                boxSizing: 'border-box',
              }}
              title={displayValue}
            >
              <span style={{ position: 'relative', zIndex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{displayValue}</span>
            </div>
            <span className="bar-count" style={{ marginLeft: 8, minWidth: 30, textAlign: 'right', color: '#999', fontSize: 12, flex: '0 0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.count}</span>
          </div>
        );
      })}
    </div>
  );
};


export default DiscreteHistogram;
