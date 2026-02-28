import { useRef, useEffect, useState } from 'react';

interface LogViewerProps {
  content: string;
  autoScroll?: boolean;
  filterPlaceholder?: string;
}

export function LogViewer({ content, autoScroll = true, filterPlaceholder = 'Filter...' }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, autoScroll]);

  const lines = content.split('\n');
  const filtered = filter
    ? lines.filter((line) => line.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  return (
    <div className="flex flex-col h-full">
      <div className="mb-2">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={filterPlaceholder}
          className="w-full px-3 py-1.5 bg-cp-bg border border-cp-border rounded-lg text-sm text-cp-text placeholder:text-cp-muted/50 focus:outline-none focus:border-cp-primary"
        />
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-cp-bg border border-cp-border rounded-lg p-3 font-mono text-xs leading-5"
      >
        {filtered.map((line, i) => (
          <div key={i} className="text-cp-muted hover:text-cp-text whitespace-pre-wrap">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
