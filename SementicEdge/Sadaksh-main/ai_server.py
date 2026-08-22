"""
ai_server.py
------------
Production FastAPI Microservice — Sadaksh PyTorch YOLOv8 + ByteTrack
Full Computer Vision Intelligence Engine for ARKA Platform.

Endpoints:
  GET  /health              — Model health check
  GET  /status              — Alias for /health
  GET  /diagnostics         — Full AI diagnostics panel data
  GET  /statistics          — Cumulative detection statistics
  GET  /analytics/history   — Last N frames of aggregated analytics
  POST /analyze-frame       — Primary inference endpoint (base64 frame)
  POST /infer               — Alias for /analyze-frame
"""

import os
import sys
import time
import base64
import math
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Deque

from pydantic import BaseModel

# Ensure src directory is on Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

print("======================================================")
print("[+] STARTING SADAKSH AI MODEL INFERENCE SERVICE v2.0")
print("======================================================")

HAS_DEPENDENCIES = False
tracker_instance = None
trajectory_instance = None

try:
    import cv2
    import numpy as np
    import torch
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from tracker import Tracker
    from trajectory import TrajectoryStore
    import logger as csv_logger

    print("[+] Step 1: Repository & Python Dependencies Verified")
    HAS_DEPENDENCIES = True
except Exception as e:
    import traceback
    print(f"[-] Step 1 FAILED: Sadaksh Repository / Dependency Load Error: {e}")
    traceback.print_exc()

if HAS_DEPENDENCIES:
    try:
        weights_path = os.path.join(os.path.dirname(__file__), "yolov8n.pt")
        device = "cuda:0" if torch.cuda.is_available() else "cpu"
        print(f"[+] Step 2: Loading YOLOv8 Weights from {weights_path}...")
        print(f"[+] Step 2: Initializing ByteTrack Tracker on Device {device}...")
        tracker_instance = Tracker(model_path=weights_path, conf_threshold=0.25, device=device)
        trajectory_instance = TrajectoryStore(max_len=30)
        csv_logger.init_logger("detection_log.csv")
        print("[+] Step 2 SUCCESS: PyTorch YOLOv8 + ByteTrack Model Loaded & Ready!")
    except Exception as err:
        import traceback
        print(f"[-] Step 2 FAILED: Error initializing PyTorch YOLOv8 Tracker: {err}")
        traceback.print_exc()

app = FastAPI(title="Sadaksh AI Inference Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════════════════════════════
# In-memory analytics state — persists across frames
# ═══════════════════════════════════════════════════════════════════════════════

# Per-track state: {track_id: {"cx":int, "cy":int, "t":float, "first_seen":float, "history":deque}}
track_state: Dict[int, Dict[str, Any]] = {}

# Cumulative statistics
cumulative_stats: Dict[str, Any] = {
    "total_frames_processed": 0,
    "total_detections": 0,
    "class_totals": defaultdict(int),
    "event_log": deque(maxlen=50),
    "congestion_history": deque(maxlen=100),
    "fps_history": deque(maxlen=30),
    "start_time": time.time(),
    "last_inference_time": None,
    "error_count": 0,
}

# Analytics history ring-buffer (last 60 frames)
analytics_history: Deque[Dict[str, Any]] = deque(maxlen=60)


class FrameRequest(BaseModel):
    cameraId: Optional[str] = "CAM-LAPTOP-01"
    frame: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _movement_direction(points: list) -> str:
    """Derive cardinal movement direction from trajectory point list."""
    if len(points) < 4:
        return "STATIONARY"
    first = points[0]
    last = points[-1]
    dx = last[0] - first[0]
    dy = last[1] - first[1]
    if abs(dx) < 2 and abs(dy) < 2:
        return "STATIONARY"
    angle = math.degrees(math.atan2(-dy, dx))  # screen y is inverted
    if -45 <= angle < 45:
        return "EAST"
    elif 45 <= angle < 135:
        return "NORTH"
    elif angle >= 135 or angle < -135:
        return "WEST"
    else:
        return "SOUTH"


def _estimate_speed_kmh(points: list, time_diff: float, frame_w: int) -> float:
    """Rough speed estimate: pixel displacement → meters → km/h assuming ~30m lane width."""
    if len(points) < 2 or time_diff <= 0:
        return 0.0
    first = points[0]
    last = points[-1]
    pixel_dist = math.hypot(last[0] - first[0], last[1] - first[1])
    # Assume frame width represents ~30 m of road
    meters = (pixel_dist / max(frame_w, 1)) * 30.0
    speed_ms = meters / time_diff
    return round(speed_ms * 3.6, 1)


def _quadrant(cx: int, cy: int, w: int, h: int) -> str:
    """Return which quadrant of the frame a point is in."""
    half_w, half_h = w // 2, h // 2
    if cx < half_w and cy < half_h:
        return "TL"
    elif cx >= half_w and cy < half_h:
        return "TR"
    elif cx < half_w and cy >= half_h:
        return "BL"
    else:
        return "BR"


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
@app.get("/status")
def get_health():
    is_online = tracker_instance is not None
    gpu_available = torch.cuda.is_available() if HAS_DEPENDENCIES else False
    uptime = round(time.time() - cumulative_stats["start_time"], 1)
    return {
        "status": "READY" if is_online else "OFFLINE",
        "model_loaded": is_online,
        "tracker_loaded": is_online,
        "gpu": gpu_available,
        "active_streams": 1 if is_online else 0,
        "model_name": "Sadaksh YOLOv8 + ByteTrack Engine",
        "weights": "yolov8n.pt",
        "device": tracker_instance.device if is_online else "none",
        "uptime_seconds": uptime,
        "timestamp": time.time(),
    }


@app.get("/diagnostics")
def get_diagnostics():
    """Full AI diagnostics panel data for the ARKA AI Diagnostics component."""
    is_online = tracker_instance is not None
    gpu_available = torch.cuda.is_available() if HAS_DEPENDENCIES else False
    uptime = round(time.time() - cumulative_stats["start_time"], 1)
    avg_fps = 0.0
    if cumulative_stats["fps_history"]:
        avg_fps = round(sum(cumulative_stats["fps_history"]) / len(cumulative_stats["fps_history"]), 1)

    recent_errors = cumulative_stats["error_count"]
    last_inf = cumulative_stats["last_inference_time"]

    return {
        "status": "READY" if is_online else "OFFLINE",
        "model": {
            "name": "Sadaksh YOLOv8n + ByteTrack",
            "weights": "yolov8n.pt",
            "weights_path": os.path.join(os.path.dirname(__file__), "yolov8n.pt"),
            "conf_threshold": 0.25,
            "tracker": "ByteTrack (Ultralytics built-in)",
            "trajectory_len": 30,
            "device": tracker_instance.device if is_online else "none",
            "loaded": is_online,
        },
        "hardware": {
            "gpu_available": gpu_available,
            "gpu_name": torch.cuda.get_device_name(0) if (HAS_DEPENDENCIES and gpu_available) else "None",
            "cpu_fallback": not gpu_available,
        },
        "performance": {
            "avg_fps": avg_fps,
            "fps_samples": list(cumulative_stats["fps_history"]),
            "frames_processed": cumulative_stats["total_frames_processed"],
            "total_detections": cumulative_stats["total_detections"],
            "uptime_seconds": uptime,
            "error_count": recent_errors,
        },
        "streams": {
            "active": 1 if is_online else 0,
            "last_inference_ts": last_inf,
        },
        "logger": {
            "type": "CSV",
            "path": "detection_log.csv",
            "active": is_online,
        },
        "classes_supported": ["person", "bicycle", "car", "motorcycle", "bus", "truck"],
        "events_supported": [
            "STOPPED_VEHICLE", "HIGH_CONGESTION", "PEDESTRIAN_CROWDING",
            "WRONG_WAY", "SUDDEN_SLOWDOWN", "ROAD_BLOCKAGE"
        ],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/statistics")
def get_statistics():
    """Cumulative detection statistics across all frames."""
    is_online = tracker_instance is not None
    recent_events = list(cumulative_stats["event_log"])
    congestion_hist = list(cumulative_stats["congestion_history"])

    level_counts: Dict[str, int] = {}
    for entry in congestion_hist:
        lvl = entry.get("level", "FREE_FLOW")
        level_counts[lvl] = level_counts.get(lvl, 0) + 1

    return {
        "status": "READY" if is_online else "OFFLINE",
        "engine": "Sadaksh PyTorch YOLOv8 + ByteTrack",
        "model_weights": "yolov8n.pt",
        "device": tracker_instance.device if is_online else "none",
        "frames_processed": cumulative_stats["total_frames_processed"],
        "total_detections": cumulative_stats["total_detections"],
        "class_totals": dict(cumulative_stats["class_totals"]),
        "active_tracks": len(track_state),
        "congestion_history": congestion_hist[-20:],
        "congestion_level_distribution": level_counts,
        "event_log": recent_events[-20:],
        "uptime_seconds": round(time.time() - cumulative_stats["start_time"], 1),
        "last_inference_ts": cumulative_stats["last_inference_time"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/analytics/history")
def get_analytics_history(limit: int = 30):
    """Return the last N frames of aggregated analytics for trend charts."""
    items = list(analytics_history)[-limit:]
    return {
        "count": len(items),
        "history": items,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/analyze-frame")
@app.post("/infer")
def analyze_frame(req: FrameRequest):
    if tracker_instance is None:
        cumulative_stats["error_count"] += 1
        return {
            "status": "OFFLINE",
            "camera": req.cameraId or "CAM-LAPTOP-01",
            "fps": 0, "latency": 0,
            "detections": [],
            "analytics": {
                "vehicleCount": 0, "pedestrianCount": 0,
                "classCounts": {}, "congestionLevel": "OFFLINE",
                "density": "NONE", "flowRate": 0, "entryCount": 0, "exitCount": 0,
            },
            "events": [],
            "error": "Sadaksh AI Model Offline",
        }

    if not req.frame:
        return {
            "status": "READY",
            "camera": req.cameraId or "CAM-LAPTOP-01",
            "fps": 30, "latency": 5,
            "detections": [],
            "analytics": {
                "vehicleCount": 0, "pedestrianCount": 0,
                "classCounts": {}, "congestionLevel": "FREE_FLOW",
                "density": "LOW", "flowRate": 0, "entryCount": 0, "exitCount": 0,
            },
            "events": [],
        }

    try:
        t0 = time.time()

        # Decode base64 frame
        raw_b64 = req.frame
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        missing_padding = len(raw_b64) % 4
        if missing_padding:
            raw_b64 += "=" * (4 - missing_padding)

        data = base64.b64decode(raw_b64)
        nparr = np.frombuffer(data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None or img.size == 0:
            return {"status": "ERROR", "camera": req.cameraId, "detections": [], "events": []}

        h, w, _ = img.shape
        now_time = time.time()

        # ── Real PyTorch YOLOv8 + ByteTrack Inference ──────────────────────
        raw_detections = tracker_instance.track(img)

        t1 = time.time()
        latency_ms = round((t1 - t0) * 1000, 1)
        fps = round(1000 / max(latency_ms, 1), 1)

        # ── Update cumulative statistics ───────────────────────────────────
        cumulative_stats["total_frames_processed"] += 1
        cumulative_stats["last_inference_time"] = datetime.now(timezone.utc).isoformat()
        cumulative_stats["fps_history"].append(fps)

        # Track which IDs we see this frame (for entry/exit counting)
        current_frame_ids = set()

        processed_detections = []
        class_counts: Dict[str, int] = {}
        vehicle_count = 0
        pedestrian_count = 0
        events = []
        quadrant_persons: Dict[str, int] = {}

        for d in raw_detections:
            track_id = int(d.get("track_id", 0))
            cls_name = str(d.get("cls_name", "object"))
            conf = round(float(d.get("conf", 0.0)), 3)
            bbox = d.get("bbox", [0, 0, 0, 0])  # [x1, y1, x2, y2] pixels

            # Class counts
            class_counts[cls_name] = class_counts.get(cls_name, 0) + 1
            cumulative_stats["class_totals"][cls_name] += 1
            cumulative_stats["total_detections"] += 1

            if cls_name == "person":
                pedestrian_count += 1
            else:
                vehicle_count += 1

            x1, y1, x2, y2 = bbox
            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)

            current_frame_ids.add(track_id)

            # ── Update trajectory store ────────────────────────────────────
            if trajectory_instance is not None and track_id > 0:
                trajectory_instance.update(track_id, (cx, cy))

            # ── Retrieve trajectory points (normalized %) ─────────────────
            traj_points_raw = []
            if trajectory_instance is not None and track_id in trajectory_instance._history:
                traj_points_raw = list(trajectory_instance._history[track_id])

            traj_points = [
                [round((pt[0] / w) * 100, 1), round((pt[1] / h) * 100, 1)]
                for pt in traj_points_raw
            ]

            # ── Per-track state initialization ────────────────────────────
            if track_id > 0:
                if track_id not in track_state:
                    track_state[track_id] = {
                        "cx": cx, "cy": cy,
                        "first_seen": now_time,
                        "last_seen": now_time,
                        "history": deque(maxlen=15),
                        "class": cls_name,
                    }
                ts = track_state[track_id]
                ts["history"].append({"cx": cx, "cy": cy, "t": now_time})
                ts["last_seen"] = now_time
                dwell_time = round(now_time - ts["first_seen"], 1)

                # ── Stopped vehicle detection ──────────────────────────────
                if len(ts["history"]) >= 8 and cls_name in ("car", "bus", "truck", "motorcycle"):
                    first_pt = ts["history"][0]
                    dist = math.hypot(cx - first_pt["cx"], cy - first_pt["cy"])
                    time_diff_stopped = now_time - first_pt["t"]
                    if dist < 8 and time_diff_stopped > 4.0:
                        events.append({
                            "type": "STOPPED_VEHICLE",
                            "severity": "HIGH",
                            "track_id": track_id,
                            "class": cls_name,
                            "dwell_seconds": round(time_diff_stopped, 1),
                            "camera": req.cameraId,
                            "message": f"Track #{track_id} ({cls_name.upper()}) stationary for {round(time_diff_stopped, 1)}s",
                            "timestamp": cumulative_stats["last_inference_time"],
                        })

                # ── Movement direction ─────────────────────────────────────
                direction = _movement_direction(traj_points_raw)

                # ── Speed estimation ───────────────────────────────────────
                speed_kmh = 0.0
                if len(ts["history"]) >= 4:
                    time_diff_spd = ts["history"][-1]["t"] - ts["history"][0]["t"]
                    speed_kmh = _estimate_speed_kmh(traj_points_raw, time_diff_spd, w)

                # ── Wrong-way detection (vehicles going SOUTH on N-flow road) ──
                if cls_name in ("car", "bus", "truck") and direction == "SOUTH" and len(traj_points_raw) >= 6:
                    events.append({
                        "type": "WRONG_WAY",
                        "severity": "CRITICAL",
                        "track_id": track_id,
                        "class": cls_name,
                        "direction": direction,
                        "camera": req.cameraId,
                        "message": f"Track #{track_id} ({cls_name.upper()}) moving {direction} — potential wrong-way",
                        "timestamp": cumulative_stats["last_inference_time"],
                    })

                # ── Sudden slowdown detection ──────────────────────────────
                if speed_kmh < 5 and dwell_time > 2.0 and vehicle_count >= 3:
                    events.append({
                        "type": "SUDDEN_SLOWDOWN",
                        "severity": "MEDIUM",
                        "track_id": track_id,
                        "class": cls_name,
                        "speed_kmh": speed_kmh,
                        "camera": req.cameraId,
                        "message": f"Traffic slowdown: Track #{track_id} speed {speed_kmh} km/h",
                        "timestamp": cumulative_stats["last_inference_time"],
                    })

                # ── Pedestrian quadrant crowding ───────────────────────────
                if cls_name == "person":
                    quad = _quadrant(cx, cy, w, h)
                    quadrant_persons[quad] = quadrant_persons.get(quad, 0) + 1

            else:
                direction = "UNKNOWN"
                speed_kmh = 0.0
                dwell_time = 0.0

            # ── Convert bbox to percentage ─────────────────────────────────
            x_pct = round((x1 / w) * 100, 1)
            y_pct = round((y1 / h) * 100, 1)
            w_pct = round(((x2 - x1) / w) * 100, 1)
            h_pct = round(((y2 - y1) / h) * 100, 1)

            processed_detections.append({
                "track_id": track_id,
                "class": cls_name,
                "confidence": conf,
                "bbox": [x_pct, y_pct, w_pct, h_pct],
                "bbox_pixels": [int(x1), int(y1), int(x2), int(y2)],
                "trajectory": traj_points,
                "direction": direction,
                "speed_kmh": speed_kmh,
                "dwell_seconds": dwell_time,
            })

            # ── CSV logger ─────────────────────────────────────────────────
            csv_logger.log_entry(
                frame_number=cumulative_stats["total_frames_processed"],
                track_id=track_id,
                cls_name=cls_name,
                confidence=conf,
                bbox=[int(x1), int(y1), int(x2), int(y2)],
                center=(cx, cy),
            )

        # ── Pedestrian crowding event ──────────────────────────────────────
        for quad, count in quadrant_persons.items():
            if count >= 3:
                events.append({
                    "type": "PEDESTRIAN_CROWDING",
                    "severity": "MEDIUM",
                    "quadrant": quad,
                    "count": count,
                    "camera": req.cameraId,
                    "message": f"Pedestrian crowding: {count} persons in quadrant {quad}",
                    "timestamp": cumulative_stats["last_inference_time"],
                })

        # ── Purge stale tracks ─────────────────────────────────────────────
        if trajectory_instance is not None:
            trajectory_instance.purge(current_frame_ids)
        stale_ids = [tid for tid, st in track_state.items() if now_time - st["last_seen"] > 5.0]
        for tid in stale_ids:
            del track_state[tid]

        # ── Entry / exit counts ────────────────────────────────────────────
        entry_count = sum(1 for tid in current_frame_ids if tid not in track_state or
                         round(now_time - track_state.get(tid, {}).get("first_seen", now_time), 1) < 0.6)
        exit_count = len(stale_ids)

        # ── Flow rate (tracks seen per frame, normalized to /min) ──────────
        flow_rate_per_min = round(len(current_frame_ids) * 2, 1)  # ~2 fps inference rate

        # ── Congestion level ───────────────────────────────────────────────
        total_tracked = len(processed_detections)
        if total_tracked >= 10:
            congestion_level = "SEVERE"
            density = "HIGH"
            events.append({
                "type": "HIGH_CONGESTION",
                "severity": "HIGH",
                "count": total_tracked,
                "camera": req.cameraId,
                "message": f"Severe congestion: {total_tracked} active targets",
                "timestamp": cumulative_stats["last_inference_time"],
            })
        elif total_tracked >= 6:
            congestion_level = "MODERATE"
            density = "MEDIUM"
        elif total_tracked >= 2:
            congestion_level = "LOW"
            density = "LOW"
        else:
            congestion_level = "FREE_FLOW"
            density = "CLEAR"

        # ── Road blockage ──────────────────────────────────────────────────
        stopped_count = sum(1 for ev in events if ev["type"] == "STOPPED_VEHICLE")
        if stopped_count >= 2 and congestion_level in ("MODERATE", "SEVERE"):
            events.append({
                "type": "ROAD_BLOCKAGE",
                "severity": "CRITICAL",
                "stopped_count": stopped_count,
                "camera": req.cameraId,
                "message": f"Possible road blockage: {stopped_count} stopped vehicles detected",
                "timestamp": cumulative_stats["last_inference_time"],
            })

        # ── Append to cumulative state ─────────────────────────────────────
        for ev in events:
            cumulative_stats["event_log"].append(ev)

        congestion_snapshot = {
            "ts": cumulative_stats["last_inference_time"],
            "level": congestion_level,
            "vehicle_count": vehicle_count,
            "pedestrian_count": pedestrian_count,
            "fps": fps,
        }
        cumulative_stats["congestion_history"].append(congestion_snapshot)

        analytics_snapshot = {
            "ts": cumulative_stats["last_inference_time"],
            "fps": fps,
            "latency_ms": latency_ms,
            "vehicle_count": vehicle_count,
            "pedestrian_count": pedestrian_count,
            "total": total_tracked,
            "class_counts": dict(class_counts),
            "congestion_level": congestion_level,
            "density": density,
            "flow_rate": flow_rate_per_min,
            "events_count": len(events),
        }
        analytics_history.append(analytics_snapshot)

        return {
            "status": "READY",
            "camera": req.cameraId or "CAM-LAPTOP-01",
            "fps": fps,
            "latency": latency_ms,
            "detections": processed_detections,
            "analytics": {
                "vehicleCount": vehicle_count,
                "pedestrianCount": pedestrian_count,
                "totalTargets": total_tracked,
                "classCounts": class_counts,
                "congestionLevel": congestion_level,
                "density": density,
                "flowRate": flow_rate_per_min,
                "entryCount": entry_count,
                "exitCount": exit_count,
                "activeTracks": len(track_state),
            },
            "events": events,
        }

    except Exception as ex:
        import traceback
        traceback.print_exc()
        cumulative_stats["error_count"] += 1
        return {
            "status": "ERROR",
            "error": str(ex),
            "camera": req.cameraId,
            "detections": [],
            "events": [],
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8008)
