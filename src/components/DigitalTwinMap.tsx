import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Incident,
  LandmarkNode,
  DroneUnit,
  MapLayersState,
  WeatherData,
  Severity,
  TrafficCorridor,
  TrafficSensor,
  TrafficSummary,
  NavItem,
  CameraNode,
  HospitalNode,
  PoliceNode,
  FireNode,
  UtilityNode,
  BasemapStyle,
} from '../types';
import { CentralLayerManager } from '../services/LayerManager';
import { LayerControlToolbar } from './LayerControlToolbar';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Compass,
  Maximize2,
  Home,
  Search,
  Ruler,
  Eye,
  Activity,
  Shield,
  Flame,
  Zap,
  Radio,
  Building2,
  Navigation,
  CloudRain,
  SlidersHorizontal,
  Box,
  Car,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Video,
  HeartPulse,
  Globe,
  X,
  Play,
  CheckCircle,
} from 'lucide-react';

interface DigitalTwinMapProps {
  incidents: Incident[];
  landmarks: LandmarkNode[];
  drones: DroneUnit[];
  layersState: MapLayersState;
  setLayersState: React.Dispatch<React.SetStateAction<MapLayersState>>;
  weather: WeatherData;
  trafficCorridors?: TrafficCorridor[];
  trafficSensors?: TrafficSensor[];
  trafficSummary?: TrafficSummary;
  activeTab?: NavItem;
  onSelectIncident: (incident: Incident) => void;
  selectedIncident: Incident | null;
  onSelectLandmark: (landmark: LandmarkNode) => void;
  onSelectDrone: (drone: DroneUnit) => void;
  onSelectCorridor?: (corridor: TrafficCorridor) => void;
  selectedCorridor?: TrafficCorridor | null;
}

export const DigitalTwinMap: React.FC<DigitalTwinMapProps> = ({
  incidents,
  landmarks,
  drones,
  layersState,
  setLayersState,
  weather,
  trafficCorridors = [],
  trafficSensors = [],
  trafficSummary,
  activeTab = 'Dashboard',
  onSelectIncident,
  selectedIncident,
  onSelectLandmark,
  onSelectDrone,
  onSelectCorridor,
  selectedCorridor,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const layerManager = CentralLayerManager.getInstance();

  const [searchQuery, setSearchQuery] = useState('');
  const [is3DMode, setIs3DMode] = useState(false);
  const [measuringMode, setMeasuringMode] = useState(false);
  const [measuredDistance, setMeasuredDistance] = useState<number | null>(null);
  const measurePointsRef = useRef<[number, number][]>([]);
  const measurePolylineRef = useRef<L.Polyline | null>(null);
  const measureMarkersRef = useRef<L.Marker[]>([]);
  const measuringModeRef = useRef<boolean>(false);

  // Active Selected Entity Modals
  const [selectedCamera, setSelectedCamera] = useState<CameraNode | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<HospitalNode | null>(null);
  const [selectedPolice, setSelectedPolice] = useState<PoliceNode | null>(null);
  const [selectedFire, setSelectedFire] = useState<FireNode | null>(null);
  const [selectedUtility, setSelectedUtility] = useState<UtilityNode | null>(null);

  // Sync measuringMode ref & cursor style
  useEffect(() => {
    measuringModeRef.current = measuringMode;
    if (mapContainerRef.current) {
      mapContainerRef.current.style.cursor = measuringMode ? 'crosshair' : '';
    }
    if (!measuringMode) {
      clearMeasurement();
    }
  }, [measuringMode]);

  const clearMeasurement = () => {
    measurePointsRef.current = [];
    if (measurePolylineRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(measurePolylineRef.current);
      measurePolylineRef.current = null;
    }
    measureMarkersRef.current.forEach((m) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(m);
      }
    });
    measureMarkersRef.current = [];
    setMeasuredDistance(null);
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Bhubaneswar center: 20.2961, 85.8245
    const map = L.map(mapContainerRef.current, {
      center: [20.2961, 85.8245],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // Tile Layer based on basemapStyle or satellite
    const tileUrl = layersState.satellite
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, { maxZoom: 19, subdomains: 'abcd' }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    // Measurement Click Handler using Ref to avoid stale closure
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!measuringModeRef.current) return;
      const { lat, lng } = e.latlng;
      measurePointsRef.current.push([lat, lng]);

      const ptCount = measurePointsRef.current.length;
      let totalDist = 0;
      for (let i = 1; i < measurePointsRef.current.length; i++) {
        const p1 = L.latLng(measurePointsRef.current[i - 1]);
        const p2 = L.latLng(measurePointsRef.current[i]);
        totalDist += p1.distanceTo(p2);
      }

      const distLabel = ptCount === 1 ? 'Start Point' : `${(totalDist / 1000).toFixed(2)} km`;

      const pinIcon = L.divIcon({
        className: 'custom-measure-pin',
        html: `<div class="w-5 h-5 rounded-full bg-[#F59E0B] text-black font-mono font-bold text-[10px] flex items-center justify-center border-2 border-black shadow-lg">${ptCount}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker([lat, lng], { icon: pinIcon })
        .bindTooltip(distLabel, {
          permanent: true,
          direction: 'top',
          className: 'bg-[#0A0A0A] border border-[#F59E0B] text-[#F59E0B] font-mono text-[10px] px-1.5 py-0.5 rounded shadow-xl font-bold',
        })
        .addTo(map);

      measureMarkersRef.current.push(marker);

      if (measurePolylineRef.current) {
        measurePolylineRef.current.setLatLngs(measurePointsRef.current);
      } else {
        measurePolylineRef.current = L.polyline(measurePointsRef.current, {
          color: '#F59E0B',
          weight: 3,
          dashArray: '6, 8',
        }).addTo(map);
      }

      setMeasuredDistance(Math.round(totalDist));
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Basemap Tiles when satellite or basemapStyle changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    const style = layersState.basemapStyle || (layersState.satellite ? 'satellite' : 'dark');
    let url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    if (style === 'satellite' || style === 'hybrid') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    } else if (style === 'street') {
      url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    } else if (style === 'terrain') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}';
    } else if (style === 'night') {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    }

    L.tileLayer(url, { maxZoom: 19, subdomains: 'abcd' }).addTo(map);
  }, [layersState.satellite, layersState.basemapStyle]);

  // Comprehensive Entity Rendering Engine for ALL 11 Layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // ----------------------------------------------------------------------
    // LAYER 1 — TRAFFIC (Polylines, IoT Speed Sensors, Flow Vectors)
    // ----------------------------------------------------------------------
    if (layersState.traffic || activeTab === 'Traffic Management') {
      trafficCorridors.forEach((corridor) => {
        let color = '#10B981'; // CLEAR
        let weight = 4;
        let dashArray: string | undefined = undefined;

        if (corridor.congestionLevel === 'SEVERE') {
          color = '#EF4444';
          weight = 7;
          dashArray = '8, 6';
        } else if (corridor.congestionLevel === 'JAMMED') {
          color = '#EF4444';
          weight = 6;
        } else if (corridor.congestionLevel === 'SLOW') {
          color = '#F59E0B';
          weight = 5;
        }

        const isSelected = selectedCorridor?.id === corridor.id;

        const poly = L.polyline(corridor.path, {
          color: isSelected ? '#06B6D4' : color,
          weight: isSelected ? weight + 3 : weight,
          opacity: isSelected ? 1 : 0.85,
          dashArray,
        }).addTo(group);

        poly.bindTooltip(
          `
          <div class="font-mono text-[10px] p-1.5 bg-[#0A0A0A] text-white border border-white/20 rounded shadow-xl">
            <div class="font-bold text-[#06B6D4] uppercase">${corridor.name}</div>
            <div class="text-white/60 text-[9px]">${corridor.roadName}</div>
            <div class="mt-1 flex justify-between space-x-3">
              <span>SPEED: <strong style="color: ${color}">${corridor.avgSpeedKmh} km/h</strong></span>
              <span class="text-white/40">FREEFLOW: ${corridor.freeFlowSpeedKmh} km/h</span>
            </div>
            <div class="flex justify-between text-[9px] mt-0.5">
              <span>CONGESTION: <strong style="color: ${color}">${corridor.congestionLevel} (${corridor.congestionScore}%)</strong></span>
            </div>
          </div>
          `,
          { sticky: true, opacity: 0.95 }
        );

        if (onSelectCorridor) {
          poly.on('click', () => onSelectCorridor(corridor));
        }
      });

      // Render Traffic Radar Sensors
      trafficSensors.forEach((sensor) => {
        const isSpeedSlow = sensor.speed < 20;
        const badgeColor = isSpeedSlow
          ? 'bg-[#EF4444] text-white animate-pulse'
          : sensor.speed < 35
          ? 'bg-[#F59E0B] text-black'
          : 'bg-[#10B981] text-black';

        const sensorIcon = L.divIcon({
          className: 'custom-traffic-sensor-marker',
          html: `
            <div class="relative flex items-center space-x-1 cursor-pointer transform hover:scale-125 transition-transform bg-[#0A0A0A]/90 border border-white/20 px-1.5 py-0.5 rounded shadow-lg font-mono text-[9px]">
              <span class="w-2 h-2 rounded-full ${sensor.status === 'ALERT' ? 'bg-[#EF4444] animate-ping' : 'bg-[#10B981]'}"></span>
              <span class="text-white/70 font-bold">${sensor.id}</span>
              <span class="px-1 rounded text-[8px] font-bold ${badgeColor}">${sensor.speed}k</span>
            </div>
          `,
          iconSize: [60, 20],
          iconAnchor: [30, 10],
        });

        const sensorMarker = L.marker([sensor.lat, sensor.lng], { icon: sensorIcon });
        sensorMarker.bindTooltip(
          `
          <div class="font-mono text-[10px] bg-[#0A0A0A] text-white p-1.5 border border-white/20 rounded">
            <div class="font-bold text-[#06B6D4]">${sensor.id} - ${sensor.name}</div>
            <div class="text-white/70">RADAR SPEED: <strong class="text-white">${sensor.speed} km/h</strong></div>
            <div class="text-white/70">FLOW RATE: <strong class="text-[#10B981]">${sensor.vehicleRatePerMin} veh/min</strong></div>
          </div>
          `,
          { sticky: true }
        );
        sensorMarker.addTo(group);
      });
    }

    // ----------------------------------------------------------------------
    // LAYER 2 — INCIDENTS (Pulsing emergency markers)
    // ----------------------------------------------------------------------
    if (layersState.incidents) {
      incidents.forEach((inc) => {
        const isSelected = selectedIncident?.id === inc.id;
        const colorClass =
          inc.priority === 'CRITICAL'
            ? 'bg-red-500 border-red-300 text-red-100 shadow-[0_0_15px_#ef4444]'
            : inc.priority === 'HIGH'
            ? 'bg-amber-500 border-amber-300 text-amber-100 shadow-[0_0_12px_#f59e0b]'
            : inc.priority === 'MEDIUM'
            ? 'bg-yellow-500 border-yellow-200 text-yellow-950'
            : 'bg-emerald-500 border-emerald-300 text-emerald-950';

        const customIcon = L.divIcon({
          className: 'custom-incident-marker',
          html: `
            <div class="relative flex items-center justify-center cursor-pointer transform hover:scale-125 transition-transform">
              <span class="absolute inline-flex h-8 w-8 rounded-full ${
                inc.priority === 'CRITICAL' ? 'bg-red-500 animate-ping opacity-75' : 'bg-amber-500 animate-pulse opacity-50'
              }"></span>
              <div class="relative w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-mono font-bold ${colorClass}">
                ${inc.category[0]}
              </div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([inc.location.lat, inc.location.lng], { icon: customIcon });
        marker.on('click', () => onSelectIncident(inc));
        marker.addTo(group);
      });
    }

    // ----------------------------------------------------------------------
    // LAYER 3 — WEATHER (IMD Doppler Radar & Flood Risk Circle Overlay)
    // ----------------------------------------------------------------------
    if (layersState.weather) {
      // Primary Doppler Radar Circle around Jayadev Vihar/Patia
      const weatherRadarCircle = L.circle([20.3150, 85.8250], {
        radius: 3500,
        color: '#06B6D4',
        weight: 1.5,
        dashArray: '4, 4',
        fillColor: '#06B6D4',
        fillOpacity: 0.15,
      }).addTo(group);

      weatherRadarCircle.bindTooltip(
        `
        <div class="font-mono text-[10px] bg-[#0A0A0A] text-white p-1.5 border border-[#06B6D4]/40 rounded">
          <div class="font-bold text-[#06B6D4] uppercase">IMD Doppler Weather Radar Grid</div>
          <div>RAIN INTENSITY: <strong class="text-white">${weather.rainIntensity} mm/hr</strong></div>
          <div>FLOOD RISK LEVEL: <strong class="text-yellow-400">${weather.floodRiskLevel}</strong></div>
          <div class="text-white/50 text-[9px] mt-0.5">${weather.forecast}</div>
        </div>
        `,
        { sticky: true }
      );

      // Core Inundation Risk Polygon
      L.polygon(
        [
          [20.3080, 85.8200],
          [20.3050, 85.8300],
          [20.2980, 85.8280],
          [20.3000, 85.8180],
        ],
        {
          color: '#EF4444',
          weight: 2,
          fillColor: '#EF4444',
          fillOpacity: 0.2,
        }
      ).addTo(group);
    }

    // ----------------------------------------------------------------------
    // LAYER 4 — UTILITIES (Power Sub-stations, Water Lines, FiberPOP Grid)
    // ----------------------------------------------------------------------
    if (layersState.utilities) {
      const utilityNodes = layerManager.getUtilities();

      utilityNodes.forEach((u) => {
        const isOutage = u.status === 'CRITICAL_OUTAGE';
        const isWarning = u.status === 'WARNING';
        const colorClass = isOutage
          ? 'bg-red-500 text-white animate-pulse border-red-300'
          : isWarning
          ? 'bg-amber-500 text-black border-amber-300'
          : 'bg-yellow-400 text-black border-yellow-200';

        const iconSymbol =
          u.type === 'POWER_SUBSTATION'
            ? '⚡'
            : u.type === 'WATER_PUMP'
            ? '💧'
            : u.type === 'GAS_PIPELINE'
            ? '🔥'
            : '📡';

        const icon = L.divIcon({
          className: 'custom-utility-marker',
          html: `
            <div class="w-6 h-6 rounded-md border flex items-center justify-center text-xs shadow-lg ${colorClass} hover:scale-125 transition-transform cursor-pointer">
              <span>${iconSymbol}</span>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([u.lat, u.lng], { icon });
        marker.on('click', () => setSelectedUtility(u));
        marker.bindTooltip(
          `
          <div class="font-mono text-[10px] bg-[#0A0A0A] text-white p-1.5 border border-yellow-500/40 rounded">
            <div class="font-bold text-yellow-400 uppercase">${u.name}</div>
            <div>LOAD: <strong class="text-white">${u.currentLoadPct}%</strong> (${u.capacityMetric})</div>
            <div>STATUS: <strong class="${isOutage ? 'text-red-400' : 'text-emerald-400'}">${u.status}</strong></div>
          </div>
          `,
          { sticky: true }
        );
        marker.addTo(group);
      });

      // Render Power Grid Connecting Line
      const powerLineCoords: [number, number][] = [
        [20.2800, 85.8380], // Central Substation
        [20.3450, 85.8120], // Patia Substation
      ];
      L.polyline(powerLineCoords, {
        color: '#EAB308',
        weight: 2,
        dashArray: '6, 6',
        opacity: 0.7,
      }).addTo(group);
    }

    // ----------------------------------------------------------------------
    // LAYER 5 — CAMERAS (CCTV Radar & ANPR Telemetry Nodes)
    // ----------------------------------------------------------------------
    if (layersState.cameras) {
      const cameraNodes = layerManager.getCameras();

      cameraNodes.forEach((cam) => {
        const isAlert = cam.status === 'ALERT';
        const icon = L.divIcon({
          className: 'custom-camera-marker',
          html: `
            <div class="relative flex items-center justify-center cursor-pointer transform hover:scale-125 transition-transform">
              <div class="w-7 h-7 rounded-md bg-[#0A0A0A] border ${
                isAlert ? 'border-red-500 text-red-400 shadow-[0_0_10px_#ef4444]' : 'border-indigo-400 text-indigo-400 shadow-[0_0_10px_#6366f1]'
              } flex items-center justify-center">
                <span class="text-[10px]">🎥</span>
              </div>
              <span class="absolute -top-1 -right-1 px-1 rounded-full bg-[#06B6D4] text-black font-mono font-bold text-[7px]">
                ${cam.detectedVehicles}
              </span>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([cam.lat, cam.lng], { icon });
        marker.on('click', () => setSelectedCamera(cam));
        marker.bindTooltip(
          `
          <div class="font-mono text-[10px] bg-[#0A0A0A] text-white p-1.5 border border-indigo-500/40 rounded">
            <div class="font-bold text-indigo-400 uppercase">${cam.name}</div>
            <div class="text-white/60">${cam.model}</div>
            <div class="mt-1 flex justify-between space-x-2">
              <span>VEHICLES: <strong class="text-white">${cam.detectedVehicles}</strong></span>
              <span>PEDESTRIANS: <strong class="text-white">${cam.detectedPedestrians}</strong></span>
            </div>
            <div class="text-[9px] text-cyan-400 mt-0.5">Click to open Live CCTV Stream</div>
          </div>
          `,
          { sticky: true }
        );
        marker.addTo(group);
      });
    }

    // ----------------------------------------------------------------------
    // LAYER 6 — DRONES (Animated GARUDA UAV Aerial Units & Path Rings)
    // ----------------------------------------------------------------------
    if (layersState.drones) {
      drones.forEach((d) => {
        const droneIcon = L.divIcon({
          className: 'custom-drone-marker',
          html: `
            <div class="relative flex items-center justify-center text-teal-400 hover:scale-125 transition-transform cursor-pointer">
              <span class="absolute inline-flex h-8 w-8 rounded-full bg-teal-400/20 animate-ping"></span>
              <div class="w-7 h-7 rounded-full bg-[#0A0A0A] border border-teal-400 flex items-center justify-center shadow-[0_0_12px_#14b8a6]">
                <span class="text-[11px] font-mono font-bold">🛸</span>
              </div>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([d.lat, d.lng], { icon: droneIcon });
        marker.on('click', () => onSelectDrone(d));

        // Render 500m Coverage Radius Circle
        L.circle([d.lat, d.lng], {
          radius: 500,
          color: '#14B8A6',
          weight: 1,
          dashArray: '3, 3',
          fillOpacity: 0.05,
        }).addTo(group);

        marker.addTo(group);
      });
    }

    // ----------------------------------------------------------------------
    // LAYER 7 — HOSPITALS (Apex Trauma Centers & Emergency Bed Telemetry)
    // ----------------------------------------------------------------------
    if (layersState.hospitals) {
      const hospitalNodes = layerManager.getHospitals();

      hospitalNodes.forEach((h) => {
        const icon = L.divIcon({
          className: 'custom-hospital-marker',
          html: `
            <div class="w-7 h-7 rounded-md bg-[#0A0A0A] border border-rose-500 text-rose-400 flex items-center justify-center shadow-[0_0_10px_#f43f5e] hover:scale-125 transition-transform cursor-pointer">
              <span class="text-[12px]">🏥</span>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([h.lat, h.lng], { icon });
        marker.on('click', () => setSelectedHospital(h));
        marker.bindTooltip(
          `
          <div class="font-mono text-[10px] bg-[#0A0A0A] text-white p-1.5 border border-rose-500/40 rounded">
            <div class="font-bold text-rose-400 uppercase">${h.name}</div>
            <div class="text-white/60">${h.type} | ${h.traumaLevel}</div>
            <div class="mt-1 flex justify-between space-x-3">
              <span>AVAILABLE BEDS: <strong class="text-emerald-400">${h.availableBeds}</strong></span>
              <span>ICU: <strong class="text-cyan-400">${h.availableICU}</strong></span>
            </div>
          </div>
          `,
          { sticky: true }
        );
        marker.addTo(group);
      });

      // If an Incident is selected, draw shortest casualty ambulance route from nearest hospital!
      if (selectedIncident) {
        const nearestHosp = layerManager.findNearestHospital(selectedIncident.location.lat, selectedIncident.location.lng);
        if (nearestHosp) {
          L.polyline(
            [
              [nearestHosp.lat, nearestHosp.lng],
              [selectedIncident.location.lat, selectedIncident.location.lng],
            ],
            {
              color: '#F43F5E',
              weight: 3,
              dashArray: '4, 4',
            }
          ).addTo(group);
        }
      }
    }

    // ----------------------------------------------------------------------
    // LAYER 8 — POLICE (Commissionerate HQ & PCR Patrol Vans)
    // ----------------------------------------------------------------------
    if (layersState.police) {
      const policeNodes = layerManager.getPolice();

      policeNodes.forEach((p) => {
        const isStation = p.type === 'STATION';
        const iconSymbol = isStation ? '👮' : '🚓';
        const icon = L.divIcon({
          className: 'custom-police-marker',
          html: `
            <div class="w-7 h-7 rounded-md bg-[#0A0A0A] border border-blue-500 text-blue-400 flex items-center justify-center shadow-[0_0_10px_#3b82f6] hover:scale-125 transition-transform cursor-pointer">
              <span class="text-[12px]">${iconSymbol}</span>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([p.lat, p.lng], { icon });
        marker.on('click', () => setSelectedPolice(p));
        marker.bindTooltip(
          `
          <div class="font-mono text-[10px] bg-[#0A0A0A] text-white p-1.5 border border-blue-500/40 rounded">
            <div class="font-bold text-blue-400 uppercase">${p.name}</div>
            <div class="text-white/60">SECTOR: ${p.sector} | STATUS: <strong class="text-emerald-400">${p.status}</strong></div>
          </div>
          `,
          { sticky: true }
        );
        marker.addTo(group);
      });

      // Route nearest police patrol to selected incident
      if (selectedIncident) {
        const nearestPatrol = layerManager.findNearestPolicePatrol(selectedIncident.location.lat, selectedIncident.location.lng);
        if (nearestPatrol) {
          L.polyline(
            [
              [nearestPatrol.lat, nearestPatrol.lng],
              [selectedIncident.location.lat, selectedIncident.location.lng],
            ],
            {
              color: '#3B82F6',
              weight: 3,
              dashArray: '6, 6',
            }
          ).addTo(group);
        }
      }
    }

    // ----------------------------------------------------------------------
    // LAYER 9 — FIRE (Fire Stations, Tenders & 3km Coverage Radius Circles)
    // ----------------------------------------------------------------------
    if (layersState.fire) {
      const fireNodes = layerManager.getFire();

      fireNodes.forEach((f) => {
        const icon = L.divIcon({
          className: 'custom-fire-marker',
          html: `
            <div class="w-7 h-7 rounded-md bg-[#0A0A0A] border border-orange-500 text-orange-400 flex items-center justify-center shadow-[0_0_10px_#f97316] hover:scale-125 transition-transform cursor-pointer">
              <span class="text-[12px]">🚒</span>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([f.lat, f.lng], { icon });
        marker.on('click', () => setSelectedFire(f));

        if (f.coverageRadiusKm > 0) {
          L.circle([f.lat, f.lng], {
            radius: f.coverageRadiusKm * 1000,
            color: '#F97316',
            weight: 1,
            dashArray: '5, 5',
            fillOpacity: 0.04,
          }).addTo(group);
        }

        marker.bindTooltip(
          `
          <div class="font-mono text-[10px] bg-[#0A0A0A] text-white p-1.5 border border-orange-500/40 rounded">
            <div class="font-bold text-orange-400 uppercase">${f.name}</div>
            <div class="text-white/60">TENDERS: <strong class="text-white">${f.tendersAvailable}</strong> | FOAM: ${f.foamCapacityLiters}L</div>
          </div>
          `,
          { sticky: true }
        );
        marker.addTo(group);
      });
    }

    // ----------------------------------------------------------------------
    // LAYER 10 — 3D EXTRUSIONS (3D Building Height Polygon Styling)
    // ----------------------------------------------------------------------
    if (layersState.buildings3D) {
      const bldgPoints: [number, number][][] = [
        // Secretariat Complex Polygon
        [[20.2755, 85.833], [20.2755, 85.835], [20.2735, 85.835], [20.2735, 85.833]],
        // BMC Corporate Tower
        [[20.292, 85.844], [20.292, 85.846], [20.29, 85.846], [20.29, 85.844]],
        // Master Canteen Station Plaza
        [[20.2685, 85.8395], [20.2685, 85.841], [20.267, 85.841], [20.267, 85.8395]],
        // Kalinga Stadium Main Arena
        [[20.3010, 85.8200], [20.3010, 85.8230], [20.2980, 85.8230], [20.2980, 85.8200]],
        // KIIT Infocity Tech Hub
        [[20.3540, 85.8170], [20.3540, 85.8200], [20.3510, 85.8200], [20.3510, 85.8170]],
      ];

      bldgPoints.forEach((poly) => {
        L.polygon(poly, {
          color: '#FCD34D',
          weight: 2,
          fillColor: '#F59E0B',
          fillOpacity: 0.35,
        }).addTo(group);
      });
    }

    // ----------------------------------------------------------------------
    // INFRASTRUCTURE LANDMARKS
    // ----------------------------------------------------------------------
    landmarks.forEach((lm) => {
      let shouldShow = false;
      let symbol = '🏛️';
      let iconColor = 'text-cyan-400 border-cyan-500/60 bg-slate-900';

      if (lm.type === 'HOSPITAL' && layersState.hospitals) {
        shouldShow = true;
        symbol = '🏥';
      } else if (lm.type === 'POLICE' && layersState.police) {
        shouldShow = true;
        symbol = '👮';
      } else if (lm.type === 'FIRE' && layersState.fire) {
        shouldShow = true;
        symbol = '🚒';
      } else if (layersState.infrastructure) {
        shouldShow = true;
      }

      if (shouldShow) {
        const icon = L.divIcon({
          className: 'custom-landmark-marker',
          html: `
            <div class="w-6 h-6 rounded-md border flex items-center justify-center text-xs shadow-md ${iconColor} hover:scale-110 transition-transform">
              <span>${symbol}</span>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([lm.lat, lm.lng], { icon });
        marker.on('click', () => onSelectLandmark(lm));
        marker.addTo(group);
      }
    });

  }, [incidents, landmarks, drones, layersState, selectedIncident, selectedCorridor]);

  // Handle Search Location in Bhubaneswar
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstanceRef.current) return;
    const query = searchQuery.toLowerCase();

    const matchedLandmark = landmarks.find((l) => l.name.toLowerCase().includes(query));
    if (matchedLandmark) {
      mapInstanceRef.current.flyTo([matchedLandmark.lat, matchedLandmark.lng], 16, { duration: 1.5 });
      onSelectLandmark(matchedLandmark);
      return;
    }

    const matchedIncident = incidents.find(
      (i) => i.title.toLowerCase().includes(query) || i.location.name.toLowerCase().includes(query)
    );
    if (matchedIncident) {
      mapInstanceRef.current.flyTo([matchedIncident.location.lat, matchedIncident.location.lng], 16, { duration: 1.5 });
      onSelectIncident(matchedIncident);
      return;
    }
  };

  const resetHome = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([20.2961, 85.8245], 13, { duration: 1.2 });
    }
  };

  return (
    <div className="relative flex-1 h-full bg-[#050505] overflow-hidden select-none border-r border-white/10 flex flex-col">
      {/* TOP INTEGRATED LAYER CONTROL TOOLBAR */}
      <LayerControlToolbar layersState={layersState} setLayersState={setLayersState} />

      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Leaflet Map Canvas Container */}
        <div
          ref={mapContainerRef}
          className="w-full h-full z-0 transition-transform duration-700 ease-in-out origin-bottom"
          style={
            is3DMode
              ? {
                  transform: 'perspective(1000px) rotateX(25deg) scale(1.05)',
                  transformOrigin: 'center bottom',
                }
              : {
                  transform: 'none',
                }
          }
        />

        {/* Floating Search Bar */}
        <div className="absolute top-3 left-4 z-10 pointer-events-auto">
          <form
            onSubmit={handleSearch}
            className="flex items-center bg-[#0A0A0A]/95 backdrop-blur-md border border-white/10 rounded px-3 py-1.5 w-72 shadow-2xl font-mono text-xs"
          >
            <Search className="w-3.5 h-3.5 text-white/40 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Bhubaneswar locations..."
              className="bg-transparent text-white placeholder-white/30 focus:outline-none w-full"
            />
          </form>
        </div>

        {/* Right Floating Map Control Tools */}
        <div className="absolute top-16 right-4 z-10 flex flex-col space-y-2 pointer-events-auto font-mono">
          <button
            onClick={() => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.zoomIn();
              }
            }}
            className="w-8 h-8 rounded bg-[#0A0A0A]/95 backdrop-blur-md border border-white/10 hover:border-[#06B6D4]/50 hover:bg-white/10 text-white flex items-center justify-center shadow-xl transition-all active:scale-95"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={() => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.zoomOut();
              }
            }}
            className="w-8 h-8 rounded bg-[#0A0A0A]/95 backdrop-blur-md border border-white/10 hover:border-[#06B6D4]/50 hover:bg-white/10 text-white flex items-center justify-center shadow-xl transition-all active:scale-95"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={resetHome}
            className="w-8 h-8 rounded bg-[#0A0A0A]/95 backdrop-blur-md border border-white/10 hover:border-[#06B6D4] hover:bg-[#06B6D4]/10 text-[#06B6D4] flex items-center justify-center shadow-xl transition-all active:scale-95"
            title="Reset to Bhubaneswar Home"
          >
            <Home className="w-4 h-4 text-[#06B6D4]" />
          </button>
          <button
            onClick={() => setIs3DMode(!is3DMode)}
            className={`w-8 h-8 rounded border backdrop-blur-md flex items-center justify-center shadow-xl transition-all active:scale-95 ${
              is3DMode
                ? 'bg-[#06B6D4]/15 text-[#06B6D4] border-[#06B6D4]/60 shadow-[0_0_12px_rgba(6,182,212,0.3)] ring-1 ring-[#06B6D4]/40'
                : 'bg-[#0A0A0A]/95 text-white/40 border-white/10 hover:text-white'
            }`}
            title="Toggle 3D Perspective Mode"
          >
            <Box className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setMeasuringMode(!measuringMode);
            }}
            className={`w-8 h-8 rounded border backdrop-blur-md flex items-center justify-center shadow-xl transition-all active:scale-95 ${
              measuringMode
                ? 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/60 shadow-[0_0_12px_rgba(245,158,11,0.3)] ring-1 ring-[#F59E0B]/40'
                : 'bg-[#0A0A0A]/95 text-white/40 border-white/10 hover:text-white'
            }`}
            title="Distance Measurement Tool"
          >
            <Ruler className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Camera Live Stream Modal */}
        {selectedCamera && (
          <div className="absolute top-16 right-16 z-30 w-80 bg-[#0A0A0A]/95 backdrop-blur-md border border-indigo-500/50 rounded-lg p-3 font-mono text-xs shadow-2xl pointer-events-auto space-y-2.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center space-x-2">
                <Video className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span className="font-bold text-white uppercase text-[11px] truncate max-w-[180px]">
                  {selectedCamera.name}
                </span>
              </div>
              <button onClick={() => setSelectedCamera(null)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-video bg-black rounded overflow-hidden border border-white/10 group flex items-center justify-center">
              {selectedCamera.streamUrl ? (
                <video
                  src={selectedCamera.streamUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : selectedCamera.thumbnailUrl ? (
                <img src={selectedCamera.thumbnailUrl} alt="CCTV Feed" className="w-full h-full object-cover opacity-80" />
              ) : (
                <div className="text-white/40 text-[10px]">Awaiting Live CCTV Feed...</div>
              )}

              {/* Animated AI Bounding Boxes Overlay */}
              <div className="absolute inset-0 pointer-events-none p-3">
                <div className="absolute top-1/4 left-1/3 w-16 h-12 border-2 border-amber-400/80 rounded bg-amber-400/10 flex items-start p-0.5">
                  <span className="bg-amber-400 text-black text-[7px] font-bold px-1 rounded">VEHICLE #104</span>
                </div>
                <div className="absolute bottom-1/3 right-1/4 w-12 h-10 border-2 border-[#06B6D4]/80 rounded bg-[#06B6D4]/10 flex items-start p-0.5">
                  <span className="bg-[#06B6D4] text-black text-[7px] font-bold px-1 rounded">ANPR READ</span>
                </div>
              </div>

              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-red-600 text-white font-bold text-[8px] flex items-center space-x-1 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                <span>RTSP LIVE</span>
              </div>
              <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[#06B6D4] text-[8px] border border-white/10">
                {selectedCamera.model}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-white/[0.03] p-1.5 rounded border border-white/5">
                <div className="text-white/40">VEHICLES DETECTED</div>
                <div className="text-sm font-bold text-indigo-400">{selectedCamera.detectedVehicles}</div>
              </div>
              <div className="bg-white/[0.03] p-1.5 rounded border border-white/5">
                <div className="text-white/40">PEDESTRIANS</div>
                <div className="text-sm font-bold text-cyan-400">{selectedCamera.detectedPedestrians}</div>
              </div>
            </div>
          </div>
        )}

        {/* Hospital Telemetry Modal */}
        {selectedHospital && (
          <div className="absolute top-16 right-16 z-30 w-80 bg-[#0A0A0A]/95 backdrop-blur-md border border-rose-500/50 rounded-lg p-3 font-mono text-xs shadow-2xl pointer-events-auto space-y-2 font-mono">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center space-x-2">
                <HeartPulse className="w-4 h-4 text-rose-400 animate-pulse" />
                <span className="font-bold text-white uppercase text-[11px] truncate max-w-[180px]">
                  {selectedHospital.name}
                </span>
              </div>
              <button onClick={() => setSelectedHospital(null)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[10px] text-white/60">{selectedHospital.address}</div>

            <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center">
              <div className="bg-white/[0.03] p-1.5 rounded border border-white/5">
                <div className="text-white/40 text-[8px]">TOTAL BEDS</div>
                <div className="font-bold text-white">{selectedHospital.totalBeds}</div>
              </div>
              <div className="bg-white/[0.03] p-1.5 rounded border border-white/5">
                <div className="text-white/40 text-[8px]">AVAILABLE</div>
                <div className="font-bold text-emerald-400">{selectedHospital.availableBeds}</div>
              </div>
              <div className="bg-white/[0.03] p-1.5 rounded border border-white/5">
                <div className="text-white/40 text-[8px]">ICU BEDS</div>
                <div className="font-bold text-cyan-400">{selectedHospital.availableICU}</div>
              </div>
            </div>
          </div>
        )}

        {/* Police Patrol Telemetry Modal */}
        {selectedPolice && (
          <div className="absolute top-16 right-16 z-30 w-80 bg-[#0A0A0A]/95 backdrop-blur-md border border-blue-500/50 rounded-lg p-3 font-mono text-xs shadow-2xl pointer-events-auto space-y-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-blue-400 animate-pulse" />
                <span className="font-bold text-white uppercase text-[11px] truncate max-w-[180px]">
                  {selectedPolice.name}
                </span>
              </div>
              <button onClick={() => setSelectedPolice(null)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[10px] text-white/60">SECTOR: {selectedPolice.sector}</div>
            <div className="flex justify-between text-[10px] bg-white/[0.03] p-2 rounded border border-white/5">
              <span>STATUS: <strong className="text-emerald-400">{selectedPolice.status}</strong></span>
              <span>PERSONNEL: <strong className="text-white">{selectedPolice.personnelCount}</strong></span>
            </div>
          </div>
        )}

        {/* Fire Station Telemetry Modal */}
        {selectedFire && (
          <div className="absolute top-16 right-16 z-30 w-80 bg-[#0A0A0A]/95 backdrop-blur-md border border-orange-500/50 rounded-lg p-3 font-mono text-xs shadow-2xl pointer-events-auto space-y-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center space-x-2">
                <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
                <span className="font-bold text-white uppercase text-[11px] truncate max-w-[180px]">
                  {selectedFire.name}
                </span>
              </div>
              <button onClick={() => setSelectedFire(null)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[10px] text-white/60">{selectedFire.address}</div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-white/[0.03] p-1.5 rounded border border-white/5">
                <div className="text-white/40">TENDERS READY</div>
                <div className="font-bold text-orange-400">{selectedFire.tendersAvailable}</div>
              </div>
              <div className="bg-white/[0.03] p-1.5 rounded border border-white/5">
                <div className="text-white/40">FOAM CAPACITY</div>
                <div className="font-bold text-white">{selectedFire.foamCapacityLiters} L</div>
              </div>
            </div>
          </div>
        )}

        {/* Utility Telemetry Modal */}
        {selectedUtility && (
          <div className="absolute top-16 right-16 z-30 w-80 bg-[#0A0A0A]/95 backdrop-blur-md border border-yellow-500/50 rounded-lg p-3 font-mono text-xs shadow-2xl pointer-events-auto space-y-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
                <span className="font-bold text-white uppercase text-[11px] truncate max-w-[180px]">
                  {selectedUtility.name}
                </span>
              </div>
              <button onClick={() => setSelectedUtility(null)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[10px] text-white/60">ZONE: {selectedUtility.gridZone}</div>
            <div className="bg-white/[0.03] p-2 rounded border border-white/5 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>GRID LOAD:</span>
                <strong className="text-yellow-400">{selectedUtility.currentLoadPct}%</strong>
              </div>
              <div className="flex justify-between">
                <span>CAPACITY:</span>
                <strong className="text-white">{selectedUtility.capacityMetric}</strong>
              </div>
              <div className="flex justify-between">
                <span>AI OUTAGE RISK:</span>
                <strong className={selectedUtility.outageRiskScore > 50 ? 'text-red-400' : 'text-emerald-400'}>
                  {selectedUtility.outageRiskScore}% Risk
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* Measurement Display */}
        {measuringMode && (
          <div className="absolute bottom-6 left-4 z-20 bg-[#0A0A0A]/95 backdrop-blur-md border border-[#F59E0B]/50 px-3.5 py-2 rounded-lg text-xs font-mono text-[#F59E0B] shadow-2xl flex items-center space-x-3 pointer-events-auto">
            <Ruler className="w-4 h-4 text-[#F59E0B] animate-pulse shrink-0" />
            <div className="flex items-center space-x-2">
              <span>
                {measuredDistance !== null
                  ? `Total Distance: ${(measuredDistance / 1000).toFixed(2)} km (${measuredDistance} m)`
                  : 'Click on 2 or more map locations to measure line distance...'}
              </span>
              {measurePointsRef.current.length > 0 && (
                <button
                  onClick={clearMeasurement}
                  className="ml-2 px-2 py-0.5 rounded bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 border border-[#F59E0B]/50 text-[#F59E0B] text-[10px] font-bold transition-all"
                >
                  Clear Points
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bottom Center Coordinate HUD */}
        <div className="absolute bottom-2 right-4 z-10 px-3 py-1 rounded bg-[#0A0A0A]/90 backdrop-blur-sm border border-white/10 text-[10px] font-mono text-white/40 flex items-center space-x-4 shadow-lg pointer-events-none uppercase">
          <div>
            LAT: <span className="text-[#06B6D4]">20.2961° N</span>
          </div>
          <div>
            LNG: <span className="text-[#06B6D4]">85.8245° E</span>
          </div>
          <div>
            ALT: <span className="text-white">45m AMSL</span>
          </div>
          <div>
            DRAINAGE: <span className="text-[#10B981]">STABLE (62%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

