import { useState, useEffect } from 'react';
import type {
  OperationalRole,
  OperationalMapMode,
  CityEntity,
  ExplainableIntelligenceCard,
  SimulationScenario,
  DecisionRecommendation,
  ActionItem,
  AuditLog,
  FeedbackRecord
} from '../types';

interface OperationalState {
  role: OperationalRole;
  mapMode: OperationalMapMode;
  selectedEntity: CityEntity | null;
  provenanceCard: ExplainableIntelligenceCard | null;
  activeSimulation: SimulationScenario | null;
  isSearchOpen: boolean;
  isGuidedFlowOpen: boolean;
  actions: ActionItem[];
  auditLogs: AuditLog[];
  feedbackTimeline: FeedbackRecord[];
  activeRecommendation: DecisionRecommendation | null;
}

// Initial state singleton
let state: OperationalState = {
  role: 'TRAFFIC_OPERATOR',
  mapMode: 'TRAFFIC_OPS',
  selectedEntity: null,
  provenanceCard: null,
  activeSimulation: null,
  isSearchOpen: false,
  isGuidedFlowOpen: false,
  actions: [
    {
      id: 'act-9021-01',
      incidentId: 'INCIDENT #ARKA-9021',
      recommendationId: 'rec-9021',
      title: 'ATCS Green Wave & Janpath Corridor Diversion',
      actionType: 'TRAFFIC_SIGNAL_OVERRIDE',
      status: 'APPROVED',
      operator: 'Operator-A.Patnaik',
      timestamp: new Date().toISOString(),
      reason: 'Bypasses Jayadev Vihar overbridge bottleneck for 108 Ambulance ALS-04',
      affectedEntityIds: ['entity-junct-jayadev', 'entity-road-janpath', 'entity-amb-108'],
      executionTarget: 'BSCL ATCS Traffic Controller'
    }
  ],
  auditLogs: [
    {
      id: 'aud-101',
      who: 'Operator-A.Patnaik (Traffic Ops)',
      didWhat: 'APPROVED_DIVERSION_ACTION',
      when: new Date().toISOString(),
      targetEntityId: 'act-9021-01',
      reason: 'Approved Option B for Ambulance ALS-04 priority clearance'
    }
  ],
  feedbackTimeline: [
    {
      id: 'fb-101',
      actionId: 'act-8802',
      incidentId: 'INCIDENT #ARKA-8801',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      metricName: 'Jayadev Vihar Clearance Speed',
      expectedOutcome: 'Increase average corridor speed from 14 km/h to 32 km/h',
      actualOutcome: 'Achieved 34.5 km/h corridor flow in 14 mins',
      deviationPct: 7.8,
      outcomeGrade: 'EXCEEDED',
      lessonsLearned: 'Signal green wave on Janpath link prevented secondary queue buildup.'
    }
  ],
  activeRecommendation: {
    id: 'rec-9021',
    incidentId: 'INCIDENT #ARKA-9021',
    situationSummary: 'Emergency Vehicle ALS-04 blocked by severe bottleneck at Jayadev Vihar Flyover following multi-vehicle collision.',
    options: [
      {
        id: 'opt-a',
        optionLabel: 'A',
        title: 'Maintain Current NH-16 Route with Local Escort',
        expectedImpact: 'Estimated delay +14 minutes. High risk of vehicle stagnation.',
        affectedArea: 'NH-16 Jayadev Flyover',
        confidencePct: 62,
        assumptions: ['PCR Squad clears shoulder within 10 minutes'],
        risks: ['Severe bottleneck escalation', 'Patient SLA breach'],
        requiredAction: 'Request PCR Squad Delta-4 to force emergency lane.'
      },
      {
        id: 'opt-b',
        optionLabel: 'B',
        title: 'Divert to Janpath Corridor with Intelligent Signal Green Wave',
        expectedImpact: 'Saves 14.3 minutes. ETA to Capital Hospital reduced from 21.5m to 7.2m.',
        affectedArea: 'Janpath Corridor & Acharya Vihar Junction',
        confidencePct: 94,
        assumptions: ['BMC drainage pumps prevent further Janpath waterlogging', 'ATCS signal override granted'],
        risks: ['Minor congestion increase on Janpath (+12%)'],
        requiredAction: 'Execute ATCS Green Wave Phase 3 and alert Capital Hospital Trauma Room.'
      },
      {
        id: 'opt-c',
        optionLabel: 'C',
        title: 'Deploy SkyPatrol UAV Aerial Recon & Secondary Bypass',
        expectedImpact: 'Saves 9 minutes. Allows real-time gap analysis.',
        affectedArea: 'Khandagiri Bypass Route',
        confidencePct: 78,
        assumptions: ['UAV battery flight time > 30 minutes'],
        risks: ['Higher route length (+2.4 km)'],
        requiredAction: 'Launch SkyPatrol UAV-02 for dynamic convoy escort.'
      }
    ],
    recommendedOptionId: 'opt-b',
    recommendationReason: 'Option B maximizes patient survival probability by minimizing ETA by 14.3 minutes with highest confidence (94%).',
    timestamp: new Date().toISOString(),
    status: 'PENDING_OPERATOR_REVIEW'
  }
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export const operationalStore = {
  getState: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setRole: (role: OperationalRole) => {
    state = { ...state, role };
    notify();
  },
  setMapMode: (mapMode: OperationalMapMode) => {
    state = { ...state, mapMode };
    notify();
  },
  setSelectedEntity: (selectedEntity: CityEntity | null) => {
    state = { ...state, selectedEntity };
    notify();
  },
  setProvenanceCard: (provenanceCard: ExplainableIntelligenceCard | null) => {
    state = { ...state, provenanceCard };
    notify();
  },
  setActiveSimulation: (activeSimulation: SimulationScenario | null) => {
    state = { ...state, activeSimulation };
    notify();
  },
  setIsSearchOpen: (isSearchOpen: boolean) => {
    state = { ...state, isSearchOpen };
    notify();
  },
  setIsGuidedFlowOpen: (isGuidedFlowOpen: boolean) => {
    state = { ...state, isGuidedFlowOpen };
    notify();
  },
  approveRecommendationOption: (recommendationId: string, optionId: string, operatorName: string) => {
    if (!state.activeRecommendation || state.activeRecommendation.id !== recommendationId) return;
    const selectedOption = state.activeRecommendation.options.find((o) => o.id === optionId);
    if (!selectedOption) return;

    const newAction: ActionItem = {
      id: `act-${Date.now()}`,
      incidentId: state.activeRecommendation.incidentId,
      recommendationId: recommendationId,
      title: `${selectedOption.title} (Option ${selectedOption.optionLabel})`,
      actionType: 'OPERATOR_DECISION_EXECUTION',
      status: 'APPROVED',
      operator: operatorName,
      timestamp: new Date().toISOString(),
      reason: selectedOption.requiredAction,
      affectedEntityIds: ['entity-junct-jayadev', 'entity-road-janpath', 'entity-amb-108'],
      executionTarget: 'ARKA Automated Dispatch Gateway'
    };

    const newAuditLog: AuditLog = {
      id: `aud-${Date.now()}`,
      who: `${operatorName} (${state.role})`,
      didWhat: 'APPROVED_DECISION_SUPPORT_OPTION',
      when: new Date().toISOString(),
      targetEntityId: newAction.id,
      reason: `Approved Option ${selectedOption.optionLabel}: ${selectedOption.title}`
    };

    state = {
      ...state,
      actions: [newAction, ...state.actions],
      auditLogs: [newAuditLog, ...state.auditLogs],
      activeRecommendation: {
        ...state.activeRecommendation,
        status: 'APPROVED'
      }
    };
    notify();
  },
  updateActionStatus: (actionId: string, status: ActionItem['status']) => {
    const updatedActions = state.actions.map((act) => (act.id === actionId ? { ...act, status } : act));
    state = { ...state, actions: updatedActions };
    notify();
  },
  addAuditLog: (who: string, didWhat: string, reason: string, targetEntityId?: string) => {
    const newLog: AuditLog = {
      id: `aud-${Date.now()}`,
      who,
      didWhat,
      when: new Date().toISOString(),
      reason,
      targetEntityId
    };
    state = { ...state, auditLogs: [newLog, ...state.auditLogs] };
    notify();
  }
};

export function useOperationalStore() {
  const [current, setCurrent] = useState(operationalStore.getState());

  useEffect(() => {
    const unsubscribe = operationalStore.subscribe(() => {
      setCurrent(operationalStore.getState());
    });
    return unsubscribe;
  }, []);

  return current;
}
