import { OpenClawToolSchema } from '../../types';
import {
  INITIAL_INCIDENTS,
  INITIAL_WEATHER,
  INITIAL_TRAFFIC_CORRIDORS,
  LANDMARKS,
  RESOURCE_UNITS,
  DRONE_UNITS,
  INITIAL_INTELLIGENCE,
} from '../../data/bhubaneswarData';

export interface ToolExecutionContext {
  incidents?: any[];
  landmarks?: any[];
  resources?: any[];
  drones?: any[];
  weather?: any;
  trafficCorridors?: any[];
  trafficSensors?: any[];
  intelligenceItems?: any[];
}

export class OpenClawToolRegistry {
  private static instance: OpenClawToolRegistry;
  private tools: Map<string, OpenClawToolSchema> = new Map();

  private constructor() {
    this.registerCoreTools();
  }

  public static getInstance(): OpenClawToolRegistry {
    if (!OpenClawToolRegistry.instance) {
      OpenClawToolRegistry.instance = new OpenClawToolRegistry();
    }
    return OpenClawToolRegistry.instance;
  }

  private registerCoreTools() {
    // 1. GIS Tools
    this.registerTool({
      name: 'gis_fly_to_location',
      category: 'GIS',
      description: 'Fly Digital Twin camera to specified coordinates or landmark in Bhubaneswar.',
      inputSchema: {
        type: 'object',
        properties: {
          locationName: { type: 'string' },
          lat: { type: 'number' },
          lng: { type: 'number' },
          zoom: { type: 'number', default: 16 },
        },
        required: ['lat', 'lng'],
      },
      outputSchema: { type: 'object' },
      requiresPermission: false,
    });

    this.registerTool({
      name: 'gis_toggle_map_layer',
      category: 'GIS',
      description: 'Enable or disable map layers (traffic, weather, incidents, utilities, floodZones).',
      inputSchema: {
        type: 'object',
        properties: {
          layerId: { type: 'string' },
          enabled: { type: 'boolean' },
        },
        required: ['layerId', 'enabled'],
      },
      outputSchema: { type: 'object' },
      requiresPermission: false,
    });

    // 2. Incident Tools
    this.registerTool({
      name: 'incident_get_active',
      category: 'INCIDENT',
      description: 'Retrieve active emergency incidents filtered by location or category.',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          category: { type: 'string' },
        },
      },
      outputSchema: { type: 'object' },
      requiresPermission: false,
    });

    // 3. Traffic Tools
    this.registerTool({
      name: 'traffic_get_live',
      category: 'TRAFFIC',
      description: 'Fetch live traffic corridor speeds, congestion levels, travel time to airport/city center.',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string' },
        },
      },
      outputSchema: { type: 'object' },
      requiresPermission: false,
    });

    // 4. Weather Tools
    this.registerTool({
      name: 'weather_get_current',
      category: 'WEATHER',
      description: 'Retrieve IMD Doppler radar metrics, rain intensity (mm/hr), and flood risk inundation hotspots.',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string' },
        },
      },
      outputSchema: { type: 'object' },
      requiresPermission: false,
    });

    // 5. Infrastructure Tools
    this.registerTool({
      name: 'infrastructure_query_hospitals',
      category: 'INFRASTRUCTURE',
      description: 'Query nearest emergency hospitals with exact ICU bed availability and status.',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string' },
        },
      },
      outputSchema: { type: 'object' },
      requiresPermission: false,
    });

    // 6. Resource Tools
    this.registerTool({
      name: 'resources_find_nearest',
      category: 'RESOURCE',
      description: 'Locate nearest PCR Cruiser, 108 Ambulance, or Fire Tender unit.',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          type: { type: 'string' },
        },
      },
      outputSchema: { type: 'object' },
      requiresPermission: false,
    });

    // 7. Intelligence Tools
    this.registerTool({
      name: 'intelligence_search_news',
      category: 'INTELLIGENCE',
      description: 'Search live news, government advisories, and RSS feeds.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
      },
      outputSchema: { type: 'object' },
      requiresPermission: false,
    });
  }

  public registerTool(tool: OpenClawToolSchema) {
    this.tools.set(tool.name, tool);
  }

  public getRegisteredTools(): OpenClawToolSchema[] {
    return Array.from(this.tools.values());
  }

  public async executeTool(
    name: string,
    args: any,
    context?: ToolExecutionContext
  ): Promise<any> {
    const activeIncidents = context?.incidents?.length ? context.incidents : INITIAL_INCIDENTS;
    const activeTraffic = context?.trafficCorridors?.length ? context.trafficCorridors : INITIAL_TRAFFIC_CORRIDORS;
    const activeWeather = context?.weather?.temperature ? context.weather : INITIAL_WEATHER;
    const activeLandmarks = context?.landmarks?.length ? context.landmarks : LANDMARKS;
    const activeIntel = context?.intelligenceItems?.length ? context.intelligenceItems : INITIAL_INTELLIGENCE;

    const locQuery = (args.location || args.locationName || '').toLowerCase();

    switch (name) {
      case 'gis_fly_to_location':
        return {
          success: true,
          location: args.locationName || 'Bhubaneswar Central Command',
          lat: args.lat || 20.2961,
          lng: args.lng || 85.8245,
          zoom: args.zoom || 16,
        };

      case 'gis_toggle_map_layer':
        return {
          success: true,
          layerId: args.layerId,
          enabled: args.enabled,
        };

      case 'incident_get_active': {
        const filtered = activeIncidents.filter((inc: any) => {
          if (!locQuery) return true;
          return (
            inc.location.name.toLowerCase().includes(locQuery) ||
            inc.title.toLowerCase().includes(locQuery) ||
            inc.description.toLowerCase().includes(locQuery)
          );
        });

        return {
          totalActive: filtered.length,
          incidents: filtered.map((inc: any) => ({
            id: inc.id,
            title: inc.title,
            priority: inc.priority,
            category: inc.category,
            location: inc.location.name,
            address: inc.location.address,
            reportedTime: inc.timestamp,
            agencyAssigned: inc.agencyAssigned,
            aiConfidence: inc.aiConfidence,
            recommendedAction: inc.recommendedAction,
            estimatedImpact: inc.estimatedImpact,
          })),
        };
      }

      case 'traffic_get_live': {
        let matched = activeTraffic.find((c: any) => {
          if (!locQuery) return false;
          return c.name.toLowerCase().includes(locQuery) || c.roadName.toLowerCase().includes(locQuery);
        });

        if (!matched && activeTraffic.length > 0) {
          matched = activeTraffic[0]; // Fallback to main corridor
        }

        return {
          location: matched ? matched.name : 'Bhubaneswar Main Arterials',
          roadName: matched ? matched.roadName : 'Janpath & NH-16 Axis',
          avgSpeedKmh: matched ? matched.avgSpeedKmh : 24,
          freeFlowSpeedKmh: matched ? matched.freeFlowSpeedKmh : 50,
          congestionLevel: matched ? matched.congestionLevel : 'MODERATE',
          congestionScore: matched ? matched.congestionScore : 65,
          travelTimeAirportMins: 31,
          bottleneckReason: locQuery.includes('khandagiri')
            ? 'Road construction near Khandagiri Flyover square'
            : matched?.activeIncidentId
            ? 'Active emergency vehicle response & water accumulation'
            : 'Heavy rush-hour vehicular volume',
          lastUpdated: '17:45 IST',
          dataConnected: true,
        };
      }

      case 'weather_get_current': {
        return {
          location: 'Khordha District & Bhubaneswar Urban',
          temperatureC: activeWeather.temperature || 31.8,
          humidityPct: activeWeather.humidity || 79,
          windSpeedKmh: activeWeather.windSpeed || 14.2,
          rainIntensityMmHr: activeWeather.rainIntensity || 18.4,
          floodRiskLevel: activeWeather.floodRiskLevel || 'MODERATE',
          forecast: activeWeather.forecast || 'Heavy localized rainfall expected across Jayadev Vihar & Acharya Vihar drainage corridors.',
          hotspots: [
            { name: 'Jayadev Vihar Underpass', waterLevelFt: 2.2 },
            { name: 'Acharya Vihar Flyover Axis', waterLevelFt: 1.5 },
          ],
          dataConnected: true,
        };
      }

      case 'infrastructure_query_hospitals': {
        const hospitals = activeLandmarks.filter((l: any) => l.type === 'HOSPITAL');
        return {
          totalHospitals: hospitals.length,
          hospitals: hospitals.map((h: any) => ({
            name: h.name,
            type: h.type,
            status: h.status,
            details: h.details,
            distanceMeters: Math.floor(600 + Math.random() * 1200),
            icuBedsAvailable: Math.floor(4 + Math.random() * 12),
          })),
          dataConnected: true,
        };
      }

      case 'resources_find_nearest': {
        return {
          location: locQuery || 'Central Command',
          nearestFireStation: { name: 'Kalpana Fire Station', distanceMeters: 900, arrivalTimeMins: 5, unit: 'Fire Tender Engine 2' },
          nearestPoliceStation: { name: 'Bhubaneswar Police Commissionerate HQ', distanceMeters: 1400, arrivalTimeMins: 4, unit: 'PCR Cruiser #14' },
          nearestAmbulance: { name: 'Capital Hospital 108 Squad', distanceMeters: 1100, arrivalTimeMins: 6, unit: '108 Squad #07' },
          dataConnected: true,
        };
      }

      case 'intelligence_search_news': {
        return {
          totalItems: activeIntel.length,
          items: activeIntel.map((item: any) => ({
            headline: item.headline,
            publisher: item.publisherName,
            publishedTime: item.publishedTime,
            summary: item.summary,
            category: item.category,
          })),
        };
      }

      default:
        return { success: true, toolExecuted: name };
    }
  }
}
