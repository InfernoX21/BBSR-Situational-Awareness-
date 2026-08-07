import {
  Incident,
  WorkflowStage,
  WorkflowTimelineEvent,
  AgencyWorkflowStatus,
  ResourceRecommendation,
  IncidentContextData,
  IncidentAnalytics,
} from '../../types';
import { kafkaEventBus } from './event_bus';

export class WorkflowManagerService {
  private static instance: WorkflowManagerService;

  private workflowCache: Map<string, Partial<Incident>> = new Map();

  public static getInstance(): WorkflowManagerService {
    if (!WorkflowManagerService.instance) {
      WorkflowManagerService.instance = new WorkflowManagerService();
    }
    return WorkflowManagerService.instance;
  }

  public initializeWorkflow(incident: Incident): Incident {
    if (this.workflowCache.has(incident.id)) {
      return { ...incident, ...this.workflowCache.get(incident.id) };
    }

    const initialStage: WorkflowStage = incident.workflowStage || 'NOTIFY_AGENCIES';
    const bufferRadiusMeters = incident.bufferRadiusMeters || 500;

    const lat = incident.location.lat;
    const lng = incident.location.lng;

    const contextData: IncidentContextData = incident.contextData || {
      gps: { lat, lng, address: incident.location.address },
      camerasNearby: [
        { id: 'cam-101', name: 'Jayadev Vihar Junction', road: 'Nandan Kanan Rd', status: 'ONLINE' },
        { id: 'cam-102', name: 'Acharya Vihar Square', road: 'NH-16', status: 'ONLINE' },
        { id: 'cam-103', name: 'Saheed Nagar Grid', road: 'Janpath', status: 'WARNING' },
      ],
      trafficConditions: {
        congestionLevel: incident.priority === 'CRITICAL' ? 'HEAVY' : 'MODERATE',
        avgSpeedKmh: incident.priority === 'CRITICAL' ? 14.5 : 28.0,
        affectedRoads: incident.affectedRoads || ['Janpath Road', 'NH-16 Jayadev Flyover'],
      },
      weatherConditions: {
        tempC: 31.4,
        condition: 'Heavy Rainfall Alert',
        windKmh: 26.0,
        rainMm: 42.5,
      },
      nearbyHospitals: [
        { name: 'AIIMS Bhubaneswar', distKm: 3.2, bedsAvailable: 14 },
        { name: 'Capital Hospital Unit 6', distKm: 1.8, bedsAvailable: 8 },
        { name: 'KIMS Hospital', distKm: 4.5, bedsAvailable: 22 },
      ],
      policeStations: [
        { name: 'Jayadev Vihar Outpost', distKm: 0.4 },
        { name: 'Saheed Nagar Police Station', distKm: 1.2 },
      ],
      fireStations: [
        { name: 'Unit-1 Fire Station', distKm: 2.1 },
        { name: 'Chandrasekharpur Fire Sub-Station', distKm: 3.8 },
      ],
      infrastructureStatus: {
        powerGrid: 'Substation 3 Trip Warning',
        drainage: 'Pumping Station 4 Active',
        bridgeStatus: 'Janpath Underpass Waterlogged (30cm)',
      },
      relatedNews: [
        {
          headline: 'OSDMA Mobilizes Drainage Operations across Bhubaneswar Ward 12-45',
          publisher: 'Odisha Disaster Relief',
          time: '12 mins ago',
        },
      ],
      historicalIncidentsCount: 5,
    };

    const resourceRecommendations: ResourceRecommendation[] = incident.resourceRecommendations || [
      {
        unitId: 'FIRE-101',
        unitName: 'Bhubaneswar Water Tender Unit 1',
        unitType: 'Fire Engines',
        distanceKm: 1.2,
        etaMinutes: 4,
        capabilityMatchPct: 98,
        rank: 1,
        status: 'AVAILABLE',
        baseStation: 'Unit-1 Fire Station',
      },
      {
        unitId: 'POLICE-204',
        unitName: 'PCR Squad Delta 4',
        unitType: 'Police Vehicles',
        distanceKm: 0.5,
        etaMinutes: 2,
        capabilityMatchPct: 95,
        rank: 2,
        status: 'AVAILABLE',
        baseStation: 'Jayadev Vihar Outpost',
      },
      {
        unitId: 'AMB-302',
        unitName: '108 ALS Ambulance Squad 2',
        unitType: 'Ambulances',
        distanceKm: 1.8,
        etaMinutes: 6,
        capabilityMatchPct: 92,
        rank: 3,
        status: 'AVAILABLE',
        baseStation: 'Capital Hospital Base',
      },
    ];

    const agenciesWorkflow: AgencyWorkflowStatus[] = incident.agenciesWorkflow || [
      {
        agencyId: 'AG-POLICE',
        agencyName: 'Commissionerate Police',
        role: 'Perimeter Security & Traffic Control',
        notificationStatus: 'NOTIFIED',
        dispatchStatus: 'DISPATCHED',
        unitsAssigned: 2,
        etaMinutes: 3,
        currentActivity: 'En route to secure perimeter.',
        lastUpdated: new Date().toLocaleTimeString(),
      },
      {
        agencyId: 'AG-FIRE',
        agencyName: 'Fire & Rescue Services',
        role: 'Hazmat & Emergency Containment',
        notificationStatus: 'ACKNOWLEDGED',
        dispatchStatus: 'EN_ROUTE',
        unitsAssigned: 1,
        etaMinutes: 5,
        currentActivity: 'Mobilizing water tender squad.',
        lastUpdated: new Date().toLocaleTimeString(),
      },
      {
        agencyId: 'AG-AMBULANCE',
        agencyName: '108 Emergency Medical Services',
        role: 'Trauma & Medical Support',
        notificationStatus: 'NOTIFIED',
        dispatchStatus: 'DISPATCHED',
        unitsAssigned: 1,
        etaMinutes: 6,
        currentActivity: 'Standby at Capital Hospital.',
        lastUpdated: new Date().toLocaleTimeString(),
      },
      {
        agencyId: 'AG-BMC',
        agencyName: 'Bhubaneswar Municipal Corp',
        role: 'Civic Works & Drainage',
        notificationStatus: 'NOTIFIED',
        dispatchStatus: 'UNASSIGNED',
        unitsAssigned: 0,
        etaMinutes: 15,
        currentActivity: 'Monitoring pump deployments.',
        lastUpdated: new Date().toLocaleTimeString(),
      },
    ];

    const timeline: WorkflowTimelineEvent[] = incident.timeline || [
      {
        id: `t1-${incident.id}`,
        timestamp: new Date(Date.now() - 600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: 'DETECTED',
        label: 'Incident Detected',
        description: `Triggered by AI surveillance sensor stream.`,
        actor: 'AI_ENGINE',
      },
      {
        id: `t2-${incident.id}`,
        timestamp: new Date(Date.now() - 540000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: 'VALIDATE',
        label: 'Incident Validated',
        description: 'Multi-camera triangulation confirmed event active.',
        actor: 'AI_ENGINE',
      },
      {
        id: `t3-${incident.id}`,
        timestamp: new Date(Date.now() - 480000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: 'SEVERITY',
        label: 'Severity & Escalation Assessed',
        description: `Priority assigned: ${incident.priority}. AI Escalation Risk: MODERATE.`,
        actor: 'AI_ENGINE',
      },
      {
        id: `t4-${incident.id}`,
        timestamp: new Date(Date.now() - 420000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: 'BUFFER_ZONE',
        label: 'Dynamic Buffer Zone Generated',
        description: `${bufferRadiusMeters}m operational response radius rendered on Cesium Twin.`,
        actor: 'OPERATOR',
      },
      {
        id: `t5-${incident.id}`,
        timestamp: new Date(Date.now() - 360000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: 'RECOMMENDED_RESPONSE',
        label: 'AI Response Plan Generated',
        description: `Ranked 3 emergency resource units based on live ETA & workload.`,
        actor: 'AI_ENGINE',
      },
      {
        id: `t6-${incident.id}`,
        timestamp: new Date(Date.now() - 300000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: 'NOTIFY_AGENCIES',
        label: 'Agencies Notified & Telegram Alert Issued',
        description: 'Multi-agency notification broadcasted via EOC gateway.',
        actor: 'TELEGRAM_BOT',
      },
    ];

    const analytics: IncidentAnalytics = incident.analytics || {
      responseTimeSec: 42,
      dispatchTimeSec: 110,
      travelTimeSec: 280,
      arrivalTimeSec: 390,
      totalResolutionTimeMin: 25,
      slaCompliant: true,
      resourceUtilizationPct: 84,
      agencyPerformanceScore: 96,
    };

    // Route coordinates animation path
    const routeCoordinates: [number, number][] = incident.routeCoordinates || [
      [20.269, 85.836],
      [20.275, 85.834],
      [20.282, 85.831],
      [20.289, 85.828],
      [lat, lng],
    ];

    const updated: Incident = {
      ...incident,
      workflowStage: initialStage,
      bufferRadiusMeters,
      escalationRisk: incident.escalationRisk || (incident.priority === 'CRITICAL' ? 'HIGH' : 'MODERATE'),
      estimatedResolutionMin: incident.estimatedResolutionMin || 25,
      contextData,
      resourceRecommendations,
      agenciesWorkflow,
      timeline,
      analytics,
      routeCoordinates,
    };

    this.workflowCache.set(incident.id, updated);
    kafkaEventBus.publish('incident.created', incident.id, initialStage, updated);
    return updated;
  }

  public transitionStage(incident: Incident, newStage: WorkflowStage, actor: 'AI_ENGINE' | 'OPERATOR' | 'OPENCLAW' | 'KAFKA_BUS' | 'TELEGRAM_BOT' = 'OPERATOR', note?: string): Incident {
    const initialized = this.initializeWorkflow(incident);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newTimelineEvent: WorkflowTimelineEvent = {
      id: `t-${Date.now()}`,
      timestamp: timeStr,
      stage: newStage,
      label: `Stage -> ${newStage.replace('_', ' ')}`,
      description: note || `Manual transition to ${newStage} by ${actor}.`,
      actor,
    };

    const updated: Incident = {
      ...initialized,
      workflowStage: newStage,
      status: newStage === 'RESOLVE' || newStage === 'ARCHIVE_ANALYTICS' ? 'RESOLVED' : newStage === 'DEPLOY_RESOURCES' || newStage === 'MONITOR_PROGRESS' ? 'DISPATCHED' : initialized.status,
      timeline: [...(initialized.timeline || []), newTimelineEvent],
    };

    this.workflowCache.set(incident.id, updated);
    kafkaEventBus.publish(
      newStage === 'RESOLVE' ? 'incident.resolved' : newStage === 'DEPLOY_RESOURCES' ? 'incident.dispatched' : 'incident.updated',
      incident.id,
      newStage,
      updated
    );
    return updated;
  }

  public updateBufferRadius(incident: Incident, radiusMeters: number): Incident {
    const initialized = this.initializeWorkflow(incident);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const event: WorkflowTimelineEvent = {
      id: `t-${Date.now()}`,
      timestamp: timeStr,
      stage: initialized.workflowStage || 'BUFFER_ZONE',
      label: `Buffer Adjusted to ${radiusMeters}m`,
      description: `EOC operator updated geospatial perimeter radius to ${radiusMeters}m.`,
      actor: 'OPERATOR',
    };

    const updated: Incident = {
      ...initialized,
      bufferRadiusMeters: radiusMeters,
      timeline: [...(initialized.timeline || []), event],
    };

    this.workflowCache.set(incident.id, updated);
    return updated;
  }
}

export const workflowManager = WorkflowManagerService.getInstance();
