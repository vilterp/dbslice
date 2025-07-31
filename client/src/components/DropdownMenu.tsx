import React from "react";

/**
 * DropdownMenu component to handle overflow logic and positioning.
 * Can be used for any dropdown that needs to stay within the viewport.
 */
interface DropdownMenuProps {
  children: React.ReactNode;
  disablePositioning?: boolean;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ children, disablePositioning }) => {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [style, setStyle] = React.useState<React.CSSProperties>(
    disablePositioning
      ? {
          background: "white",
          border: "1px solid #ccc",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          zIndex: 10,
          minWidth: 180,
          maxWidth: 320,
          maxHeight: '60vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }
      : {
          position: "absolute",
          top: "100%",
          left: "auto",
          right: 0,
          background: "white",
          border: "1px solid #ccc",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          zIndex: 10,
          minWidth: 180,
          maxWidth: 320,
          maxHeight: '60vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }
  );

  React.useLayoutEffect(() => {
    if (disablePositioning) return;
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const overflowLeft = rect.left < 0;
      const overflowRight = rect.right > window.innerWidth;
      let newStyle = { ...style };
      if (overflowLeft) {
        newStyle.left = 0;
        newStyle.right = 'auto';
      } else if (overflowRight) {
        newStyle.right = 0;
        newStyle.left = 'auto';
      }
      setStyle(newStyle);
    }
  }, [children, disablePositioning]);

  return (
    <div ref={menuRef} style={style} tabIndex={-1}>
      {children}
    </div>
  );
};

export default DropdownMenu;
