import React, { useState } from 'react';
import { abbreviateNumber } from '../utils';
import Tooltip from '../components/Tooltip';

type OtherValuesProps = {
  barWidth: number;
  displayValue: string;
  count: number;
  addFilter: (column: string, value: string) => void;
  columnName: string;
};

const OtherValues: React.FC<OtherValuesProps> = ({
  barWidth,
  displayValue,
  count,
  addFilter,
  columnName,
}) => {
  const [showOtherInput, setShowOtherInput] = React.useState(false);
  const [otherInputValue, setOtherInputValue] = React.useState("");
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
  const otherInputRef = React.useRef<HTMLInputElement>(null);

  // Checkbox in DiscreteHistogram is about 16px wide with marginRight: 6
  // So, left padding should be about 22px
  return (
    <div
      className="histogram-bar others-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: 24,
        width: '100%',
        boxSizing: 'border-box',
        cursor: 'pointer',
        outline: 'none',
      }}
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
      {!showOtherInput ? (
        <>
          <span
            style={{
              paddingLeft: 22,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: 1,
              color: '#888',
              fontStyle: 'italic',
            }}
            onMouseEnter={e => {
              const element = e.currentTarget;
              const isOverflowing = element.scrollWidth > element.clientWidth;
              if (isOverflowing) {
                const rect = element.getBoundingClientRect();
                setTooltip({
                  visible: true,
                  x: rect.left + rect.width / 2,
                  y: rect.top,
                  content: displayValue,
                });
              }
            }}
            onMouseLeave={() => {
              setTooltip({ visible: false, x: 0, y: 0, content: '' });
            }}
          >
            {displayValue}
          </span>
        </>
      ) : (
        <input
          ref={otherInputRef}
          type="text"
          value={otherInputValue}
          onChange={e => setOtherInputValue(e.target.value)}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Enter' && otherInputValue.trim()) {
              addFilter(columnName, otherInputValue.trim());
              setOtherInputValue("");
              setTimeout(() => setShowOtherInput(false), 0);
            } else if (e.key === 'Escape') {
              setShowOtherInput(false);
              setOtherInputValue("");
            }
          }}
          style={{
            flex: 1,
            fontSize: 14,
            padding: '2px 6px',
            borderRadius: 4,
            border: '1px solid #ccc',
            minWidth: 0,
          }}
          placeholder="Type value..."
        />
      )}
      <Tooltip
        visible={tooltip.visible}
        x={tooltip.x}
        y={tooltip.y}
        content={tooltip.content}
      />
    </div>
  );
};

export default OtherValues;
