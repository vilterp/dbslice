import React, { useState } from "react";
import Tooltip from "../components/Tooltip";
import { abbreviateNumber } from "../utils";

type OtherValuesProps = {
  distinctCount: number;
  count: number;
  addFilter: (column: string, value: string) => void;
  columnName: string;
};

const OtherValues: React.FC<OtherValuesProps> = ({
  distinctCount,
  count,
  addFilter,
  columnName,
}) => {
  const [showOtherInput, setShowOtherInput] = React.useState(false);
  const [otherInputValue, setOtherInputValue] = React.useState("");
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    content: "",
  });
  const otherInputRef = React.useRef<HTMLInputElement>(null);
  const displayValue = `${distinctCount} other values`;

  // Checkbox in DiscreteHistogram is about 16px wide with marginRight: 6
  // So, left padding should be about 22px
  return (
    <div
      className="histogram-bar others-bar"
      onClick={() => {
        setShowOtherInput(true);
        setTimeout(() => otherInputRef.current?.focus(), 0);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          setShowOtherInput(true);
          setTimeout(() => otherInputRef.current?.focus(), 0);
        }
      }}
    >
      {!showOtherInput ? (
        <>
          <span
            className="others-label"
            onMouseEnter={(e) => {
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
              setTooltip({ visible: false, x: 0, y: 0, content: "" });
            }}
          >
            {displayValue}
          </span>
          <span className="bar-count">{abbreviateNumber(count)}</span>
        </>
      ) : (
        <input
          ref={otherInputRef}
          type="text"
          value={otherInputValue}
          onChange={(e) => setOtherInputValue(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && otherInputValue.trim()) {
              addFilter(columnName, otherInputValue.trim());
              setOtherInputValue("");
              setTimeout(() => setShowOtherInput(false), 0);
            } else if (e.key === "Escape") {
              setShowOtherInput(false);
              setOtherInputValue("");
            }
          }}
          className="others-input"
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
