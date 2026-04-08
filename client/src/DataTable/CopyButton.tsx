import React, { useState } from "react";

interface CopyButtonProps {
  value: string;
  title?: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ value, title = "Copy value" }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      // Optionally handle error
    }
  };

  return (
    <button 
      className="copy-button"
      onClick={handleCopy}
      title={title}
      aria-label={title}
      style={{ minWidth: 24 }}
    >
      {copied ? '✔️' : '⧉'}
    </button>
  );
};

export default CopyButton;
