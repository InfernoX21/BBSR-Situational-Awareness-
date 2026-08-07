"""
ARKA Incident Workflow Engine — State Machine Module
Manages discrete state transitions and validation rules for incidents.
"""

from enum import Enum
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime

class WorkflowStage(str, Enum):
    DETECTED = "DETECTED"
    VALIDATE = "VALIDATE"
    SEVERITY = "SEVERITY"
    EXACT_LOCATION = "EXACT_LOCATION"
    BUFFER_ZONE = "BUFFER_ZONE"
    NEARBY_RESPONDERS = "NEARBY_RESPONDERS"
    TRAFFIC_ANALYSIS = "TRAFFIC_ANALYSIS"
    WEATHER_ANALYSIS = "WEATHER_ANALYSIS"
    INFRASTRUCTURE_CONSTRAINTS = "INFRASTRUCTURE_CONSTRAINTS"
    RECOMMENDED_RESPONSE = "RECOMMENDED_RESPONSE"
    NOTIFY_AGENCIES = "NOTIFY_AGENCIES"
    DEPLOY_RESOURCES = "DEPLOY_RESOURCES"
    MONITOR_PROGRESS = "MONITOR_PROGRESS"
    UPDATE_STATE = "UPDATE_STATE"
    RESOLVE = "RESOLVE"
    ARCHIVE_ANALYTICS = "ARCHIVE_ANALYTICS"

# Order of workflow stages
STAGE_SEQUENCE: List[WorkflowStage] = [
    WorkflowStage.DETECTED,
    WorkflowStage.VALIDATE,
    WorkflowStage.SEVERITY,
    WorkflowStage.EXACT_LOCATION,
    WorkflowStage.BUFFER_ZONE,
    WorkflowStage.NEARBY_RESPONDERS,
    WorkflowStage.TRAFFIC_ANALYSIS,
    WorkflowStage.WEATHER_ANALYSIS,
    WorkflowStage.INFRASTRUCTURE_CONSTRAINTS,
    WorkflowStage.RECOMMENDED_RESPONSE,
    WorkflowStage.NOTIFY_AGENCIES,
    WorkflowStage.DEPLOY_RESOURCES,
    WorkflowStage.MONITOR_PROGRESS,
    WorkflowStage.UPDATE_STATE,
    WorkflowStage.RESOLVE,
    WorkflowStage.ARCHIVE_ANALYTICS,
]

VALID_TRANSITIONS: Dict[WorkflowStage, List[WorkflowStage]] = {
    WorkflowStage.DETECTED: [WorkflowStage.VALIDATE, WorkflowStage.RESOLVE],
    WorkflowStage.VALIDATE: [WorkflowStage.SEVERITY, WorkflowStage.RESOLVE],
    WorkflowStage.SEVERITY: [WorkflowStage.EXACT_LOCATION],
    WorkflowStage.EXACT_LOCATION: [WorkflowStage.BUFFER_ZONE],
    WorkflowStage.BUFFER_ZONE: [WorkflowStage.NEARBY_RESPONDERS],
    WorkflowStage.NEARBY_RESPONDERS: [WorkflowStage.TRAFFIC_ANALYSIS],
    WorkflowStage.TRAFFIC_ANALYSIS: [WorkflowStage.WEATHER_ANALYSIS],
    WorkflowStage.WEATHER_ANALYSIS: [WorkflowStage.INFRASTRUCTURE_CONSTRAINTS],
    WorkflowStage.INFRASTRUCTURE_CONSTRAINTS: [WorkflowStage.RECOMMENDED_RESPONSE],
    WorkflowStage.RECOMMENDED_RESPONSE: [WorkflowStage.NOTIFY_AGENCIES],
    WorkflowStage.NOTIFY_AGENCIES: [WorkflowStage.DEPLOY_RESOURCES],
    WorkflowStage.DEPLOY_RESOURCES: [WorkflowStage.MONITOR_PROGRESS],
    WorkflowStage.MONITOR_PROGRESS: [WorkflowStage.UPDATE_STATE, WorkflowStage.RESOLVE],
    WorkflowStage.UPDATE_STATE: [WorkflowStage.MONITOR_PROGRESS, WorkflowStage.RESOLVE],
    WorkflowStage.RESOLVE: [WorkflowStage.ARCHIVE_ANALYTICS],
    WorkflowStage.ARCHIVE_ANALYTICS: [],
}

class IncidentStateMachine:
    def __init__(self, incident_id: str, initial_stage: WorkflowStage = WorkflowStage.DETECTED):
        self.incident_id = incident_id
        self.current_stage = initial_stage
        self.history: List[Dict[str, Any]] = [
            {
                "stage": initial_stage.value,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "actor": "AI_ENGINE",
                "note": "Incident initialized in state machine."
            }
        ]

    def can_transition(self, next_stage: WorkflowStage) -> bool:
        allowed = VALID_TRANSITIONS.get(self.current_stage, [])
        return next_stage in allowed or next_stage == self.current_stage

    def transition(self, next_stage: WorkflowStage, actor: str = "WORKFLOW_ENGINE", note: str = "") -> Tuple[bool, str]:
        if not self.can_transition(next_stage):
            return False, f"Invalid transition from {self.current_stage.value} to {next_stage.value}"
        
        self.current_stage = next_stage
        event = {
            "stage": next_stage.value,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "actor": actor,
            "note": note or f"Transitioned to {next_stage.value}"
        }
        self.history.append(event)
        return True, f"Successfully transitioned to {next_stage.value}"

    def auto_advance(self) -> Tuple[bool, Optional[WorkflowStage]]:
        try:
            curr_idx = STAGE_SEQUENCE.index(self.current_stage)
            if curr_idx < len(STAGE_SEQUENCE) - 1:
                next_stage = STAGE_SEQUENCE[curr_idx + 1]
                success, _ = self.transition(next_stage, actor="AUTO_SCHEDULER", note="Auto-advancing lifecycle stage")
                if success:
                    return True, next_stage
        except ValueError:
            pass
        return False, None
