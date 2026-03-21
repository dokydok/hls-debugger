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
        <span className={`panel__toggle ${open ? 'panel__toggle--open' : ''}`}>
          ▾
        </span>
      </div>
      {open && <div className="panel__body">{children}</div>}
    </div>
  );
}
