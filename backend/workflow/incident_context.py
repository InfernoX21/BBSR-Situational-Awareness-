"""
ARKA Incident Context Aggregator
Phase 3 — Automatic Data Collection
Retrieves GPS coordinates, camera feeds, traffic, weather, nearby emergency services,
infrastructure constraints, and related news into a unified incident context object.
"""

import math
from typing import Dict, List, Any
from datetime import datetime

class IncidentContextAggregator:
    @staticmethod
    def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        R = 6371.0 # Earth radius km
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)

    def aggregate_context(self, incident_data: Dict[str, Any]) -> Dict[str, Any]:
        lat = incident_data.get("location", {}).get("lat", 20.2961)
        lng = incident_data.get("location", {}).get("lng", 85.8245)
        address = incident_data.get("location", {}).get("address", "Bhubaneswar Central")

        # Mock/Aggregated context feeds for Bhubaneswar TMC/EOC
        context = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "gps": {
                "lat": lat,
                "lng": lng,
                "address": address
            },
            "camerasNearby": [
                {"id": "cam-101", "name": "Jayadev Vihar Junction", "road": "Nandan Kanan Rd", "status": "ONLINE", "distanceKm": self.calculate_distance_km(lat, lng, 20.2980, 85.8260)},
                {"id": "cam-102", "name": "Acharya Vihar Square", "road": "NH-16", "status": "ONLINE", "distanceKm": self.calculate_distance_km(lat, lng, 20.2920, 85.8290)},
                {"id": "cam-103", "name": "Saheed Nagar Grid", "road": "Janpath", "status": "WARNING", "distanceKm": self.calculate_distance_km(lat, lng, 20.2890, 85.8350)}
            ],
            "trafficConditions": {
                "congestionLevel": "HEAVY" if incident_data.get("priority") in ["CRITICAL", "HIGH"] else "MODERATE",
                "avgSpeedKmh": 18.5 if incident_data.get("priority") == "CRITICAL" else 32.0,
                "affectedRoads": incident_data.get("affectedRoads", ["Janpath Road", "NH-16 Jayadev Flyover"])
            },
            "weatherConditions": {
                "tempC": 31.4,
                "condition": "Heavy Rainfall / Thunderstorm Warning",
                "windKmh": 28.0,
                "rainMm": 42.5
            },
            "nearbyHospitals": [
                {"name": "AIIMS Bhubaneswar", "distKm": self.calculate_distance_km(lat, lng, 20.2280, 85.7760), "bedsAvailable": 14},
                {"name": "Capital Hospital Unit 6", "distKm": self.calculate_distance_km(lat, lng, 20.2640, 85.8290), "bedsAvailable": 8},
                {"name": "KIMS Super Specialty Hospital", "distKm": self.calculate_distance_km(lat, lng, 20.3520, 85.8180), "bedsAvailable": 22}
            ],
            "policeStations": [
                {"name": "Jayadev Vihar Police Outpost", "distKm": self.calculate_distance_km(lat, lng, 20.2970, 85.8250)},
                {"name": "Saheed Nagar Police Station", "distKm": self.calculate_distance_km(lat, lng, 20.2880, 85.8380)}
            ],
            "fireStations": [
                {"name": "Bhubaneswar Fire Station Unit-1", "distKm": self.calculate_distance_km(lat, lng, 20.2690, 85.8360)},
                {"name": "Chandrasekharpur Fire Sub-Station", "distKm": self.calculate_distance_km(lat, lng, 20.3240, 85.8150)}
            ],
            "infrastructureStatus": {
                "powerGrid": "SUBSTATION 3 TRIP WARNING",
                "drainage": "PUMPING STATION 4 ACTIVE (HIGH FLOW)",
                "bridgeStatus": "UNDERPASS JANPATH WATERLOGGED (30cm)"
            },
            "relatedNews": [
                {
                    "headline": "OSDMA issues urban flood alert for Bhubaneswar low-lying zones",
                    "publisher": "Odisha Disaster Relief Cell",
                    "time": "10 mins ago"
                }
            ],
            "historicalIncidentsCount": 4
        }
        return context
