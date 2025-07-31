import React, { useState } from 'react';
import OtherValues from './OtherValues';
import { HistogramData, Filter } from '../api';
import { abbreviateNumber } from '../utils';
import Tooltip from '../components/Tooltip';

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
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
  
  // Exclude 'others' from scaling calculation
  const nonOthersData = data.filter(h => !h.is_others);
  const maxCount = nonOthersData.length > 0 ? Math.max(...nonOthersData.map(h => h.count)) : 1;
  
  // Data is assumed to be sorted by the backend
  const sortedData = data;
  return (
    <div className="discrete-histogram">
      {sortedData.map((item, index) => {
        const barWidth = (item.count / maxCount) * 100;
        const isOthers = item.is_others === true;
        const value = String(item[columnName]);
        const checked = filters.some((f: Filter) => f.column === columnName && f.value === value);
        let displayValue;
        if (isOthers) {
          displayValue = `${abbreviateNumber(item.count)} other value${item.count === 1 ? '' : 's'}`;
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
            <div style={{ 
              position: 'relative', 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center',
              minWidth: 0 // Allow flex item to shrink
            }}>
              <div
                className="bar-fill"
                style={{
                  width: `${barWidth}%`,
                  minWidth: 16,
                  height: 24,
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  fontWeight: 500,
                  borderRadius: 2,
                  zIndex: 1,
                  boxSizing: 'border-box',
                }}
              />
              <span 
                style={{ 
                  position: 'relative', 
                  zIndex: 2, 
                  paddingLeft: 6,
                  paddingRight: 6,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0, // Allow text to shrink
                  flexShrink: 1 // Allow this text to shrink
                }}
                onMouseEnter={(e) => {
                  const element = e.currentTarget;
                  const isOverflowing = element.scrollWidth > element.clientWidth;
                  if (isOverflowing) {
                    const rect = element.getBoundingClientRect();
                    setTooltip({
                      visible: true,
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                      content: displayValue
                    });
                  }
                }}
                onMouseLeave={() => {
                  setTooltip({ visible: false, x: 0, y: 0, content: '' });
                }}
              >
                {displayValue}
              </span>
            </div>
            <span 
              className="bar-count" 
              style={{ 
                marginLeft: 8, 
                minWidth: 30, 
                textAlign: 'right', 
                color: '#999', 
                fontSize: 12, 
                flexShrink: 0 // Don't let the count shrink
              }}
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
