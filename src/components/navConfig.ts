/**
 * The platform's information architecture, in one place.
 *
 * Six sections, read top to bottom as the operator's mental model: what the city
 * is doing right now, what we know about it, the systems that run it, the assets
 * we operate, what the record says, and who may touch it.
 *
 * This file is the single source of truth for four surfaces — the desktop rail,
 * the mobile drawer, the command palette and the URL router. Adding a
 * destination here makes it navigable everywhere; there is no second list to
 * keep in step.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  Building2,
  Camera,
  Cctv,
  CheckSquare,
  CloudRain,
  Cpu,
  Database,
  FileClock,
  FileText,
  FolderKanban,
  Gauge,
  Globe2,
  History,
  Map,
  Network,
  Plane,
  PlayCircle,
  Radio,
  RotateCcw,
  Rss,
  ScrollText,
  Settings,
  ShieldCheck,
  Signpost,
  TrendingUp,
  Truck,
  Users,
  Zap,
} from 'lucide-react';
import type { NavItem } from '../types';

export interface NavEntry {
  /** Must match the NavItem union used by App's tab router. */
  label: NavItem;
  /** URL path this destination owns. Absolute, no trailing slash. */
  route: string;
  icon: LucideIcon;
  /** Short plain-language description used for tooltips / assistive text. */
  hint: string;
  /**
   * Extra words the command palette should match on.
   */
  aliases?: readonly string[];
}

export interface NavGroup {
  title: string;
  /** Section route prefix, or null for top-level destinations. */
  prefix: string | null;
  items: NavEntry[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Command center',
    prefix: null,
    items: [
      {
        label: 'Command Center',
        route: '/command',
        icon: Activity,
        hint: 'City-wide operational picture and the state of every system',
        aliases: ['dashboard', 'home', 'overview'],
      },
      {
        label: 'Live City',
        route: '/live-city',
        icon: Globe2,
        hint: 'Unified geospatial twin — assets, incidents and layers on one map',
        aliases: ['live map', 'digital twin', 'map', '3d', 'geospatial'],
      },
      {
        label: 'Active Situations',
        route: '/situations',
        icon: AlertTriangle,
        hint: 'Open incidents, alerts and anomalies with their response state',
        aliases: ['incident center', 'incidents', 'alerts', 'anomalies'],
      },
      {
        label: 'Case Management',
        route: '/cases',
        icon: FolderKanban,
        hint: 'Incident #ARKA workspaces & multi-agency case history',
        aliases: ['cases', 'investigation', 'workspace'],
      },
      {
        label: 'Action Center',
        route: '/actions',
        icon: CheckSquare,
        hint: 'Task execution lifecycle & automated response workflows',
        aliases: ['actions', 'tasks', 'execution', 'sop'],
      },
    ],
  },
  {
    title: 'Intelligence',
    prefix: '/intelligence',
    items: [
      {
        label: 'Intelligence',
        route: '/intelligence',
        icon: Rss,
        hint: 'Incoming bulletins, advisories and reporting',
        aliases: ['intelligence feed', 'news', 'bulletins', 'advisories'],
      },
      {
        label: 'AI Analysis',
        route: '/intelligence/ai',
        icon: Bot,
        hint: 'Model-generated analysis, recommendations and agent activity',
        aliases: ['ai operations', 'openclaw', 'agents', 'recommendations'],
      },
      {
        label: 'Event Correlation',
        route: '/intelligence/correlation',
        icon: Network,
        hint: 'Events that share a subject, a place or a window across systems',
        aliases: ['correlation', 'linked events', 'fusion'],
      },
      {
        label: 'Event Engine',
        route: '/intelligence/events',
        icon: Cpu,
        hint: 'Standardized real-time city event stream and rules',
        aliases: ['event stream', 'events', 'pubsub', 'kafka'],
      },
      {
        label: 'Knowledge Graph',
        route: '/intelligence/graph',
        icon: Network,
        hint: 'Interconnected city entities, locations & relationships',
        aliases: ['graph', 'ontology', 'entities', 'links'],
      },
      {
        label: 'Prediction Engine',
        route: '/intelligence/predictions',
        icon: TrendingUp,
        hint: 'Traffic & emergency delay ML forecasts',
        aliases: ['predictions', 'forecasts', 'ml'],
      },
      {
        label: 'What-If Simulation',
        route: '/intelligence/simulation',
        icon: PlayCircle,
        hint: 'Scenario sandbox for road blocks and priority routing',
        aliases: ['simulation', 'sandbox', 'what if', 'scenarios'],
      },
      {
        label: 'Decision Support',
        route: '/intelligence/decision',
        icon: Activity,
        hint: 'AI-assisted option evaluation matrix & impact analysis',
        aliases: ['decision', 'options', 'tradeoffs'],
      },
    ],
  },
  {
    title: 'City systems',
    prefix: '/city',
    items: [
      {
        label: 'Mobility',
        route: '/city/mobility',
        icon: Signpost,
        hint: 'Corridor speeds, signals, diversions and road monitoring',
        aliases: ['traffic management', 'traffic', 'roads', 'parking', 'transport'],
      },
      {
        label: 'Environment',
        route: '/city/environment',
        icon: CloudRain,
        hint: 'Weather, flood risk, disaster posture and environmental readings',
        aliases: ['weather & disaster', 'weather', 'disaster', 'flood', 'air quality'],
      },
      {
        label: 'Infrastructure',
        route: '/city/infrastructure',
        icon: Building2,
        hint: 'Civic assets, facilities and structural health',
        aliases: ['buildings', 'bridges', 'facilities'],
      },
      {
        label: 'Utilities',
        route: '/city/utilities',
        icon: Zap,
        hint: 'Power, water, gas, telecom and street lighting',
        aliases: ['power', 'water', 'gas', 'telecom', 'lighting'],
      },
    ],
  },
  {
    title: 'Assets',
    prefix: '/assets',
    items: [
      {
        label: 'Resources',
        route: '/assets/resources',
        icon: Radio,
        hint: 'Police, fire, medical and field teams with dispatch state',
        aliases: ['resource tracker', 'units', 'ambulance', 'police', 'fire', 'dispatch'],
      },
      {
        label: 'Cameras',
        route: '/assets/cameras',
        icon: Cctv,
        hint: 'Junction CCTV and authorised surveillance feeds',
        aliases: ['traffic cameras', 'cctv', 'surveillance'],
      },
      {
        label: 'Drones',
        route: '/assets/drones',
        icon: Camera,
        hint: 'UAV fleet status and aerial tasking',
        aliases: ['drone feed', 'uav', 'aerial'],
      },
      {
        label: 'Sensors',
        route: '/assets/sensors',
        icon: Gauge,
        hint: 'Roadside, environmental and infrastructure sensor estate',
        aliases: ['iot', 'detectors', 'telemetry'],
      },
      {
        label: 'Vehicles',
        route: '/assets/vehicles',
        icon: Truck,
        hint: 'Response vehicles and public transport fleet',
        aliases: ['fleet', 'buses', 'transit'],
      },
      {
        label: 'Aviation',
        route: '/assets/aviation',
        icon: Plane,
        hint: 'Aircraft in the city block from ADS-B',
        aliases: ['adsb', 'flights', 'aircraft', 'airspace'],
      },
    ],
  },
  {
    title: 'Insights',
    prefix: '/insights',
    items: [
      {
        label: 'Analytics',
        route: '/insights/analytics',
        icon: BarChart3,
        hint: 'Distributions and trends across the current record set',
        aliases: ['charts', 'trends', 'statistics'],
      },
      {
        label: 'Reports',
        route: '/insights/reports',
        icon: FileText,
        hint: 'Operational briefings and exports',
        aliases: ['briefings', 'exports', 'pdf'],
      },
      {
        label: 'Timeline Replay',
        route: '/insights/replay',
        icon: History,
        hint: 'Chronological event replay & spatial history',
        aliases: ['history', 'replay', 'timeline'],
      },
      {
        label: 'Feedback Loop',
        route: '/insights/feedback',
        icon: RotateCcw,
        hint: 'Expected vs actual post-incident outcome audit',
        aliases: ['feedback', 'outcomes', 'audit'],
      },
    ],
  },
  {
    title: 'Administration',
    prefix: '/admin',
    items: [
      {
        label: 'Settings',
        route: '/admin/settings',
        icon: Settings,
        hint: 'Platform, layer and alerting preferences',
        aliases: ['preferences', 'configuration'],
      },
      {
        label: 'Data Fabric',
        route: '/admin/data-fabric',
        icon: Database,
        hint: '17+ connected data sources & ingestion health',
        aliases: ['sources', 'connectors', 'data fabric'],
      },
      {
        label: 'Audit Logs',
        route: '/admin/audit',
        icon: ScrollText,
        hint: 'System and operator activity, including sensitive-data access',
        aliases: ['audit trail', 'activity log', 'compliance'],
      },
    ],
  },
];

/** Flat list, preserved for simple ordered lookup. */
export const NAV_ITEMS: NavEntry[] = NAV_GROUPS.flatMap((group) => group.items);

/** The landing destination. Also what an unrecognised URL resolves to. */
export const DEFAULT_NAV_ITEM: NavItem = 'Command Center';

const BY_LABEL = new Map<NavItem, NavEntry>(NAV_ITEMS.map((item) => [item.label, item]));

export function navEntryFor(label: NavItem): NavEntry {
  const entry = BY_LABEL.get(label);
  if (!entry) throw new Error(`No navigation entry for "${label}"`);
  return entry;
}

export function routeFor(label: NavItem): string {
  return navEntryFor(label).route;
}

/**
 * The section a destination belongs to.
 */
export function groupFor(label: NavItem): NavGroup {
  const group = NAV_GROUPS.find((candidate) => candidate.items.some((item) => item.label === label));
  if (!group) throw new Error(`No navigation group for "${label}"`);
  return group;
}

/**
 * Sibling destinations, for a module tab strip.
 */
export function siblingsFor(label: NavItem): NavEntry[] {
  const group = groupFor(label);
  return group.prefix == null ? [] : group.items;
}

/**
 * Resolve a URL path to a destination.
 */
export function navItemForPath(pathname: string): NavItem | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  let best: NavEntry | null = null;
  for (const item of NAV_ITEMS) {
    if (path === item.route || path.startsWith(`${item.route}/`)) {
      if (!best || item.route.length > best.route.length) best = item;
    }
  }
  return best?.label ?? null;
}
