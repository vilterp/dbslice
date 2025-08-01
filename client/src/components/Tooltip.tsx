
import React, { useEffect, useRef, useState } from 'react';
import './Tooltip.css';

export type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  content: string;
};

export function useTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    content: "",
  });

  const showTooltip = (x: number, y: number, content: string) => {
    setTooltip({ visible: true, x, y, content });
  };

  const hideTooltip = () => {
    setTooltip({ visible: false, x: 0, y: 0, content: "" });
  };

  return { tooltip, showTooltip, hideTooltip, setTooltip };
}

interface TooltipProps {
  visible: boolean;
  x: number;
  y: number;
  content: string;
}

const Tooltip: React.FC<TooltipProps> = ({ visible, x, y, content }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y, transform: 'translate(-50%, -100%)' });

  useEffect(() => {
    if (!visible || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Start with default positioning (centered horizontally, above anchor)
    let newX = x;
    let newY = y;
    let transform = 'translate(-50%, -100%)';
    
    // Calculate tooltip boundaries with default positioning
    const tooltipWidth = rect.width;
    const tooltipHeight = rect.height;
    const leftEdge = x - tooltipWidth / 2;
    const rightEdge = x + tooltipWidth / 2;
    const topEdge = y - tooltipHeight - 8; // 8px margin from CSS
    const bottomEdge = y;
    
    // Adjust horizontal position if tooltip extends beyond viewport
    if (leftEdge < 0) {
      // Tooltip extends beyond left edge - align to left edge of anchor
      transform = 'translate(0%, -100%)';
    } else if (rightEdge > viewportWidth) {
      // Tooltip extends beyond right edge - align to right edge of anchor
      transform = 'translate(-100%, -100%)';
    }
    
    // Adjust vertical position if tooltip extends beyond viewport
    if (topEdge < 0) {
      // Tooltip extends beyond top edge - position below anchor instead
      if (transform.includes('-100%')) {
        transform = transform.replace('-100%', '20px'); // Position 20px below anchor
      } else if (transform.includes('0%')) {
        transform = transform.replace('-100%', '20px');
      } else {
        transform = transform.replace('-100%', '20px');
      }
    } else if (bottomEdge > viewportHeight) {
      // This shouldn't happen with default above positioning, but handle just in case
      // Keep above positioning but move up if needed
      const overflow = bottomEdge - viewportHeight;
      newY = y - overflow - 10; // Add some padding
    }
    
    setAdjustedPosition({ x: newX, y: newY, transform });
  }, [visible, x, y, content]);

  if (!visible) return null;

  return (
    <div 
      ref={tooltipRef}
      className="tooltip"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        transform: adjustedPosition.transform,
      }}
    >
      {content.split('\n').map((line, index) => (
        <div key={index}>{line}</div>
      ))}
    </div>
  );
};

export default Tooltip;