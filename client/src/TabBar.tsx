import React from "react";

interface TabBarProps {
  tabs: Array<{
    id: string;
    table: string;
  }>;
  selectedTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  tables: Array<{ table_name: string }>;
  onAddTab: (table: string) => void;
}


const TabBar: React.FC<TabBarProps> = ({ tabs, selectedTabId, onTabClick, onTabClose, tables, onAddTab }) => {
  const [showDropdown, setShowDropdown] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener("mousedown", handleClick);
    } else {
      document.removeEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDropdown]);

  return (
    <div
      className="tab-bar"
      style={{
        display: "flex",
        background: "#f8f9fa",
        borderBottom: "1px solid #e0e0e0",
        alignItems: "center",
      }}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={tab.id === selectedTabId ? "tab active" : "tab"}
          style={{
            padding: "0.5rem 1rem",
            borderRight: "1px solid #e0e0e0",
            background: tab.id === selectedTabId ? "white" : "inherit",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            position: "relative",
          }}
          onClick={() => onTabClick(tab.id)}
        >
          <span>{tab.table}</span>
          <button
            style={{
              marginLeft: 8,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#888",
              fontSize: 16,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id);
            }}
            aria-label="Close tab"
          >
            ×
          </button>
        </div>
      ))}
      <div style={{ position: "relative" }} ref={dropdownRef}>
        <button
          style={{
            marginLeft: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#333",
            fontSize: 22,
            padding: "0 0.5rem",
          }}
          aria-label="Open table"
          onClick={() => setShowDropdown((v) => !v)}
        >
          +
        </button>
        {showDropdown && (
          <DropdownMenu>
            {tables.map((table) => (
              <div
                key={table.table_name}
                style={{
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                  borderBottom: "1px solid #eee",
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  maxWidth: 300,
                }}
                title={table.table_name}
                onClick={() => {
                  setShowDropdown(false);
                  onAddTab(table.table_name);
                }}
              >
                {table.table_name}
              </div>
            ))}
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};


// DropdownMenu component to handle overflow logic
const DropdownMenu: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [style, setStyle] = React.useState<React.CSSProperties>({
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
  });

  React.useLayoutEffect(() => {
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
  }, [children]);

  return (
    <div ref={menuRef} style={style} tabIndex={-1}>
      {children}
    </div>
  );
};

export default TabBar;
