import { useEffect, useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';

function CopyButton({ text, className = 'calculator-icon-btn' }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = () => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  const label = copied ? 'Copied' : 'Copy result';

  return (
    <button type="button" className={className} onClick={handleCopy} disabled={!text} aria-label={label} title={label}>
      {copied ? <FiCheck /> : <FiCopy />}
    </button>
  );
}

export default CopyButton;
