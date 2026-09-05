/**
 * Command palette.
 *
 * The keyboard route to everything: fifteen modules, the map layers, the saved
 * views, incident lookup, and the handful of actions an operator repeats a
 * hundred times a shift. Opened with Ctrl/Cmd-K.
 *
 * Matching is substring-and-keyword, scored so a prefix beats a mid-word hit and
 * a label hit beats a keyword hit. Deliberately not fuzzy: in an operational tool
 * a wrong-but-plausible top result is worse than no result, because the operator
 * will press Enter on it.
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { cx } from './cx';
import { Kbd } from './primitives';

export interface CommandItem {
  id: string;
  label: string;
  /** Trailing context: the ward, the current value, why it is disabled. */
  hint?: string;
  icon?: ReactNode;
  /** Extra match terms — synonyms, abbreviations, the old name for a module. */
  keywords?: readonly string[];
  /** Displayed shortcut, e.g. `['G', 'M']`. Display only; binding lives elsewhere. */
  shortcut?: readonly string[];
  disabled?: boolean;
  run: () => void;
}

export interface CommandGroup {
  id: string;
  label: string;
  items: readonly CommandItem[];
}

/** Scores an item against a lowercase query. Null means no match. */
function score(item: CommandItem, query: string): number | null {
  const label = item.label.toLowerCase();
  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  const wordStart = label.split(/[\s/—-]+/).some((word) => word.startsWith(query));
  if (wordStart) return 2;
  if (label.includes(query)) return 3;
  if (item.hint?.toLowerCase().includes(query)) return 5;
  if (item.keywords?.some((keyword) => keyword.toLowerCase().includes(query))) return 6;
  return null;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  groups: readonly CommandGroup[];
  /** Called on every keystroke so the shell can inject live search results. */
  onQueryChange?: (query: string) => void;
  placeholder?: string;
  /** Shown when the query matches nothing. Say what *is* searchable. */
  emptyHint?: string;
}

export function CommandPalette({
  open,
  onClose,
  groups,
  onQueryChange,
  placeholder = 'Search modules, assets, incidents and actions',
  emptyHint = 'No match. Modules, map layers, saved views, incidents and field units are searchable.',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Reset per opening: a palette that reopens holding the last query makes the
  // first keystroke of the next task edit the previous one.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    onQueryChange?.('');
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, onQueryChange]);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return groups.map((group) => ({ ...group, items: group.items.slice(0, 8) }));
    }
    return groups
      .map((group) => {
        const scored = group.items
          .map((item) => ({ item, rank: score(item, trimmed) }))
          .filter((entry): entry is { item: CommandItem; rank: number } => entry.rank !== null)
          .sort((a, b) => a.rank - b.rank)
          .map((entry) => entry.item);
        return { ...group, items: scored };
      })
      .filter((group) => group.items.length > 0);
  }, [groups, query]);

  const flat = useMemo(() => filtered.flatMap((group) => group.items.filter((item) => !item.disabled)), [
    filtered,
  ]);

  useEffect(() => {
    setCursor((prev) => (prev >= flat.length ? 0 : prev));
  }, [flat.length]);

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [cursor, open]);

  if (!open) return null;

  const commit = (item: CommandItem | undefined) => {
    if (!item || item.disabled) return;
    onClose();
    item.run();
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((prev) => (flat.length === 0 ? 0 : (prev + 1) % flat.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((prev) => (flat.length === 0 ? 0 : (prev - 1 + flat.length) % flat.length));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setCursor(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setCursor(Math.max(0, flat.length - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      commit(flat[cursor]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  let flatIndex = -1;

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-start justify-center px-4 pt-[10vh]">
      <div className="ark-scrim" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="ark-palette relative w-full max-w-xl"
      >
        <div className="flex items-center gap-2 px-3 border-b border-line">
          <Search size={14} className="text-ink-faint shrink-0" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            role="combobox"
            aria-expanded
            aria-controls="ark-palette-list"
            aria-autocomplete="list"
            aria-label="Command palette query"
            placeholder={placeholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
              onQueryChange?.(event.target.value);
            }}
            onKeyDown={onKeyDown}
            className="flex-1 bg-transparent border-0 outline-none py-2.5 text-[13px] text-ink placeholder:text-ink-faint"
          />
          <Kbd keys={['Esc']} />
        </div>

        <div id="ark-palette-list" ref={listRef} role="listbox" className="max-h-[52vh] overflow-y-auto ark-scroll py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-[11.5px] text-ink-faint">{emptyHint}</p>
          ) : (
            filtered.map((group) => (
              <div key={group.id} className="pb-1">
                <div className="ark-label px-3 pt-2 pb-1">{group.label}</div>
                {group.items.map((item) => {
                  if (!item.disabled) flatIndex += 1;
                  const active = !item.disabled && flatIndex === cursor;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      data-active={active}
                      disabled={item.disabled}
                      className={cx('ark-palette-item', active && 'is-active', item.disabled && 'opacity-40')}
                      onMouseEnter={() => {
                        if (!item.disabled) setCursor(flat.indexOf(item));
                      }}
                      onClick={() => commit(item)}
                    >
                      {item.icon && (
                        <span className="shrink-0 text-ink-faint" aria-hidden>
                          {item.icon}
                        </span>
                      )}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.hint && <span className="text-[10.5px] text-ink-faint truncate max-w-[40%]">{item.hint}</span>}
                      {item.shortcut && <Kbd keys={item.shortcut} />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-line text-[10px] text-ink-faint">
          <span className="flex items-center gap-1">
            <Kbd keys={['↑']} />
            <Kbd keys={['↓']} />
            navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd keys={['↵']} />
            run
          </span>
          <span className="ml-auto ark-mono">{flat.length} result{flat.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
