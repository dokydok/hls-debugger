import { useState, type ReactNode } from 'react';

interface Props {
  title: string;
  defaultOpen?: boolean;
  count?: number;
  children: ReactNode;
}

export function CollapsiblePanel({ title, defaultOpen = true, count, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="panel">
      <div className="panel__header" onClick={() => setOpen(!open)}>
        <span className="panel__title">
          {title}
          {count != null && <span className="panel__count"> ({count})</span>}
        </span>
        <svg className={`panel__toggle ${open ? 'panel__toggle--open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {open && <div className="panel__body">{children}</div>}
    </div>
  );
}
