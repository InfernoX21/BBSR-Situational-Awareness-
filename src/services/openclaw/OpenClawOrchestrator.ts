import {
  OpenClawAgentId,
  OpenClawAgentStatus,
  OpenClawExecutionResult,
  OpenClawWorkflowStep,
} from '../../types';
import { OpenClawToolRegistry, ToolExecutionContext } from './OpenClawToolRegistry';

export class OpenClawOrchestrator {
  private static instance: OpenClawOrchestrator;
  private toolRegistry = OpenClawToolRegistry.getInstance();

  // Multi-Agent Roster Definitions
  private agents: Record<OpenClawAgentId, OpenClawAgentStatus> = {
    supervisor: {
      id: 'supervisor',
      name: 'Supervisor Agent',
      role: 'Command & Workflow Orchestration',
      status: 'IDLE',
      iconName: 'Shield',
    },
    gis: {
      id: 'gis',
      name: 'GIS & Map Agent',
      role: 'Cesium/Leaflet Spatial Navigation & Layer Controls',
      status: 'IDLE',
      iconName: 'Globe',
    },
    intelligence: {
      id: 'intelligence',
      name: 'Intelligence Agent',
      role: 'Live News & Advisory Synthesis',
      status: 'IDLE',
      iconName: 'Radio',
    },
    traffic: {
      id: 'traffic',
      name: 'Traffic Operations Agent',
      role: 'Corridor Speeds, Bottlenecks & Routing',
      status: 'IDLE',
      iconName: 'Car',
    },
    disaster: {
      id: 'disaster',
      name: 'Disaster & Weather Agent',
      role: 'Doppler Radar, Rain & Flood Risk Inundation',
      status: 'IDLE',
      iconName: 'CloudRain',
    },
    infrastructure: {
      id: 'infrastructure',
      name: 'Infrastructure & Utility Agent',
      role: 'Hospitals, TPCODL Power Grid & Utilities',
      status: 'IDLE',
      iconName: 'Building2',
    },
    reporting: {
      id: 'reporting',
      name: 'Reporting & Analytics Agent',
      role: 'Executive Summaries & Command Briefings',
      status: 'IDLE',
      iconName: 'BarChart2',
    },
  };

  private sessionContext: {
    lastLocation?: { lat: number; lng: number; name: string };
    activeLayers: string[];
    recentCommands: string[];
  } = {
    activeLayers: ['incidents', 'traffic', 'weather', 'utilities'],
    recentCommands: [],
  };

  private constructor() {}

  public static getInstance(): OpenClawOrchestrator {
    if (!OpenClawOrchestrator.instance) {
      OpenClawOrchestrator.instance = new OpenClawOrchestrator();
    }
    return OpenClawOrchestrator.instance;
  }

  public getAgents(): OpenClawAgentStatus[] {
    return Object.values(this.agents);
  }

  public async executeCommand(
    userPrompt: string,
    context: ToolExecutionContext
  ): Promise<OpenClawExecutionResult> {
    const promptLower = userPrompt.toLowerCase();
    const executionId = `EXEC-OPENCLAW-${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Update command history memory
    this.sessionContext.recentCommands.push(userPrompt);

    const steps: OpenClawWorkflowStep[] = [];
    const supervisorPlan: string[] = [];
    let finalSummary = '';
    const recommendations: string[] = [];
    let stateChanges: OpenClawExecutionResult['stateChanges'] = {};
    let requiresConfirmation: OpenClawExecutionResult['requiresConfirmation'] = undefined;

    // Reset agent statuses to IDLE
    Object.keys(this.agents).forEach((k) => {
      this.agents[k as OpenClawAgentId].status = 'IDLE';
    });

    this.agents.supervisor.status = 'BUSY';

    // ----------------------------------------------------------------------
    // WORKFLOW MATCHING ENGINE
    // ----------------------------------------------------------------------
    if (promptLower.includes('fire') && promptLower.includes('patia')) {
      // Workflow: Investigate Fire near Patia
      supervisorPlan.push('1. Query news feeds and incident registry for Patia Fire hazard.');
      supervisorPlan.push('2. Fly Digital Twin camera to Patia coordinates (20.3540, 85.8150).');
      supervisorPlan.push('3. Activate Fire, Infrastructure, and Hospital map layers.');
      supervisorPlan.push('4. Query nearest hospitals (KIMS & SUM Hospital) and Fire Tenders.');
      supervisorPlan.push('5. Generate AI dispatch recommendations.');

      // Step 1: Intelligence Agent
      this.agents.intelligence.status = 'BUSY';
      const step1Result = await this.toolRegistry.executeTool('intelligence_search_news', { query: 'Patia fire' }, context);
      steps.push({
        id: 'step-1',
        agentId: 'intelligence',
        agentName: 'Intelligence Agent',
        toolName: 'intelligence_search_news',
        description: 'Searched live news & advisory feeds for Patia emergency reporting.',
        status: 'COMPLETED',
        result: step1Result,
        durationMs: 240,
      });
      this.agents.intelligence.status = 'COMPLETED';

      // Step 2: GIS Agent - Fly Camera
      this.agents.gis.status = 'BUSY';
      const step2Result = await this.toolRegistry.executeTool('gis_fly_to_location', { locationName: 'Patia Square', lat: 20.3540, lng: 85.8150, zoom: 16 }, context);
      steps.push({
        id: 'step-2',
        agentId: 'gis',
        agentName: 'GIS & Map Agent',
        toolName: 'gis_fly_to_location',
        description: 'Centered map camera on Patia Square (20.3540, 85.8150).',
        status: 'COMPLETED',
        result: step2Result,
        durationMs: 180,
      });
      stateChanges.targetLocation = { lat: 20.3540, lng: 85.8150, name: 'Patia Square' };

      // Step 3: GIS Agent - Enable Layers
      const step3Result = await this.toolRegistry.executeTool('gis_toggle_map_layer', { layerId: 'fire', enabled: true }, context);
      steps.push({
        id: 'step-3',
        agentId: 'gis',
        agentName: 'GIS & Map Agent',
        toolName: 'gis_toggle_map_layer',
        description: 'Activated Fire, Infrastructure, and Hospital overlays on Digital Twin.',
        status: 'COMPLETED',
        result: step3Result,
        durationMs: 120,
      });
      this.agents.gis.status = 'COMPLETED';
      stateChanges.layersToEnable = ['incidents', 'fire', 'hospitals', 'infrastructure'];

      // Step 4: Infrastructure Agent
      this.agents.infrastructure.status = 'BUSY';
      const step4Result = await this.toolRegistry.executeTool('infrastructure_query_hospitals', { area: 'Patia' }, context);
      steps.push({
        id: 'step-4',
        agentId: 'infrastructure',
        agentName: 'Infrastructure Agent',
        toolName: 'infrastructure_query_hospitals',
        description: 'Identified KIMS Hospital & Trauma Center (1.2 km) with 14 available ICU beds.',
        status: 'COMPLETED',
        result: step4Result,
        durationMs: 310,
      });
      this.agents.infrastructure.status = 'COMPLETED';

      // Step 5: Resource & Reporting Agent
      this.agents.reporting.status = 'BUSY';
      const step5Result = await this.toolRegistry.executeTool('analytics_generate_report', { title: 'Patia Commercial Fire Operational Plan' }, context);
      steps.push({
        id: 'step-5',
        agentId: 'reporting',
        agentName: 'Reporting & Analytics Agent',
        toolName: 'analytics_generate_report',
        description: 'Synthesized response plan and calculated emergency unit ETAs.',
        status: 'COMPLETED',
        result: step5Result,
        durationMs: 290,
      });
      this.agents.reporting.status = 'COMPLETED';

      finalSummary = 'OpenClaw completed Patia Fire investigation. Digital Twin centered on Patia Square. KIMS Trauma Center alerted for emergency reception. Fire Station 2 unit en route (ETA 3.8 mins).';
      recommendations.push('Deploy 2 Water Tenders from Kalpana Fire Station.');
      recommendations.push('Isolate TPCODL 11kV Feeder Line P-12 near Patia Plaza.');
      recommendations.push('Alert KIMS Emergency Emergency Ward for burn reception.');

    } else if (promptLower.includes('aiims') || promptLower.includes('5 km') || promptLower.includes('5km')) {
      // Workflow: Show incidents within 5 km of AIIMS
      supervisorPlan.push('1. Resolve spatial coordinates for AIIMS Bhubaneswar (20.2285, 85.7780).');
      supervisorPlan.push('2. Perform 5 km spatial radius query across open emergency registry.');
      supervisorPlan.push('3. Fly Digital Twin camera and focus incident cluster.');

      this.agents.gis.status = 'BUSY';
      const step1Result = await this.toolRegistry.executeTool('gis_fly_to_location', { locationName: 'AIIMS Bhubaneswar', lat: 20.2285, lng: 85.7780, zoom: 14 }, context);
      steps.push({
        id: 'step-1',
        agentId: 'gis',
        agentName: 'GIS & Map Agent',
        toolName: 'gis_fly_to_location',
        description: 'Navigated map to AIIMS Bhubaneswar (20.2285, 85.7780).',
        status: 'COMPLETED',
        result: step1Result,
        durationMs: 190,
      });
      stateChanges.targetLocation = { lat: 20.2285, lng: 85.7780, name: 'AIIMS Bhubaneswar' };

      this.agents.infrastructure.status = 'BUSY';
      const step2Result = await this.toolRegistry.executeTool('gis_query_nearby_assets', { lat: 20.2285, lng: 85.7780, radiusKm: 5, assetType: 'all' }, context);
      steps.push({
        id: 'step-2',
        agentId: 'gis',
        agentName: 'GIS & Map Agent',
        toolName: 'gis_query_nearby_assets',
        description: 'Queried spatial radius of 5 km around AIIMS campus. Found 6 critical infrastructure nodes.',
        status: 'COMPLETED',
        result: step2Result,
        durationMs: 250,
      });
      this.agents.gis.status = 'COMPLETED';
      this.agents.infrastructure.status = 'COMPLETED';

      finalSummary = 'Identified 2 open operational incidents within 5 km of AIIMS Bhubaneswar (Rasulgarh NH-16 Collision & Khandagiri Traffic Slowdown).';
      recommendations.push('Maintain 108 Ambulance standby at AIIMS emergency ramp.');
      recommendations.push('Keep NH-16 southbound lane clear for trauma transport.');

    } else if (promptLower.includes('cyclone') || promptLower.includes('flood') || promptLower.includes('weather')) {
      // Workflow: Prepare dashboard for cyclone & flood monitoring
      supervisorPlan.push('1. Ingest IMD Doppler Weather Radar readings & precipitation intensity.');
      supervisorPlan.push('2. Enable Weather, Flood Zones, Rain Radar, and Drone Surveillance layers.');
      supervisorPlan.push('3. Query urban drainage bottlenecks (Jayadev Vihar & Acharya Vihar).');
      supervisorPlan.push('4. Generate disaster response readiness executive summary.');

      this.agents.disaster.status = 'BUSY';
      const step1Result = await this.toolRegistry.executeTool('weather_get_current', {}, context);
      steps.push({
        id: 'step-1',
        agentId: 'disaster',
        agentName: 'Disaster & Weather Agent',
        toolName: 'weather_get_current',
        description: 'Ingested live Doppler radar: Rain intensity 45 mm/hr, Flood Risk: SEVERE.',
        status: 'COMPLETED',
        result: step1Result,
        durationMs: 210,
      });

      const step2Result = await this.toolRegistry.executeTool('weather_get_flood_warnings', {}, context);
      steps.push({
        id: 'step-2',
        agentId: 'disaster',
        agentName: 'Disaster & Weather Agent',
        toolName: 'weather_get_flood_warnings',
        description: 'Identified 4 flood inundation hotspots: Jayadev Vihar (2.2 ft), Acharya Vihar (1.5 ft).',
        status: 'COMPLETED',
        result: step2Result,
        durationMs: 180,
      });
      this.agents.disaster.status = 'COMPLETED';

      this.agents.gis.status = 'BUSY';
      const step3Result = await this.toolRegistry.executeTool('gis_toggle_map_layer', { layerId: 'floodZones', enabled: true }, context);
      steps.push({
        id: 'step-3',
        agentId: 'gis',
        agentName: 'GIS & Map Agent',
        toolName: 'gis_toggle_map_layer',
        description: 'Activated Weather Radar, Flood Inundation Heatmap, and UAV Surveillance layers.',
        status: 'COMPLETED',
        result: step3Result,
        durationMs: 140,
      });
      this.agents.gis.status = 'COMPLETED';
      stateChanges.layersToEnable = ['weather', 'floodZones', 'incidents', 'drones'];

      this.agents.reporting.status = 'BUSY';
      const step4Result = await this.toolRegistry.executeTool('analytics_generate_report', { title: 'Bhubaneswar Urban Flood Operational Brief' }, context);
      steps.push({
        id: 'step-4',
        agentId: 'reporting',
        agentName: 'Reporting & Analytics Agent',
        toolName: 'analytics_generate_report',
        description: 'Generated storm readiness brief for Bhubaneswar Municipal Corporation (BMC).',
        status: 'COMPLETED',
        result: step4Result,
        durationMs: 220,
      });
      this.agents.reporting.status = 'COMPLETED';

      finalSummary = 'Prepared ARKA C2 Dashboard for Cyclone & Flood monitoring. Flood inundation layers activated across Jayadev Vihar & Patia corridors. BMC Dewatering Pump #4 activated.';
      recommendations.push('Keep high-capacity dewatering pumps operational at Jayadev Vihar underpass.');
      recommendations.push('Divert southbound traffic via Acharya Vihar flyover.');
      recommendations.push('Issue public SMS advisory for low-lying areas near Patia Canal.');

    } else if (promptLower.includes('hospital') || promptLower.includes('outage') || promptLower.includes('power')) {
      // Workflow: Highlight hospitals affected by power outages
      supervisorPlan.push('1. Query TPCODL 11kV electrical feeder grid and substation health.');
      supervisorPlan.push('2. Cross-reference power outages with hospital trauma centers.');
      supervisorPlan.push('3. Highlight affected healthcare nodes on Digital Twin map.');

      this.agents.infrastructure.status = 'BUSY';
      const step1Result = await this.toolRegistry.executeTool('infrastructure_query_utilities', { utilityType: 'power' }, context);
      steps.push({
        id: 'step-1',
        agentId: 'infrastructure',
        agentName: 'Infrastructure & Utility Agent',
        toolName: 'infrastructure_query_utilities',
        description: 'Queried TPCODL 11kV Feeder Line MC-84 and Master Canteen Substation.',
        status: 'COMPLETED',
        result: step1Result,
        durationMs: 260,
      });

      const step2Result = await this.toolRegistry.executeTool('infrastructure_query_hospitals', { area: 'Central' }, context);
      steps.push({
        id: 'step-2',
        agentId: 'infrastructure',
        agentName: 'Infrastructure & Utility Agent',
        toolName: 'infrastructure_query_hospitals',
        description: 'Audited Capital Hospital & Master Canteen Clinic emergency backup generators.',
        status: 'COMPLETED',
        result: step2Result,
        durationMs: 200,
      });
      this.agents.infrastructure.status = 'COMPLETED';

      this.agents.gis.status = 'BUSY';
      const step3Result = await this.toolRegistry.executeTool('gis_toggle_map_layer', { layerId: 'utilities', enabled: true }, context);
      steps.push({
        id: 'step-3',
        agentId: 'gis',
        agentName: 'GIS & Map Agent',
        toolName: 'gis_toggle_map_layer',
        description: 'Toggled Hospitals and Power Utilities map layers on Digital Twin.',
        status: 'COMPLETED',
        result: step3Result,
        durationMs: 150,
      });
      this.agents.gis.status = 'COMPLETED';
      stateChanges.layersToEnable = ['hospitals', 'utilities', 'power'];

      finalSummary = 'Audited healthcare grid status. Capital Hospital diesel generator DG-02 active (100% capacity). Substation MC-84 repair en route by TPCODL field crew.';
      recommendations.push('Dispatch TPCODL emergency maintenance unit to Master Canteen Substation.');
      recommendations.push('Verify fuel reserve levels for Capital Hospital DG-02.');

    } else {
      // General Autonomous Execution Workflow
      supervisorPlan.push('1. Decompose prompt and assign specialized agents.');
      supervisorPlan.push('2. Execute multi-agent tools and synthesize operational response.');

      this.agents.intelligence.status = 'BUSY';
      const step1Result = await this.toolRegistry.executeTool('intelligence_search_news', { query: userPrompt }, context);
      steps.push({
        id: 'step-1',
        agentId: 'intelligence',
        agentName: 'Intelligence Agent',
        toolName: 'intelligence_search_news',
        description: `Searched C2 intelligence registry for: "${userPrompt}".`,
        status: 'COMPLETED',
        result: step1Result,
        durationMs: 200,
      });
      this.agents.intelligence.status = 'COMPLETED';

      this.agents.gis.status = 'BUSY';
      const step2Result = await this.toolRegistry.executeTool('gis_fly_to_location', { locationName: 'Bhubaneswar Command Center', lat: 20.2961, lng: 85.8245, zoom: 14 }, context);
      steps.push({
        id: 'step-2',
        agentId: 'gis',
        agentName: 'GIS & Map Agent',
        toolName: 'gis_fly_to_location',
        description: 'Centered map on Bhubaneswar Central Command Axis (20.2961, 85.8245).',
        status: 'COMPLETED',
        result: step2Result,
        durationMs: 160,
      });
      this.agents.gis.status = 'COMPLETED';
      stateChanges.targetLocation = { lat: 20.2961, lng: 85.8245, name: 'Bhubaneswar Central Command' };

      this.agents.reporting.status = 'BUSY';
      const step3Result = await this.toolRegistry.executeTool('analytics_generate_report', { title: `Autonomous Operations: ${userPrompt}` }, context);
      steps.push({
        id: 'step-3',
        agentId: 'reporting',
        agentName: 'Reporting & Analytics Agent',
        toolName: 'analytics_generate_report',
        description: 'Synthesized operational report and command summary.',
        status: 'COMPLETED',
        result: step3Result,
        durationMs: 210,
      });
      this.agents.reporting.status = 'COMPLETED';

      finalSummary = `OpenClaw executed autonomous command workflow for "${userPrompt}". All 7 specialized agents synchronized with C2 telemetry.`;
      recommendations.push('Review active emergency dispatches on Incident Center dashboard.');
      recommendations.push('Monitor live traffic corridors and Doppler weather radar overlays.');
    }

    this.agents.supervisor.status = 'COMPLETED';

    const agentStatuses: Record<OpenClawAgentId, OpenClawAgentStatus['status']> = {
      supervisor: this.agents.supervisor.status,
      gis: this.agents.gis.status,
      intelligence: this.agents.intelligence.status,
      traffic: this.agents.traffic.status,
      disaster: this.agents.disaster.status,
      infrastructure: this.agents.infrastructure.status,
      reporting: this.agents.reporting.status,
    };

    return {
      executionId,
      userPrompt,
      timestamp,
      supervisorPlan,
      steps,
      agentStatuses,
      finalSummary,
      recommendations,
      stateChanges,
      requiresConfirmation,
    };
  }
}
