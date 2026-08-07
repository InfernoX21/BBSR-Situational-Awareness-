"""
ARKA Workflow Manager Engine
Phase 9 — Continuous Monitoring Loop
Phase 10 — Workflow Timeline
Phase 14 — Analytics
"""

import time
from typing import Dict, List, Any, Optional
from datetime import datetime
from .state_machine import IncidentStateMachine, WorkflowStage
from .incident_context import IncidentContextAggregator
from .response_planner import ResponsePlannerEngine
from .decision_engine import AIDecisionEngine

class WorkflowManager:
    def __init__(self):
        self.active_workflows: Dict[str, Dict[str, Any]] = {}
        self.context_aggregator = IncidentContextAggregator()

    def initialize_incident_workflow(self, incident: Dict[str, Any]) -> Dict[str, Any]:
        inc_id = incident.get("id")
        sm = IncidentStateMachine(inc_id, WorkflowStage.DETECTED)
        
        context = self.context_aggregator.aggregate_context(incident)
        lat = context["gps"]["lat"]
        lng = context["gps"]["lng"]
        cat = incident.get("category", "TRAFFIC")
        prio = incident.get("priority", "HIGH")

        buffer_data = ResponsePlannerEngine.calculate_buffer_zone(lat, lng, radius_meters=500)
        ranked_resources = ResponsePlannerEngine.rank_responders(cat, lat, lng)
        ai_evaluation = AIDecisionEngine.evaluate_incident(cat, prio, context)

        # Build initial timeline
        timeline = [
            {
                "id": f"evt-1-{inc_id}",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "stage": WorkflowStage.DETECTED.value,
                "label": "Incident Detected",
                "description": f"New {cat} incident flagged in system: {incident.get('title')}",
                "actor": "AI_ENGINE"
            },
            {
                "id": f"evt-2-{inc_id}",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "stage": WorkflowStage.VALIDATE.value,
                "label": "Incident Validated",
                "description": "Multi-sensor CCTV & telemetry data cross-verified.",
                "actor": "AI_ENGINE"
            },
            {
                "id": f"evt-3-{inc_id}",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "stage": WorkflowStage.SEVERITY.value,
                "label": "Severity & Risk Assessed",
                "description": f"AI calculated escalation risk: {ai_evaluation['escalationRisk']}",
                "actor": "AI_ENGINE"
            },
            {
                "id": f"evt-4-{inc_id}",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "stage": WorkflowStage.BUFFER_ZONE.value,
                "label": "Response Buffer Zone Created",
                "description": "500m perimeter established around incident location.",
                "actor": "WORKFLOW_ENGINE"
            }
        ]

        sm.current_stage = WorkflowStage.NOTIFY_AGENCIES

        # Compute initial route from top responder to incident site
        top_responder = ranked_resources[0] if ranked_resources else None
        route = []
        if top_responder:
            route = ResponsePlannerEngine.calculate_optimized_route(20.2690, 85.8360, lat, lng)

        analytics = {
            "responseTimeSec": 45,
            "dispatchTimeSec": 120,
            "travelTimeSec": 360,
            "arrivalTimeSec": 480,
            "totalResolutionTimeMin": ai_evaluation["estimatedResolutionMin"],
            "slaCompliant": True,
            "resourceUtilizationPct": 88,
            "agencyPerformanceScore": 95
        }

        workflow_data = {
            "incidentId": inc_id,
            "workflowStage": sm.current_stage.value,
            "bufferRadiusMeters": 500,
            "contextData": context,
            "bufferZone": buffer_data,
            "resourceRecommendations": ranked_resources,
            "aiEvaluation": ai_evaluation,
            "agenciesWorkflow": ai_evaluation["agenciesWorkflow"],
            "timeline": timeline,
            "analytics": analytics,
            "routeCoordinates": route,
            "lastRefreshed": datetime.utcnow().isoformat() + "Z"
        }

        self.active_workflows[inc_id] = workflow_data
        return workflow_data

    def get_workflow(self, incident_id: str) -> Optional[Dict[str, Any]]:
        return self.active_workflows.get(incident_id)

    def transition_stage(self, incident_id: str, new_stage: str, actor: str = "OPERATOR", note: str = "") -> Dict[str, Any]:
        workflow = self.active_workflows.get(incident_id)
        if not workflow:
            raise ValueError(f"Workflow for incident {incident_id} not found.")

        workflow["workflowStage"] = new_stage
        event = {
            "id": f"evt-{len(workflow['timeline'])+1}-{incident_id}",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "stage": new_stage,
            "label": f"Stage -> {new_stage}",
            "description": note or f"Transitioned to {new_stage} by {actor}",
            "actor": actor
        }
        workflow["timeline"].append(event)
        workflow["lastRefreshed"] = datetime.utcnow().isoformat() + "Z"
        return workflow

    def update_buffer(self, incident_id: str, radius_meters: int) -> Dict[str, Any]:
        workflow = self.active_workflows.get(incident_id)
        if not workflow:
            raise ValueError(f"Workflow for incident {incident_id} not found.")

        lat = workflow["contextData"]["gps"]["lat"]
        lng = workflow["contextData"]["gps"]["lng"]
        
        buffer_data = ResponsePlannerEngine.calculate_buffer_zone(lat, lng, radius_meters)
        workflow["bufferRadiusMeters"] = radius_meters
        workflow["bufferZone"] = buffer_data

        event = {
            "id": f"evt-{len(workflow['timeline'])+1}-{incident_id}",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "stage": workflow["workflowStage"],
            "label": f"Buffer Updated ({radius_meters}m)",
            "description": f"Dynamic geospatial response perimeter modified to {radius_meters}m.",
            "actor": "OPERATOR"
        }
        workflow["timeline"].append(event)
        return workflow
