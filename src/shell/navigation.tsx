/**
 * Navigation, available to any page without threading callbacks.
 *
 * Before this, moving between destinations meant a prop — `onJumpToMap`,
 * `onViewAllAlerts`, `onOpenIncident` — added to whichever component happened to
 * need it, which is why the previous interface had a dozen one-off jump
 * callbacks all doing `setActiveTab('Live Map')`. A page should be able to say
 * "go to Live City" without its parent knowing it might want to.
 *
 * Two things live here: the context that carries the current destination and the
 * navigate function, and `ModuleHeader` — the one page header in the platform,
 * which derives its breadcrumb and its sibling tab strip from `navConfig` rather
 * than from anything a page hand-writes. That is what keeps the hierarchy on
 * screen honest: a page cannot label itself as belonging to a section it is not
 * in, because it does not get to choose.
 */

import { createContext, memo, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { NavItem } from '../types';
import { groupFor, siblingsFor } from '../components/navConfig';
import { PageHeader, Tabs, type PageHeaderProps, type TabDef } from '../ui';
import type { NavCounts } from './NavRail';

interface NavigationValue {
  active: NavItem;
  navigate: (item: NavItem) => void;
  /** Open-work counts, so a module tab strip can carry the same badge as the rail. */
  counts: NavCounts;
}

const NavigationContext = createContext<NavigationValue | null>(null);

export function NavigationProvider({
  active,
  navigate,
  counts,
  children,
}: NavigationValue & { children: ReactNode }) {
  const value = useMemo<NavigationValue>(() => ({ active, navigate, counts }), [active, navigate, counts]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

/**
 * The navigate function, for a link or a button inside a page.
 *
 * Throws outside the provider rather than silently no-opping: a dead "Open in
 * Live City" button is worse than a crash in development, because in a control
 * room nobody files a bug about a button that does nothing.
 */
export function useNavigation(): NavigationValue {
  const value = useContext(NavigationContext);
  if (!value) throw new Error('useNavigation must be used inside NavigationProvider');
  return value;
}

// --- Breadcrumb --------------------------------------------------------------

/**
 * Section → page, in the rail's words.
 *
 * Two levels only. A deeper trail would imply a hierarchy the platform does not
 * have, and the brief asks for a shallow one. The section is inert text, not a
 * link, because a section is a grouping and has no page of its own.
 */
export const Breadcrumb = memo(function Breadcrumb({ item }: { item: NavItem }) {
  const group = groupFor(item);
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 mb-0.5 text-[10.5px]">
      <span className="ark-eyebrow">{group.title}</span>
      <ChevronRight size={10} className="text-ink-faint shrink-0" aria-hidden />
      <span className="ark-eyebrow text-ink-muted">{item}</span>
    </nav>
  );
});

// --- Module header -----------------------------------------------------------

export interface ModuleHeaderProps extends Omit<PageHeaderProps, 'breadcrumb' | 'tabs' | 'title'> {
  /** The destination this page is. Everything else is derived from it. */
  item: NavItem;
  /** Overrides the destination's own name. Rare; used where a page shows one record. */
  title?: string;
  /**
   * Suppresses the sibling tab strip.
   *
   * For a page that fills the viewport with its own canvas — Live City — where a
   * strip of tabs would take a row of map and offer navigation the rail already
   * provides two inches to the left.
   */
  hideTabs?: boolean;
}

/**
 * The page header, wired to the information architecture.
 *
 * Every destination uses this rather than `PageHeader` directly, which is what
 * makes the breadcrumb, the title and the tab strip agree with the rail on all
 * twenty-two pages. A section with no prefix — Command Center — gets no tab
 * strip: its three destinations are separate workspaces, not views of one thing.
 */
export const ModuleHeader = memo(function ModuleHeader({
  item,
  title,
  hideTabs = false,
  ...header
}: ModuleHeaderProps) {
  const { active, navigate, counts } = useNavigation();
  const siblings = hideTabs ? [] : siblingsFor(item);

  const onChange = useCallback((value: string) => navigate(value as NavItem), [navigate]);

  const tabs = useMemo<TabDef<NavItem>[]>(
    () =>
      siblings.map((sibling) => ({
        value: sibling.label,
        label: sibling.label,
        icon: <sibling.icon size={12} strokeWidth={1.8} aria-hidden />,
        hint: sibling.hint,
        count: counts[sibling.label] ?? undefined,
      })),
    [siblings, counts],
  );

  return (
    <PageHeader
      {...header}
      title={title ?? item}
      breadcrumb={<Breadcrumb item={item} />}
      tabs={
        tabs.length > 1 ? (
          <Tabs
            value={active}
            tabs={tabs}
            onChange={onChange}
            label={`${groupFor(item).title} sections`}
          />
        ) : undefined
      }
    />
  );
});
