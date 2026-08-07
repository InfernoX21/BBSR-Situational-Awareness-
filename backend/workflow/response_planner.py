"""
ARKA Response Planner Engine
Phase 4 — Dynamic Buffer Zone
Phase 5 — Resource Recommendation Engine
Phase 6 — Route Optimisation
"""

import math
from typing import Dict, List, Any

class ResponsePlannerEngine:
    SUPPORTED_BUFFERS = [100, 250, 500, 1000]

    @staticmethod
    def calculate_buffer_zone(lat: float, lng: float, radius_meters: int = 500) -> Dict[str, Any]:
        if radius_meters not in ResponsePlannerEngine.SUPPORTED_BUFFERS:
            radius_meters = 500
        
        # Approximate 1 degree ~ 111,000 meters
        delta_lat = radius_meters / 111000.0
        delta_lng = radius_meters / (111000.0 * math.cos(math.radians(lat)))

        bounds = {
            "north": lat + delta_lat,
            "south": lat - delta_lat,
            "east": lng + delta_lng,
            "west": lng - delta_lng
        }

        return {
            "center": {"lat": lat, "lng": lng},
            "radiusMeters": radius_meters,
            "bounds": bounds,
            "affectedZone": f"{radius_meters}m EOC Response Perimeter"
        }

    @staticmethod
    def rank_responders(incident_category: str, lat: float, lng: float) -> List[Dict[str, Any]]:
        # Mock pool of available responder units across emergency services
        pool = [
            {
                "unitId": "FIRE-101",
                "unitName": "Bhubaneswar Water Tender Unit 1",
                "unitType": "Fire Engines",
                "baseLat": 20.2690,
                "baseLng": 85.8360,
                "capability": ["FIRE", "FLOOD", "HAZMAT"],
                "status": "AVAILABLE",
                "baseStation": "Unit-1 Fire Station"
            },
            {
                "unitId": "POLICE-204",
                "unitName": "PCR Squad Delta 4",
                "unitType": "Police Vehicles",
                "baseLat": 20.2970,
                "baseLng": 85.8250,
                "capability": ["SECURITY", "TRAFFIC", "ACCIDENT"],
                "status": "AVAILABLE",
                "baseStation": "Jayadev Vihar Outpost"
            },
            {
                "unitId": "AMB-302",
                "unitName": "108 ALS Ambulance Squad 2",
                "unitType": "Ambulances",
                "baseLat": 20.2640,
                "baseLng": 85.8290,
                "capability": ["MEDICAL", "TRAUMA", "ACCIDENT"],
                "status": "AVAILABLE",
                "baseStation": "Capital Hospital Base"
            },
            {
                "unitId": "DRONE-501",
                "unitName": "SkyWatch Surveillance Drone 1",
                "unitType": "Drone Units",
                "baseLat": 20.2950,
                "baseLng": 85.8240,
                "capability": ["TRAFFIC", "FIRE", "FLOOD", "SECURITY"],
                "status": "AVAILABLE",
                "baseStation": "TMC Command Center"
            },
            {
                "unitId": "ODRAF-401",
                "unitName": "ODRAF Rescue Team Alpha",
                "unitType": "Response Teams",
                "baseLat": 20.3100,
                "baseLng": 85.8200,
                "capability": ["FLOOD", "DISASTER", "UTILITY"],
                "status": "AVAILABLE",
                "baseStation": "OSDMA HQ"
            }
        ]

        ranked = []
        for unit in pool:
            # calculate distance
            dlat = math.radians(unit["baseLat"] - lat)
            dlng = math.radians(unit["baseLng"] - lng)
            a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat)) * math.cos(math.radians(unit["baseLat"])) * math.sin(dlng / 2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            dist_km = round(6371.0 * c, 2)
            
            # calculate speed/ETA (avg city speed 30 km/h)
            eta_min = max(2, int(round((dist_km / 30.0) * 60)))
            
            match_pct = 95 if incident_category in unit["capability"] else 70
            
            ranked.append({
                "unitId": unit["unitId"],
                "unitName": unit["unitName"],
                "unitType": unit["unitType"],
                "distanceKm": dist_km,
                "etaMinutes": eta_min,
                "capabilityMatchPct": match_pct,
                "status": unit["status"],
                "baseStation": unit["baseStation"]
            })

        # Sort by match percentage desc, then ETA asc
        ranked.sort(key=lambda u: (-u["capabilityMatchPct"], u["etaMinutes"]))
        
        for i, item in enumerate(ranked):
            item["rank"] = i + 1

        return ranked

    @staticmethod
    def calculate_optimized_route(start_lat: float, start_lng: float, end_lat: float, end_lng: float) -> List[List[float]]:
        """Generates waypoint coordinates for responder route animation on Cesium."""
        steps = 10
        route = []
        for i in range(steps + 1):
            t = i / steps
            # Add slight curve to simulate real road network geometry
            offset = math.sin(t * math.pi) * 0.002
            cur_lat = round(start_lat + (end_lat - start_lat) * t + offset, 6)
            cur_lng = round(start_lng + (end_lng - start_lng) * t, 6)
            route.append([cur_lat, cur_lng])
        return route
