import { Braces } from 'lucide-react';

export function JsonTree({ value }: { value: Record<string, unknown> }) {
  return (
    <ul className="json-tree">
      {Object.entries(value).map(([key, child]) => (
        <li key={key}>
          {typeof child === 'object' && child !== null ? (
            <details>
              <summary>
                <Braces size={14} />
                {key}
              </summary>
              <JsonTree value={child as Record<string, unknown>} />
            </details>
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
