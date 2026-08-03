import { OpenClawToolSchema } from '../../types';

export interface ToolExecutionContext {
  incidents: any[];
  landmarks: any[];
  resources: any[];
  drones: any[];
  weather: any;
  trafficCorridors: any[];
  trafficSensors: any[];
  intelligenceItems: any[];
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
    // ----------------------------------------------------------------------
    // 1. GIS TOOLS
    // ----------------------------------------------------------------------
    this.registerTool({
      name: 'gis_fly_to_location',
      category: 'GIS',
      description: 'Fly Digital Twin camera to specified coordinates or landmark in Bhubaneswar.',
      inputSchema: {
        type: 'object',
        properties: {
          locationName: { type: 'string', description: 'Name of the landmark or location' },
          lat: { type: 'number', description: 'Latitude coordinate' },
          lng: { type: 'number', description: 'Longitude coordinate' },
          zoom: { type: 'number', description: 'Zoom level (1-19)' },
        },
        required: ['lat', 'lng'],
      },
      outputSchema: { type: 'object', properties: { success: { type: 'boolean' }, location: { type: 'string' } } },
      requiresPermission: false,
    });

    this.registerTool({
      name: 'gis_toggle_map_layer',
      category: 'GIS',
      description: 'Enable or disable map layers (traffic, weather, incidents, utilities, floodZones, etc.).',
      inputSchema: {
        type: 'object',
        properties: {
          layerId: { type: 'string', description: 'ID of the layer to toggle' },
          enabled: { type: 'boolean', description: 'True to turn layer on, False to turn off' },
        },
        required: ['layerId', 'enabled'],
      },
      outputSchema: { type: 'object', properties: { success: { type: 'boolean' }, activeLayers: { type: 'array' } } },
      requiresPermission: false,
    });

    this.registerTool({
      name: 'gis_query_nearby_assets',
      category: 'GIS',
      description: 'Spatial radius query for hospitals, police stations, substations, or fire stations near location.',
      inputSchema: {
        type: 'object',
        properties: {
          lat: { type: 'number' },
          lng: { type: 'number' },
          radiusKm: { type: 'number', default: 5 },
          assetType: { type: 'string', enum: ['hospitals', 'police', 'fire', 'utilities', 'drones', 'all'] },
        },
        required: ['lat', 'lng'],
      },
      outputSchema: { type: 'object', properties: { assets: { type: 'array' }, totalCount: { type: 'number' } } },
      requiresPermission: false,
    });

    // ----------------------------------------------------------------------
    // 2. INCIDENT TOOLS
    // ----------------------------------------------------------------------
    this.registerTool({
      name: 'incident_get_active',
      category: 'INCIDENT',
      description: 'Retrieve list of active or critical emergencies currently open in Bhubaneswar.',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          priority: { type: 'string' },
          status: { type: 'string' },
        },
      },
      outputSchema: { type: 'object', properties: { incidents: { type: 'array' }, count: { type: 'number' } } },
      requiresPermission: false,
    });

    this.registerTool({
      name: 'incident_update_status',
      category: 'INCIDENT',
      description: 'Update the operational status of an incident (ACTIVE -> DISPATCHED -> CONTAINED -> RESOLVED).',
      inputSchema: {
        type: 'object',
        properties: {
          incidentId: { type: 'string', description: 'ID of the incident (e.g. INC-2026-8901)' },
          status: { type: 'string', enum: ['ACTIVE', 'DISPATCHED', 'CONTAINED', 'RESOLVED'] },
        },
        required: ['incidentId', 'status'],
      },
      outputSchema: { type: 'object', properties: { success: { type: 'boolean' }, updatedIncident: { type: 'object' } } },
      requiresPermission: true,
    });

    this.registerTool({
      name: 'incident_dispatch_unit',
      category: 'INCIDENT',
      description: 'Dispatch the recommended emergency response unit (BMC Pump, Fire Tender, PCR Van) to incident site.',
      inputSchema: {
        type: 'object',
        properties: {
          incidentId: { type: 'string' },
          agency: { type: 'string' },
          unitId: { type: 'string' },
        },
        required: ['incidentId'],
      },
      outputSchema: { type: 'object', properties: { success: { type: 'boolean' }, etaMinutes: { type: 'number' } } },
      requiresPermission: true,
    });

    // ----------------------------------------------------------------------
    // 3. TRAFFIC TOOLS
    // ----------------------------------------------------------------------
    this.registerTool({
      name: 'traffic_get_live',
      category: 'TRAFFIC',
      description: 'Fetch live traffic corridor speeds, congestion scores, and IoT radar sensor telemetry.',
      inputSchema: {
        type: 'object',
        properties: {
          corridorId: { type: 'string' },
          minCongestionScore: { type: 'number' },
        },
      },
      outputSchema: { type: 'object', properties: { corridors: { type: 'array' }, cityAvgSpeed: { type: 'number' } } },
      requiresPermission: false,
    });

    this.registerTool({
      name: 'traffic_estimate_travel_time',
      category: 'TRAFFIC',
      description: 'Estimate travel time and detect delay propagation along Bhubaneswar express corridors.',
      inputSchema: {
        type: 'object',
        properties: {
          origin: { type: 'string' },
          destination: { type: 'string' },
        },
        required: ['origin', 'destination'],
      },
      outputSchema: { type: 'object', properties: { travelTimeMinutes: { type: 'number' }, delayMinutes: { type: 'number' } } },
      requiresPermission: false,
    });

    // ----------------------------------------------------------------------
    // 4. WEATHER & DISASTER TOOLS
    // ----------------------------------------------------------------------
    this.registerTool({
      name: 'weather_get_current',
      category: 'WEATHER',
      description: 'Retrieve live IMD Doppler weather radar metrics, flood risk levels, and wind telemetry for Bhubaneswar.',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: { tempC: { type: 'number' }, rainIntensity: { type: 'number' }, floodRiskLevel: { type: 'string' } } },
      requiresPermission: false,
    });

    this.registerTool({
      name: 'weather_get_flood_warnings',
      category: 'WEATHER',
      description: 'Query urban flood inundation warning zones and waterlogging vulnerability scores.',
      inputSchema: { type: 'object', properties: { minRiskLevel: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { floodZones: { type: 'array' } } },
      requiresPermission: false,
    });

    // ----------------------------------------------------------------------
    // 5. INTELLIGENCE TOOLS
    // ----------------------------------------------------------------------
    this.registerTool({
      name: 'intelligence_search_news',
      category: 'INTELLIGENCE',
      description: 'Search live Bhubaneswar RSS feeds and AI fused news intelligence items.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          category: { type: 'string' },
        },
      },
      outputSchema: { type: 'object', properties: { items: { type: 'array' }, count: { type: 'number' } } },
      requiresPermission: false,
    });

    // ----------------------------------------------------------------------
    // 6. INFRASTRUCTURE & UTILITY TOOLS
    // ----------------------------------------------------------------------
    this.registerTool({
      name: 'infrastructure_query_hospitals',
      category: 'INFRASTRUCTURE',
      description: 'Query hospitals, emergency bed availability, trauma centers, and ICU capacity across Bhubaneswar.',
      inputSchema: {
        type: 'object',
        properties: {
          area: { type: 'string' },
          icuAvailable: { type: 'boolean' },
        },
      },
      outputSchema: { type: 'object', properties: { hospitals: { type: 'array' } } },
      requiresPermission: false,
    });

    this.registerTool({
      name: 'infrastructure_query_utilities',
      category: 'INFRASTRUCTURE',
      description: 'Query TPCODL electrical substations, water treatment plants, and telecom towers.',
      inputSchema: {
        type: 'object',
        properties: {
          utilityType: { type: 'string', enum: ['power', 'water', 'telecom', 'all'] },
          status: { type: 'string' },
        },
      },
      outputSchema: { type: 'object', properties: { utilities: { type: 'array' } } },
      requiresPermission: false,
    });

    // ----------------------------------------------------------------------
    // 7. RESOURCE TOOLS
    // ----------------------------------------------------------------------
    this.registerTool({
      name: 'resource_find_nearest',
      category: 'RESOURCE',
      description: 'Find nearest active police cruiser, 108 ambulance, or fire tender to specified location.',
      inputSchema: {
        type: 'object',
        properties: {
          lat: { type: 'number' },
          lng: { type: 'number' },
          type: { type: 'string', enum: ['POLICE', 'AMBULANCE', 'FIRE', 'MUNICIPAL'] },
        },
        required: ['lat', 'lng'],
      },
      outputSchema: { type: 'object', properties: { nearestUnit: { type: 'object' }, etaMinutes: { type: 'number' } } },
      requiresPermission: false,
    });

    // ----------------------------------------------------------------------
    // 8. REPORTING & NOTIFICATION TOOLS
    // ----------------------------------------------------------------------
    this.registerTool({
      name: 'analytics_generate_report',
      category: 'ANALYTICS',
      description: 'Generate operational executive summary and situational report for Bhubaneswar command.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          includeWeather: { type: 'boolean', default: true },
          includeTraffic: { type: 'boolean', default: true },
        },
      },
      outputSchema: { type: 'object', properties: { reportSummary: { type: 'string' }, generatedAt: { type: 'string' } } },
      requiresPermission: false,
    });
  }

  public registerTool(tool: OpenClawToolSchema) {
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): OpenClawToolSchema | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): OpenClawToolSchema[] {
    return Array.from(this.tools.values());
  }

  // Execute tool handler against live context
  public async executeTool(toolName: string, params: any, context: ToolExecutionContext): Promise<any> {
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new Error(`OpenClaw Tool "${toolName}" is not registered in the MCP Tool Registry.`);
    }

    switch (toolName) {
      case 'gis_fly_to_location': {
        const targetLat = params.lat || 20.2961;
        const targetLng = params.lng || 85.8245;
        return {
          success: true,
          location: params.locationName || `${targetLat.toFixed(4)}, ${targetLng.toFixed(4)}`,
          lat: targetLat,
          lng: targetLng,
          zoom: params.zoom || 16,
        };
      }

      case 'gis_toggle_map_layer': {
        return {
          success: true,
          layerId: params.layerId,
          enabled: params.enabled,
        };
      }

      case 'gis_query_nearby_assets': {
        const radius = params.radiusKm || 5;
        const lat = params.lat;
        const lng = params.lng;
        // Search landmarks / resources within radius
        const matches = context.landmarks.filter((lm) => {
          const dist = Math.sqrt(Math.pow(lm.lat - lat, 2) + Math.pow(lm.lng - lng, 2)) * 111;
          return dist <= radius;
        });
        return { assets: matches, totalCount: matches.length, radiusKm: radius };
      }

      case 'incident_get_active': {
        let results = context.incidents;
        if (params.category && params.category !== 'ALL') {
          results = results.filter((i) => i.category === params.category);
        }
        if (params.priority && params.priority !== 'ALL') {
          results = results.filter((i) => i.priority === params.priority);
        }
        if (params.status && params.status !== 'ALL') {
          results = results.filter((i) => i.status === params.status);
        }
        return { incidents: results, count: results.length };
      }

      case 'incident_update_status': {
        const inc = context.incidents.find((i) => i.id === params.incidentId);
        return {
          success: true,
          incidentId: params.incidentId,
          newStatus: params.status,
          title: inc?.title || params.incidentId,
        };
      }

      case 'incident_dispatch_unit': {
        const inc = context.incidents.find((i) => i.id === params.incidentId);
        return {
          success: true,
          incidentId: params.incidentId,
          title: inc?.title || params.incidentId,
          assignedAgency: params.agency || inc?.agencyAssigned || 'BMC & Emergency Response',
          etaMinutes: Math.floor(3 + Math.random() * 5),
        };
      }

      case 'traffic_get_live': {
        const bottlenecks = context.trafficCorridors.filter(
          (c) => c.congestionLevel === 'SEVERE' || c.congestionLevel === 'JAMMED'
        );
        return {
          corridors: context.trafficCorridors,
          bottlenecks,
          cityAvgSpeedKmh: 24.5,
        };
      }

      case 'traffic_estimate_travel_time': {
        return {
          origin: params.origin,
          destination: params.destination,
          travelTimeMinutes: 18,
          delayMinutes: 6,
          alternateRoute: 'Via Acharya Vihar overpass to Janpath express corridor.',
        };
      }

      case 'weather_get_current': {
        return {
          tempC: context.weather?.tempC || 29,
          rainIntensity: context.weather?.rainIntensity || 45,
          floodRiskLevel: context.weather?.floodRiskLevel || 'SEVERE',
          forecast: context.weather?.forecast || 'Monsoonal heavy downpour active across Khordha district.',
        };
      }

      case 'weather_get_flood_warnings': {
        return {
          floodZones: [
            { name: 'Jayadev Vihar Underpass', risk: 'CRITICAL', waterLevelFt: 2.2 },
            { name: 'Acharya Vihar Square', risk: 'HIGH', waterLevelFt: 1.5 },
            { name: 'Master Canteen Station Plaza', risk: 'HIGH', waterLevelFt: 1.2 },
            { name: 'Patia Canal Line', risk: 'MEDIUM', waterLevelFt: 0.8 },
          ],
        };
      }

      case 'intelligence_search_news': {
        const q = (params.query || '').toLowerCase();
        const matches = context.intelligenceItems.filter(
          (item) => item.headline.toLowerCase().includes(q) || item.snippet.toLowerCase().includes(q)
        );
        return { items: matches.slice(0, 5), count: matches.length };
      }

      case 'infrastructure_query_hospitals': {
        const hospitals = context.landmarks.filter((l) => l.type === 'HOSPITAL');
        return { hospitals, totalCount: hospitals.length };
      }

      case 'infrastructure_query_utilities': {
        const utilities = context.landmarks.filter((l) => l.type === 'POWER' || l.type === 'WATER' || l.type === 'TELECOM');
        return { utilities, totalCount: utilities.length };
      }

      case 'resource_find_nearest': {
        const resList = context.resources || [];
        const match = resList.find((r) => r.type === params.type) || resList[0];
        return {
          nearestUnit: match || { id: 'UNIT-108-01', name: 'Capital Hospital 108 Ambulance', type: 'AMBULANCE' },
          etaMinutes: 4.2,
        };
      }

      case 'analytics_generate_report': {
        return {
          reportTitle: params.title || 'ARKA Situational Command Executive Summary',
          generatedAt: new Date().toISOString(),
          activeIncidentsCount: context.incidents.filter((i) => i.status === 'ACTIVE').length,
          weatherRisk: context.weather?.floodRiskLevel || 'HIGH',
          keyRecommendation: 'Maintain BMC Pump 4 active at Jayadev Vihar; keep traffic diversion active along NH-16.',
        };
      }

      default:
        return { success: true, toolExecuted: toolName, params };
    }
  }
}
