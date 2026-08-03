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

# Automatically append site-packages path for installed dependencies
user_site = os.path.expanduser(r"~\AppData\Roaming\Python\Python313\site-packages")
if os.path.exists(user_site) and user_site not in sys.path:
    sys.path.insert(0, user_site)

# Ensure src directory is on Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

print("======================================================")
print("[+] STARTING SADAKSH AI MODEL INFERENCE SERVICE")
print("======================================================")

HAS_DEPENDENCIES = False
tracker_instance = None
trajectory_instance = None

try:
    import cv2
    import numpy as np
    import torch
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from tracker import Tracker
    from trajectory import TrajectoryStore

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
        trajectory_instance = TrajectoryStore(max_len=15)
        print("[+] Step 2 SUCCESS: PyTorch YOLOv8 + ByteTrack Model Loaded & Ready!")
    except Exception as err:
        import traceback
        print(f"[-] Step 2 FAILED: Error initializing PyTorch YOLOv8 Tracker: {err}")
        traceback.print_exc()

app = FastAPI(title="Sadaksh AI Inference Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class FrameRequest(BaseModel):
    cameraId: Optional[str] = "CAM-LAPTOP-01"
    frame: Optional[str] = None

@app.get("/health")
@app.get("/status")
def get_status():
    if tracker_instance is not None:
        return {
            "status": "READY",
            "model_name": "Sadaksh YOLOv8 + ByteTrack Engine",
            "weights": "yolov8n.pt",
            "device": tracker_instance.device,
            "tracker": "bytetrack",
            "timestamp": time.time(),
        }
    return {
        "status": "OFFLINE",
        "error": "Sadaksh AI Model Instance Offline",
        "timestamp": time.time(),
    }

@app.post("/analyze-frame")
def analyze_frame(req: FrameRequest):
    if tracker_instance is None:
        print("[-] Stage 1 FAILED: Sadaksh AI Model Instance is Offline")
        return {
            "status": "OFFLINE",
            "camera": req.cameraId or "CAM-LAPTOP-01",
            "fps": 0,
            "latency": 0,
            "detections": [],
            "error": "Sadaksh AI Model Offline"
        }

    if not req.frame:
        print(f"[+] Stage 1: Frame Check for camera {req.cameraId} - Empty frame payload")
        return {
            "status": "READY",
            "camera": req.cameraId or "CAM-LAPTOP-01",
            "fps": 30,
            "latency": 5,
            "detections": []
        }

    try:
        t0 = time.time()
        print(f"[+] Stage 1: Frame Received for Camera {req.cameraId}")

        # Clean base64 frame string
        raw_b64 = req.frame
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        
        # Add padding if needed
        missing_padding = len(raw_b64) % 4
        if missing_padding:
            raw_b64 += "=" * (4 - missing_padding)

        data = base64.b64decode(raw_b64)
        nparr = np.frombuffer(data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None or img.size == 0:
            print(f"[-] Stage 2 FAILED: OpenCV Failed to Decode Image Bytes for {req.cameraId}")
            return {"status": "ERROR", "camera": req.cameraId, "detections": []}

        h, w, _ = img.shape
        print(f"[+] Stage 2 SUCCESS: OpenCV Frame Decoded ({w}x{h} px)")

        # Run PyTorch YOLOv8 + ByteTrack Tracker using tracker.track() method
        print("[+] Stage 3: Executing PyTorch YOLOv8 Predict() + ByteTrack Track()...")
        raw_detections = tracker_instance.track(img)
        t1 = time.time()
        latency_ms = round((t1 - t0) * 1000, 1)
        fps = round(1000 / max(latency_ms, 1), 1)
        print(f"[+] Stage 3 SUCCESS: Inference Completed in {latency_ms}ms ({fps} FPS)")

        processed_detections = []
        for d in raw_detections:
            track_id = int(d.get("track_id", 0))
            cls_name = str(d.get("cls_name", "object"))
            conf = round(float(d.get("conf", 0.0)), 2)
            bbox = d.get("bbox", [0, 0, 0, 0]) # [x1, y1, x2, y2]

            x1, y1, x2, y2 = bbox
            cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)

            if trajectory_instance is not None and track_id > 0:
                trajectory_instance.update(track_id, (cx, cy))

            # Normalize bounding box to percentages [x_pct, y_pct, w_pct, h_pct]
            x_pct = round((x1 / w) * 100, 1)
            y_pct = round((y1 / h) * 100, 1)
            w_pct = round(((x2 - x1) / w) * 100, 1)
            h_pct = round(((y2 - y1) / h) * 100, 1)

            processed_detections.append({
                "track_id": track_id,
                "class": cls_name,
                "confidence": conf,
                "bbox": [x_pct, y_pct, w_pct, h_pct],
                "bbox_pixels": [int(x1), int(y1), int(x2), int(y2)]
            })

        if len(processed_detections) == 0:
            print(f"[+] Stage 4: No detections returned by model for frame {req.cameraId}")
        else:
            print(f"[+] Stage 4 SUCCESS: {len(processed_detections)} Objects Detected ({[d['class'] for d in processed_detections]})")

        print(f"[+] Stage 5 SUCCESS: Sending Detection JSON to Frontend")

        return {
            "status": "READY",
            "camera": req.cameraId or "CAM-LAPTOP-01",
            "fps": fps,
            "latency": latency_ms,
            "detections": processed_detections
        }

    except Exception as ex:
        print(f"[-] Pipeline Failure Stage Exception: {ex}")
        import traceback
        traceback.print_exc()
        return {
            "status": "ERROR",
            "error": str(ex),
            "camera": req.cameraId,
            "detections": []
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8008)
