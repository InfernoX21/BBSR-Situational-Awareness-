/**
 * Registry of operational domains that have NO connected data source.
 *
 * Shared by the server (to build UNAVAILABLE responses) and the client (to
 * render honest empty states), so the reason an operator sees on screen is the
 * same reason the API reports.
 *
 * Each entry answers three questions an operations manager will ask:
 *   - what exactly is missing?
 *   - why can't it just be switched on?
 *   - who would we have to integrate with?
 *
 * Nothing in here is a placeholder for data. Adding a source means deleting an
 * entry and wiring a provider.
 */

import type { DataError, SourceMeta } from './dataState';

export interface MissingIntegration {
  id: string;
  /** What the operator was looking for. */
  label: string;
  /** Why there is nothing to show. */
  reason: string;
  /** The integration that would fill this gap. */
  requiredIntegration: string;
  /** Data owner(s) who would have to provide access. */
  dataOwners: string[];
}

export const MISSING_INTEGRATIONS: Record<string, MissingIntegration> = {
  'traffic-flow': {
    id: 'traffic-flow',
    label: 'Corridor speeds and congestion',
    reason:
      'No traffic flow provider is configured. Corridor geometry below is local configuration; no speed, congestion or vehicle-count source is connected.',
    requiredIntegration:
      'A commercial flow API (for example TomTom or HERE, key held server-side) or a direct feed from the Bhubaneswar traffic signal/ATCS controller.',
    dataOwners: ['Bhubaneswar Traffic Police', 'BSCL (ATCS/ITMS operator)'],
  },
  'traffic-sensors': {
    id: 'traffic-sensors',
    label: 'Roadside speed radars and loop counters',
    reason: 'No roadside sensor telemetry feed is connected.',
    requiredIntegration: 'BSCL ITMS sensor API or MQTT/Kafka bridge exposing radar and loop counts.',
    dataOwners: ['BSCL', 'Bhubaneswar Traffic Police'],
  },
  cctv: {
    id: 'cctv',
    label: 'CCTV camera streams',
    reason:
      'No camera streaming endpoint is configured. Public sample video is deliberately not shown in place of a city camera.',
    requiredIntegration:
      'Authenticated RTSP/HLS gateway for the BSCL city surveillance network, with per-operator access control.',
    dataOwners: ['BSCL Smart City', 'Odisha Police Commissionerate'],
  },
  anpr: {
    id: 'anpr',
    label: 'ANPR reads and vehicle detections',
    reason:
      'No detection service is connected. Detection counts, plate reads and bounding boxes are not generated locally.',
    requiredIntegration:
      'The ANPR/vision service that owns the camera network, or the local Sadaksh inference service (SADAKSH_AI_URL) running against an authorised stream.',
    dataOwners: ['BSCL ANPR operator'],
  },
  'utilities-scada': {
    id: 'utilities-scada',
    label: 'Power, water, gas and telecom telemetry',
    reason:
      'No utility SCADA or outage feed is connected. Load, pressure, latency and outage records are not available.',
    requiredIntegration:
      'Read-only SCADA/historian APIs or outage-management exports from each utility, terminated server-side.',
    dataOwners: ['TPCODL (power)', 'WATCO (water)', 'GAIL (gas)', 'BSNL (telecom)', 'BSCL (street lighting)'],
  },
  'hospital-capacity': {
    id: 'hospital-capacity',
    label: 'Hospital bed and ICU availability',
    reason: 'No health-facility capacity feed is connected. Facility locations are static reference data only.',
    requiredIntegration:
      'Odisha Health & Family Welfare bed-availability API, or the state HMIS/108 integration.',
    dataOwners: ['Dept. of Health & Family Welfare, Odisha', 'AIIMS/Capital Hospital administration'],
  },
  'police-dispatch': {
    id: 'police-dispatch',
    label: 'Police unit status and dispatch',
    reason: 'No dispatch or unit-location feed is connected. Station locations are static reference data only.',
    requiredIntegration: 'Commissionerate C4i / Dial-112 CAD integration with unit AVL.',
    dataOwners: ['Bhubaneswar-Cuttack Police Commissionerate'],
  },
  'fire-readiness': {
    id: 'fire-readiness',
    label: 'Fire appliance readiness',
    reason: 'No fire-service readiness feed is connected. Station locations are static reference data only.',
    requiredIntegration: 'Odisha Fire & Emergency Services station status API.',
    dataOwners: ['Odisha Fire & Emergency Services'],
  },
  'fleet-avl': {
    id: 'fleet-avl',
    label: 'Vehicle locations, fuel and battery',
    reason: 'No automatic vehicle location feed is connected for any agency fleet.',
    requiredIntegration: 'AVL/GPS telematics API per agency (police, fire, 108 ambulance, BMC).',
    dataOwners: ['Bhubaneswar Traffic Police', 'Odisha Fire Services', '108 Emergency Services', 'BMC'],
  },
  'drone-telemetry': {
    id: 'drone-telemetry',
    label: 'UAV telemetry and video',
    reason: 'No UAV ground-control-station link is connected.',
    requiredIntegration:
      'MAVLink/GCS telemetry bridge plus an authorised video relay, flown under DGCA clearance.',
    dataOwners: ['Operating agency UAV cell'],
  },
  'incidents-cad': {
    id: 'incidents-cad',
    label: 'Incident records',
    reason:
      'No computer-aided-dispatch or incident-management system is connected. Only incidents created by an operator in this session are shown.',
    requiredIntegration:
      'CAD/ICS integration (Dial-112, BMC control room, or OSDMA incident register) with two-way status sync.',
    dataOwners: ['Dial-112 control room', 'BMC control room', 'OSDMA'],
  },
  shelters: {
    id: 'shelters',
    label: 'Cyclone and relief shelter status',
    reason: 'No shelter register feed is connected, so capacity and occupancy are unknown.',
    requiredIntegration: 'OSDMA multipurpose cyclone shelter register with live occupancy reporting.',
    dataOwners: ['OSDMA', 'BMC'],
  },
  'official-warnings': {
    id: 'official-warnings',
    label: 'Official weather and flood warnings',
    reason:
      'IMD requires IP/domain whitelisting for API access (their endpoint returns "Your IP/Domain needs to be whitelisted"), and no CWC or OSDMA warning API is documented for programmatic use.',
    requiredIntegration:
      'An IMD data-supply agreement for nowcast/warning APIs, plus CWC flood-forecast and OSDMA alert feeds.',
    dataOwners: ['India Meteorological Department', 'Central Water Commission', 'OSDMA'],
  },
  'aqi-ground-station': {
    id: 'aqi-ground-station',
    label: 'CPCB ground-station air quality',
    reason:
      'The data.gov.in CPCB resource rejects unauthenticated automated requests (HTTP 403) and requires a registered key. Modelled air quality is shown instead and is labelled as modelled.',
    requiredIntegration: 'A registered data.gov.in API key (DATA_GOV_IN_API_KEY) for the CPCB real-time AQI resource.',
    dataOwners: ['Central Pollution Control Board', 'Odisha State Pollution Control Board'],
  },
  'river-gauge': {
    id: 'river-gauge',
    label: 'River gauge water levels',
    reason:
      'No gauge-level API is available; the Central Water Commission flood portal publishes a web application without a documented API. Modelled discharge is shown instead.',
    requiredIntegration: 'CWC flood-forecast data-sharing agreement for gauge levels at Daya/Kuakhai sites.',
    dataOwners: ['Central Water Commission', 'Odisha Water Resources Dept.'],
  },
  'agency-strength': {
    id: 'agency-strength',
    label: 'Agency personnel and unit availability',
    reason: 'No agency roster or availability feed is connected. Contact details are static reference data.',
    requiredIntegration: 'Per-agency duty-roster or resource-management API.',
    dataOwners: ['All partner agencies'],
  },
};

/** Source descriptor for a domain with nothing behind it. */
export function missingSource(id: string): SourceMeta {
  const entry = MISSING_INTEGRATIONS[id];
  return {
    provider: 'Not connected',
    kind: 'none',
    note: entry?.reason,
  };
}

/** DataError describing the gap, for UNAVAILABLE envelopes. */
export function missingError(id: string): DataError {
  const entry = MISSING_INTEGRATIONS[id];
  if (!entry) {
    return { code: 'NOT_CONFIGURED', message: 'No data source is configured for this field.' };
  }
  return {
    code: 'NOT_CONFIGURED',
    message: entry.reason,
    requiredIntegration: entry.requiredIntegration,
  };
}
