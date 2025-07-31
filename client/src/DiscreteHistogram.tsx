import React from 'react';
import { HistogramData, Filter } from './api';

type DiscreteHistogramProps = {
  columnName: string;
  data: HistogramData[];
  addFilter: (column: string, value: string, type?: 'exact' | 'range', min?: number, max?: number) => void;
  filters?: Filter[];
};

const DiscreteHistogram: React.FC<DiscreteHistogramProps> = ({
  columnName,
  data,
  addFilter,
  filters = [],
}) => {
  const maxCount = Math.max(...data.map(h => h.count));
  return (
    <div className="discrete-histogram">
      {data.map((item, index) => {
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
        return (
          <div
            key={index}
            className={`histogram-bar discrete-bar ${isOthers ? 'others-bar' : ''}`}
            style={{ display: 'flex', alignItems: 'center', minHeight: 24 }}
          >
            {!isOthers && (
              <input
                type="checkbox"
                checked={checked}
                onChange={() => addFilter(columnName, value)}
                style={{ marginRight: 6 }}
              />
            )}
            <div
              className="bar-fill"
              style={{
                width: `${barWidth}%`,
                minWidth: 16,
                background: checked ? '#0066cc' : '#662d91',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                padding: '0 6px',
                position: 'relative',
                overflow: 'visible',
                whiteSpace: 'nowrap',
                fontWeight: 500,
                borderRadius: 2,
                flex: '0 0 auto',
                zIndex: 1,
              }}
              title={displayValue}
            >
              <span style={{ position: 'relative', zIndex: 2 }}>{displayValue}</span>
            </div>
            <span className="bar-count" style={{ marginLeft: 'auto', minWidth: 30, textAlign: 'right', color: '#999', fontSize: 12 }}>{item.count}</span>
          </div>
        );
      })}
    </div>
  );
};

export default DiscreteHistogram;
