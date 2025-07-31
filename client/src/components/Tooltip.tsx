import React from 'react';
import './Tooltip.css';

interface TooltipProps {
  visible: boolean;
  x: number;
  y: number;
  content: string;
}

const Tooltip: React.FC<TooltipProps> = ({ visible, x, y, content }) => {
  if (!visible) return null;

  return (
    <div 
      className="tooltip"
      style={{
        left: x,
        top: y,
      }}
    >
      {content}
    </div>
  );
};

export default Tooltip;