import { Braces } from 'lucide-react';
import { useState } from 'react';

function Branch({ name, value }: { name: string; value: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <Braces size={14} />
        {name}
      </summary>
      {open && <JsonTree value={value} />}
    </details>
  );
}

export function JsonTree({ value }: { value: Record<string, unknown> }) {
  return (
    <ul className="json-tree">
      {Object.entries(value).map(([key, child]) => (
        <li key={key}>
          {typeof child === 'object' && child !== null ? (
            <Branch name={key} value={child as Record<string, unknown>} />
          ) : (
            <div>
              <span>{key}</span>
              <em>{String(child) || '""'}</em>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
