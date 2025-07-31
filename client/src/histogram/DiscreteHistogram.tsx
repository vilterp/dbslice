import React, { useState } from 'react';
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
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherInputValue, setOtherInputValue] = useState("");
  const otherInputRef = React.useRef<HTMLInputElement>(null);
  const maxCount = Math.max(...data.map(h => h.count));
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
            <div
              key={index}
              className="histogram-bar discrete-bar others-bar"
              style={{ display: 'flex', alignItems: 'center', minHeight: 24, cursor: 'pointer', outline: 'none' }}
              onClick={() => {
                setShowOtherInput(true);
                setTimeout(() => otherInputRef.current?.focus(), 0);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setShowOtherInput(true);
                  setTimeout(() => otherInputRef.current?.focus(), 0);
                }
              }}
            >
              <div
                className="bar-fill"
                style={{
                  width: `${barWidth}%`,
                  minWidth: 16,
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
              {showOtherInput && (
                <input
                  ref={otherInputRef}
                  type="text"
                  value={otherInputValue}
                  onChange={e => setOtherInputValue(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && otherInputValue.trim()) {
                      addFilter(columnName, otherInputValue.trim());
                      setShowOtherInput(false);
                      setOtherInputValue("");
                    } else if (e.key === 'Escape') {
                      setShowOtherInput(false);
                      setOtherInputValue("");
                    }
                  }}
                  style={{ marginLeft: 8, fontSize: 14, padding: '2px 6px', borderRadius: 4, border: '1px solid #ccc', minWidth: 80 }}
                  placeholder="Type value..."
                />
              )}
            </div>
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
