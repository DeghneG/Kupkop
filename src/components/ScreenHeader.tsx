import React from 'react';

// The indigo header band and woven selvedge that open every main screen. Pass `className="-mx-4 -mt-3"`
// on a page whose container has side padding, so the band runs edge to edge.
export default function ScreenHeader({
  title,
  subtitle,
  right,
  className = '',
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <header className="bg-shell text-shell-fg px-4 py-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-bold leading-none font-brand">{title}</h1>
          {subtitle && <p className="text-[12px] text-shell-muted mt-1">{subtitle}</p>}
        </div>
        {right}
      </header>
      <div className="selvedge" aria-hidden="true" />
    </div>
  );
}
