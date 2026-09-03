/**
 * Tabs.
 *
 * Used for switching views *within* a module. Module-level navigation is the
 * rail's job — if a tab strip would change what data is on screen rather than how
 * it is arranged, it probably wants to be a filter instead.
 */

import { memo, type ReactNode } from 'react';
import { cx } from './cx';

export interface TabDef<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Trailing count. Zero renders, because "0 open" is information. */
  count?: number | null;
  disabled?: boolean;
  hint?: string;
}

export interface TabsProps<T extends string> {
  value: T;
  tabs: ReadonlyArray<TabDef<T>>;
  onChange: (value: T) => void;
  /** Accessible name for the tab strip. */
  label: string;
  /** Right-aligned controls that belong to the strip, not to a tab. */
  actions?: ReactNode;
  className?: string;
}

export function Tabs<T extends string>({ value, tabs, onChange, label, actions, className }: TabsProps<T>) {
  return (
    <div className={cx('flex items-stretch justify-between gap-3 border-b border-line', className)}>
      <div role="tablist" aria-label={label} className="flex items-stretch overflow-x-auto ark-scroll -mb-px">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={tab.value === value}
            disabled={tab.disabled}
            title={tab.hint ?? tab.label}
            onClick={() => onChange(tab.value)}
            className="ark-tab"
          >
            {tab.icon}
            {tab.label}
            {tab.count != null && <span className="ark-mono text-[10px] text-ink-faint">{tab.count}</span>}
          </button>
        ))}
      </div>
      {actions && <div className="flex items-center gap-1.5 shrink-0 pb-1.5">{actions}</div>}
    </div>
  );
}

/** Panel keyed to a tab. Unmounts inactive content so hidden charts cost nothing. */
export const TabPanel = memo(function TabPanel({
  active,
  children,
  className,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!active) return null;
  return (
    <div role="tabpanel" className={cx('min-h-0', className)}>
      {children}
    </div>
  );
});
