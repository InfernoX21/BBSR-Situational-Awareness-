"""
ARKA AI Decision Support Engine
Phase 7 — AI Decision Support
Phase 8 — Multi-Agency Coordination
Generates severity assessment, confidence scores, predicted escalation risk,
recommended agencies, and multi-agency coordination tracking matrix.
"""

from typing import Dict, List, Any

class AIDecisionEngine:
    @staticmethod
    def evaluate_incident(incident_category: str, priority: str, context: Dict[str, Any]) -> Dict[str, Any]:
        weather_rain = context.get("weatherConditions", {}).get("rainMm", 0)
        congestion = context.get("trafficConditions", {}).get("congestionLevel", "MODERATE")

        # Risk escalation rule logic
        if priority == "CRITICAL" or weather_rain > 30 or congestion == "HEAVY":
            escalation_risk = "HIGH"
            est_resolution_min = 45
            confidence_pct = 94
        elif priority == "HIGH":
            escalation_risk = "MODERATE"
            est_resolution_min = 30
            confidence_pct = 89
        else:
            escalation_risk = "LOW"
            est_resolution_min = 20
            confidence_pct = 85

        recommended_agencies = []
        if incident_category in ["TRAFFIC", "ACCIDENT"]:
            recommended_agencies = ["Traffic Police", "108 Ambulance", "Bhubaneswar Municipal Corp"]
        elif incident_category in ["FIRE", "HAZMAT"]:
            recommended_agencies = ["Fire Services Dept", "108 Ambulance", "Commissionerate Police", "TPCODL Power"]
        elif incident_category in ["FLOOD", "WEATHER"]:
            recommended_agencies = ["OSDMA", "ODRAF Squad", "Bhubaneswar Municipal Corp", "Drainage Division"]
        elif incident_category in ["UTILITY", "POWER"]:
            recommended_agencies = ["TPCODL Electrical Utility", "WATCO Water Works", "Traffic Police"]
        else:
            recommended_agencies = ["Commissionerate Police", "108 Ambulance"]

        # Multi-agency coordination status grid
        agencies_workflow = []
        for agency_name in recommended_agencies:
            agencies_workflow.append({
                "agencyId": f"AG-{agency_name.replace(' ', '-').upper()}",
                "agencyName": agency_name,
                "role": "PRIMARY_RESPONDER" if agency_name == recommended_agencies[0] else "SUPPORT_UNIT",
                "notificationStatus": "NOTIFIED",
                "dispatchStatus": "DISPATCHED",
                "unitsAssigned": 2 if agency_name == recommended_agencies[0] else 1,
                "etaMinutes": 6 if agency_name == recommended_agencies[0] else 12,
                "currentActivity": f"Mobilizing response squad for {incident_category.lower()} containment.",
                "lastUpdated": context.get("timestamp", "")
            })

        return {
            "aiConfidence": confidence_pct,
            "escalationRisk": escalation_risk,
            "estimatedResolutionMin": est_resolution_min,
            "recommendedAgencies": recommended_agencies,
            "agenciesWorkflow": agencies_workflow,
            "suggestedActions": [
                f"Deploy immediate perimeter barrier around {context.get('gps', {}).get('address', 'site')}.",
                f"Signal priority green wave along emergency corridor to nearest hospital.",
                f"Issue Telegram alert notification to field duty commanders."
            ]
        }
