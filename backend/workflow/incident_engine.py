"""
ARKA Incident Engine Entry Point
Facilitates primary interface for incident response workflows.
"""

from typing import Dict, Any, List
from .workflow_manager import WorkflowManager

class IncidentEngine:
    def __init__(self):
        self.manager = WorkflowManager()

    def process_incident_event(self, event_type: str, incident_payload: Dict[str, Any]) -> Dict[str, Any]:
        inc_id = incident_payload.get("id", "INC-UNK")
        if event_type == "incident.created":
            return self.manager.initialize_incident_workflow(incident_payload)
        elif event_type == "incident.updated":
            stage = incident_payload.get("workflowStage", "UPDATE_STATE")
            return self.manager.transition_stage(inc_id, stage, actor="KAFKA_BUS")
        elif event_type == "incident.resolved":
            return self.manager.transition_stage(inc_id, "RESOLVE", actor="OPERATOR", note="Incident fully resolved & contained.")
        else:
            existing = self.manager.get_workflow(inc_id)
            if existing:
                return existing
            return self.manager.initialize_incident_workflow(incident_payload)

# Singleton global engine instance
global_incident_engine = IncidentEngine()
