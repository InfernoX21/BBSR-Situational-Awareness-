/**
 * Filters.
 *
 * Every module filters the same way: a search field, one or more chip groups, and
 * a reset that only exists when there is something to reset. The bar reports how
 * many records survived the filter, because a filtered list that looks empty and
 * an actually-empty list are different facts and the operator has to be able to
 * tell which one they are looking at.
 */

import { useMemo, type ReactNode, type Ref } from 'react';
import { Search, X } from 'lucide-react';
import { cx } from './cx';
import { Chip, IconButton, Input, Select, type SelectOption } from './primitives';

// --- Search ------------------------------------------------------------------

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Accessible name. Defaults to the placeholder. */
  label?: string;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  label,
  inputRef,
  className,
}: SearchInputProps) {
  return (
    <Input
      inputRef={inputRef}
      value={value}
      type="search"
      aria-label={label ?? placeholder}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      icon={<Search size={12} />}
      trailing={
        value ? <IconButton label="Clear search" icon={<X size={11} />} onClick={() => onChange('')} /> : undefined
      }
      wrapClassName={cx('w-full', className)}
    />
  );
}

// --- Chip group --------------------------------------------------------------

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  /** Matching record count. Renders even at zero — an empty bucket is a fact. */
  count?: number | null;
  hint?: string;
}

export interface FilterGroupProps<T extends string> {
  label: string;
  options: ReadonlyArray<FilterOption<T>>;
  /** Selected values. Empty means "no constraint", not "nothing". */
  selected: readonly T[];
  onChange: (selected: T[]) => void;
  /** Single-select behaves as a radio group: picking one clears the rest. */
  single?: boolean;
  className?: string;
}

export function FilterGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
  single = false,
  className,
}: FilterGroupProps<T>) {
  const set = useMemo(() => new Set(selected), [selected]);
  return (
    <div className={cx('flex items-center gap-1.5 min-w-0', className)} role="group" aria-label={label}>
      <span className="ark-label shrink-0">{label}</span>
      <div className="flex items-center gap-1 flex-wrap">
        {options.map((option) => {
          const active = set.has(option.value);
          return (
            <Chip
              key={option.value}
              active={active}
              count={option.count}
              title={option.hint}
              onClick={() => {
                if (single) {
                  onChange(active ? [] : [option.value]);
                  return;
                }
                onChange(active ? selected.filter((v) => v !== option.value) : [...selected, option.value]);
              }}
            >
              {option.label}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}

// --- Sort control ------------------------------------------------------------

export function SortSelect<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <label className={cx('flex items-center gap-1.5', className)}>
      <span className="ark-label shrink-0">Sort</span>
      <Select value={value} options={options} onValueChange={onChange} aria-label="Sort order" className="w-auto" />
    </label>
  );
}

// --- Bar ---------------------------------------------------------------------

export interface FilterBarProps {
  children: ReactNode;
  /** How many filters are currently narrowing the result. */
  activeCount?: number;
  /** Clears every filter. Shown only when `activeCount` is positive. */
  onReset?: () => void;
  /** Result count after filtering, and the total before it. */
  showing?: { shown: number; total: number };
  className?: string;
}

export function FilterBar({ children, activeCount = 0, onReset, showing, className }: FilterBarProps) {
  return (
    <div className={cx('flex items-center gap-x-4 gap-y-2 flex-wrap min-w-0', className)}>
      {children}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        {showing && (
          <span className="ark-mono text-[10.5px] text-ink-subtle">
            {showing.shown === showing.total
              ? `${showing.total} record${showing.total === 1 ? '' : 's'}`
              : `${showing.shown} of ${showing.total}`}
          </span>
        )}
        {activeCount > 0 && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="ark-btn ark-btn-quiet ark-btn-xs"
            title={`Clear ${activeCount} active filter${activeCount === 1 ? '' : 's'}`}
          >
            <X size={11} aria-hidden />
            Clear {activeCount}
          </button>
        )}
      </div>
    </div>
  );
}
