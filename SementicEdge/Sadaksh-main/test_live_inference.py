"""
test_live_inference.py
-----------------------
Diagnostic verification test script: Tests base64 image decoding and PyTorch YOLOv8 + ByteTrack inference execution.
"""

import sys
import os
import time
import base64
import json

user_site = os.path.expanduser(r"~\AppData\Roaming\Python\Python313\site-packages")
if os.path.exists(user_site) and user_site not in sys.path:
    sys.path.insert(0, user_site)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

print("==================================================")
print("[DIAGNOSTIC TEST] Sadaksh Base64 Frame PyTorch Inference")
print("==================================================")

try:
    import cv2
    import numpy as np
    import torch
    from tracker import Tracker

    print("✓ STEP 1: Dependencies & Repository Import: SUCCESS")
    weights_path = os.path.join(os.path.dirname(__file__), "yolov8n.pt")
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    print(f"✓ STEP 2: Loading YOLOv8 weights ({weights_path})...")
    tracker = Tracker(model_path=weights_path, conf_threshold=0.25, device=device)
    print("✓ STEP 2: Model & ByteTrack Initialized: SUCCESS")

    # Create a 320x240 test frame with a drawn person-like shape for detection test
    frame = np.zeros((240, 320, 3), dtype=np.uint8)
    cv2.circle(frame, (160, 60), 30, (200, 200, 200), -1) # Head
    cv2.rectangle(frame, (130, 90), (190, 190), (200, 200, 200), -1) # Torso

    # Convert to Base64 JPEG (mimicking browser webcam frame transmission)
    _, buffer = cv2.imencode('.jpg', frame)
    b64_str = base64.b64encode(buffer).decode('utf-8')
    print("✓ STEP 3: Base64 Browser Frame Received & Encoded: SUCCESS")

    # Decode Base64 Frame
    img_data = base64.b64decode(b64_str)
    nparr = np.frombuffer(img_data, np.uint8)
    decoded_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if decoded_img is None:
        print("❌ STEP 4 FAILED: Base64 Image Decode Failed")
    else:
        print("✓ STEP 4: Base64 Frame Decoded into OpenCV Matrix: SUCCESS")
        t0 = time.time()
        detections = tracker.track(decoded_img)
        t1 = time.time()
        latency = round((t1 - t0) * 1000, 1)
        fps = round(1000 / max(latency, 1), 1)

        print(f"✓ STEP 5: PyTorch YOLOv8 Predict() + ByteTrack Track() Executed in {latency}ms ({fps} FPS): SUCCESS")
        print(f"✓ STEP 6: Detections Returned: {len(detections)} objects")

        json_output = {
            "fps": fps,
            "latency": latency,
            "detections": detections
        }
        print("\n[RETURNED DETECTION TELEMETRY JSON]")
        print(json.dumps(json_output, indent=2))

except Exception as ex:
    print(f"❌ DIAGNOSTIC FAILURE: {ex}")
    import traceback
    traceback.print_exc()
