/**
 * URL routing for ARKA, in about sixty lines.
 *
 * The platform has one destination on screen at a time and twenty-two of them in
 * total, all resolved from `navConfig`. That is a lookup table, not a routing
 * problem, so this hook does the whole job with `history.pushState` and
 * `popstate` rather than adding a router dependency to a bundle that is already
 * carrying a map engine and a charting library.
 *
 * What it buys, which the previous `useState` tab did not: an operator can
 * bookmark `/city/mobility`, send a colleague a link to Active Situations, and
 * use the browser's back button to return from a drill-down. In a control room
 * where a shift handover means "open what I was looking at", that matters.
 *
 * The server already cooperates: `server.ts` serves `index.html` for any path
 * that is not `/api/*`, in both development and production, so a deep link
 * survives a hard refresh.
 */

import { useCallback, useEffect, useState } from 'react';
import type { NavItem } from '../types';
import { DEFAULT_NAV_ITEM, navItemForPath, routeFor } from '../components/navConfig';

function currentItem(): NavItem {
  if (typeof window === 'undefined') return DEFAULT_NAV_ITEM;
  return navItemForPath(window.location.pathname) ?? DEFAULT_NAV_ITEM;
}

export function useRoute(): {
  active: NavItem;
  navigate: (item: NavItem) => void;
} {
  const [active, setActive] = useState<NavItem>(currentItem);

  // Land an unrecognised or bare URL on the canonical path for the default
  // destination, replacing rather than pushing so Back still leaves the app.
  useEffect(() => {
    const resolved = navItemForPath(window.location.pathname);
    if (resolved == null) {
      window.history.replaceState(null, '', routeFor(DEFAULT_NAV_ITEM));
    }
  }, []);

  useEffect(() => {
    const onPop = () => setActive(currentItem());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((item: NavItem) => {
    const route = routeFor(item);
    // Re-selecting the current destination must not stack history entries; an
    // operator clicking Mobility twice should not need two Backs to leave.
    if (window.location.pathname !== route) {
      window.history.pushState(null, '', route);
    }
    setActive(item);
  }, []);

  return { active, navigate };
}
