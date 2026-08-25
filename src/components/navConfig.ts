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
 * Single source of truth for the primary navigation, shared by the desktop
 * sidebar and the mobile drawer so labels, order and grouping never drift.
 * Every route that existed before the redesign is still present here.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Situational awareness',
    items: [
      { label: 'Dashboard', icon: Activity, hint: 'Map, alerts queue and city analytics' },
      { label: 'Live Map', icon: Map, hint: 'Full-width geospatial workspace' },
      { label: 'Intelligence Feed', icon: Rss, hint: 'News, advisories and bulletins' },
    ],
  },
  {
    title: 'Response operations',
    items: [
      { label: 'Incident Center', icon: AlertTriangle, hint: 'Incident queue and response workflow' },
      { label: 'AI Operations', icon: Bot, hint: 'Assisted analysis and task automation' },
      { label: 'Resource Tracker', icon: Radio, hint: 'Field units and dispatch status' },
      { label: 'Drone Feed', icon: Navigation, hint: 'Live UAV reconnaissance stream & aerial telemetry' },
    ],
  },
  {
    title: 'City systems',
    items: [
      { label: 'Traffic Management', icon: Car, hint: 'Corridor speeds, signals and diversions' },
      { label: 'Traffic Cameras', icon: Camera, hint: 'Junction CCTV monitoring' },
      { label: 'Weather & Disaster', icon: CloudRain, hint: 'Weather, flood risk and shelters' },
      { label: 'Infrastructure', icon: Building2, hint: 'Civic assets and facilities' },
      { label: 'Utilities', icon: Zap, hint: 'Power, water, gas, telecom and lighting' },
    ],
  },
  {
    title: 'Analysis & records',
    items: [
      { label: 'Analytics', icon: BarChart3, hint: 'Trends and distribution charts' },
      { label: 'Reports', icon: FileText, hint: 'Briefings and exports' },
    ],
  },
  {
    title: 'Administration',
    items: [{ label: 'Settings', icon: Settings, hint: 'Platform and layer preferences' }],
  },
];

/** Flat list, preserved for anything that needs a simple ordered lookup. */
export const NAV_ITEMS: NavEntry[] = NAV_GROUPS.flatMap((g) => g.items);
