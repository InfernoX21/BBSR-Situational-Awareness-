"""
ai_server.py
------------
FastAPI microservice wrapping Sadaksh YOLOv8 + ByteTrack detection & tracking pipeline.
Exposes real PyTorch inference on camera frames.
"""

import os
import sys
import time
import base64
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

# Ensure src directory is on Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

try:
    import cv2
    import numpy as np
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from tracker import Tracker
    from trajectory import TrajectoryTracker
    HAS_DEPENDENCIES = True
except Exception as e:
    print(f"Warning: Python dependencies missing or loading error: {e}")
    HAS_DEPENDENCIES = False

app = FastAPI(title="Sadaksh AI Inference Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

tracker_instance = None
trajectory_instance = None

if HAS_DEPENDENCIES:
    try:
        weights_path = os.path.join(os.path.dirname(__file__), "yolov8n.pt")
        tracker_instance = Tracker(model_path=weights_path, conf_threshold=0.35, device="cpu")
        trajectory_instance = TrajectoryTracker(max_history=10)
        print(f"✅ Sadaksh YOLOv8 + ByteTrack loaded from: {weights_path}")
    except Exception as err:
        print(f"❌ Error loading YOLOv8 model: {err}")

class FrameRequest(BaseModel):
    cameraId: Optional[str] = "CAM-JV-01"
    frame: Optional[str] = None

@app.get("/health")
@app.get("/status")
def get_status():
    if tracker_instance is not None:
        return {
            "status": "ONLINE",
            "model_name": "Sadaksh YOLOv8 + ByteTrack Engine",
            "weights_path": os.path.join(os.path.dirname(__file__), "yolov8n.pt"),
            "device": "cpu",
            "tracker": "bytetrack",
            "supported_classes": ["person", "car", "truck", "bus", "motorcycle", "bicycle"],
            "timestamp": time.time(),
        }
    return {
        "status": "OFFLINE",
        "error": "YOLOv8 PyTorch model instance not loaded",
        "timestamp": time.time(),
    }

@app.post("/analyze-frame")
def analyze_frame(req: FrameRequest):
    if tracker_instance is None:
        return {
            "status": "OFFLINE",
            "camera_id": req.cameraId,
            "vehicle_count": 0,
            "person_count": 0,
            "detections": [],
            "error": "Sadaksh AI Model Offline"
        }

    if not req.frame:
        return {
            "status": "ONLINE",
            "camera_id": req.cameraId,
            "vehicle_count": 0,
            "person_count": 0,
            "detections": []
        }

    try:
        t0 = time.time()
        # Decode base64 frame string
        header, encoded = req.frame.split(",", 1) if "," in req.frame else ("", req.frame)
        data = base64.b64decode(encoded)
        nparr = np.frombuffer(data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"status": "ERROR", "error": "Invalid image payload", "detections": []}

        h, w, _ = img.shape

        # Run ByteTrack inference
        raw_detections = tracker_instance.update(img)
        t1 = time.time()
        latency_ms = round((t1 - t0) * 1000, 2)

        # Update trajectories
        if trajectory_instance is not None:
            trajectory_instance.update(raw_detections)

        processed_detections = []
        vehicle_count = 0
        person_count = 0

        for d in raw_detections:
            track_id = d.get("track_id", -1)
            cls_name = d.get("cls_name", "object")
            conf = round(float(d.get("conf", 0.0)), 2)
            bbox = d.get("bbox", [0, 0, 0, 0]) # [x1, y1, x2, y2]

            # Normalize bounding box to percentages [x_pct, y_pct, w_pct, h_pct]
            x1, y1, x2, y2 = bbox
            x_pct = round((x1 / w) * 100, 2)
            y_pct = round((y1 / h) * 100, 2)
            w_pct = round(((x2 - x1) / w) * 100, 2)
            h_pct = round(((y2 - y1) / h) * 100, 2)

            if cls_name == "person":
                person_count += 1
            else:
                vehicle_count += 1

            processed_detections.append({
                "track_id": track_id,
                "class": cls_name,
                "confidence": conf,
                "bbox_pct": [x_pct, y_pct, w_pct, h_pct],
                "bbox_pixels": [int(x1), int(y1), int(x2), int(y2)]
            })

        return {
            "status": "ONLINE",
            "camera_id": req.cameraId,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "vehicle_count": vehicle_count,
            "person_count": person_count,
            "total_count": len(processed_detections),
            "latency_ms": latency_ms,
            "fps": round(1000 / max(latency_ms, 1), 1),
            "detections": processed_detections
        }

    except Exception as ex:
        return {
            "status": "ERROR",
            "error": str(ex),
            "camera_id": req.cameraId,
            "detections": []
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
