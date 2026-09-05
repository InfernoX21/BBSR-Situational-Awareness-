import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Map,
  Rss,
  AlertTriangle,
  Bot,
  Radio,
  Navigation,
  Car,
  Camera,
  CloudRain,
  Building2,
  Zap,
  BarChart3,
  FileText,
  Settings,
  Network,
  Cpu,
  TrendingUp,
  PlayCircle,
  CheckSquare,
  RotateCcw,
  FolderKanban,
  History,
  Database,
  ShieldCheck,
} from 'lucide-react';
import { NavItem } from '../types';

export interface NavEntry {
  /** Must match the NavItem union used by App's tab router. */
  label: NavItem;
  icon: LucideIcon;
  /** Short plain-language description used for tooltips / assistive text. */
  hint: string;
}

export interface NavGroup {
  title: string;
  items: NavEntry[];
}

/**
 * Single source of truth for the primary navigation, organized into the
 * 6 core operational sections of the City Operating System:
 * COMMAND, INTELLIGENCE, OPERATIONS, ANALYSIS, DATA, ADMIN.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'COMMAND',
    items: [
      { label: 'Dashboard', icon: Activity, hint: 'Bhubaneswar city overview and critical metrics' },
      { label: 'Live Map', icon: Map, hint: 'Primary operational map workspace' },
      { label: 'Incident Center', icon: AlertTriangle, hint: 'Active incident queue and dispatch' },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { label: 'Intelligence Feed', icon: Rss, hint: 'Live news, advisories and bulletins' },
      { label: 'Event Engine', icon: Cpu, hint: 'Standardized real-time city event stream' },
      { label: 'Knowledge Graph', icon: Network, hint: 'Interconnected city entities & relationships' },
      { label: 'AI Operations', icon: Bot, hint: 'City-aware AI copilot & automated analysis' },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Case Management', icon: FolderKanban, hint: 'Incident #ARKA workspaces & case history' },
      { label: 'Decision Support', icon: Activity, hint: 'AI-assisted option matrix & recommendations' },
      { label: 'Action Center', icon: CheckSquare, hint: 'Task execution lifecycle & approvals' },
      { label: 'Resource Tracker', icon: Radio, hint: 'Field emergency units & fleet dispatch' },
      { label: 'Drone Feed', icon: Navigation, hint: 'Surveillance UAV aerial reconnaissance' },
      { label: 'Traffic Management', icon: Car, hint: 'Corridors, signals & congestion control' },
      { label: 'Traffic Cameras', icon: Camera, hint: 'Junction CCTV & computer vision feeds' },
      { label: 'Weather & Disaster', icon: CloudRain, hint: 'IMD radar, flood risk & shelter ops' },
      { label: 'Infrastructure', icon: Building2, hint: 'BhubaneswarOne civic assets & facilities' },
      { label: 'Utilities', icon: Zap, hint: 'Power grid SCADA & drainage pumps' },
    ],
  },
  {
    title: 'ANALYSIS',
    items: [
      { label: 'Prediction Engine', icon: TrendingUp, hint: 'Traffic & emergency delay forecasts' },
      { label: 'What-If Simulation', icon: PlayCircle, hint: 'Scenario sandbox (road block, priority route)' },
      { label: 'Timeline Replay', icon: History, hint: 'Chronological event replay & spatial history' },
      { label: 'Feedback Loop', icon: RotateCcw, hint: 'Expected vs actual post-incident outcome audit' },
      { label: 'Analytics', icon: BarChart3, hint: 'Long-term trends & performance distribution' },
      { label: 'Reports', icon: FileText, hint: 'Operational briefings & executive exports' },
    ],
  },
  {
    title: 'DATA',
    items: [
      { label: 'Data Fabric', icon: Database, hint: '17+ connected data sources & health monitoring' },
    ],
  },
  {
    title: 'ADMIN',
    items: [
      { label: 'Audit Logs', icon: ShieldCheck, hint: 'Operator action security audit trail' },
      { label: 'Settings', icon: Settings, hint: 'Platform preferences & layer configuration' },
    ],
  },
];

/** Flat list, preserved for simple ordered lookup. */
export const NAV_ITEMS: NavEntry[] = NAV_GROUPS.flatMap((g) => g.items);

