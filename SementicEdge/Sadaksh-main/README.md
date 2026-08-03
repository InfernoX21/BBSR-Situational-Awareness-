# SADAKSH : Real-Time Traffic Analysis System

> **YOLOv8 · ByteTrack · Trajectory Visualization · CSV Logging**

Detects and tracks **person, bicycle, car, motorcycle, bus, and truck** in real time from a webcam or video file.

![SADAKSH Demo](asset/demo.png)


---

## Project Structure

```
SADAKSH/
├── requirements.txt
├── README.md
├── asset/
│  ├── demo1.mp4
│  └── demo2.mp4
├── output/
│  ├── logs/
│  └── video/
└── src/
    ├── __init__.py
    ├── detector.py       # YOLOv8 detection-only wrapper
    ├── tracker.py        # YOLOv8 + ByteTrack tracker
    ├── trajectory.py     # Per-track trajectory (last 30 points)
    ├── draw_utils.py     # Bounding box / label drawing helpers
    ├── logger.py         # CSV logging module (swap-able for SQLite)
    └── main.py           # Application entry point
```

---

## Installation

### 1. Create and activate a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate          # macOS / Linux
# .venv\Scripts\activate           # Windows
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

> `yolov8n.pt` is downloaded automatically on the first run (~6 MB).

---

## Running the Application

> [!IMPORTANT]
> **Always activate the virtual environment first**, or use the `run.sh` wrapper.
> Running `python3 src/main.py` directly (without activation) will fail on macOS
> because Homebrew's `Python.app` bundle resolves script paths relative to its
> own location rather than the shell's working directory.

### Option A — Activate venv, then run (recommended for development)

```bash
source .venv/bin/activate
python3 src/main.py                          # webcam
python3 src/main.py --source video.mp4      # video file
python3 src/main.py --save-video            # save output
```

### Option B — Use the convenience wrapper (no activation needed)

```bash
./run.sh                                     # webcam
./run.sh --source video.mp4                 # video file
./run.sh --save-video --output result.mp4   # save output
./run.sh --no-track                         # detection only
```

The `run.sh` script activates the venv and forwards all arguments to `main.py`.

### Webcam (default)

```bash
source .venv/bin/activate
python3 src/main.py
```

### Video file

```bash
source .venv/bin/activate
python3 src/main.py --source path/to/video.mp4
```

### Detection only (no ByteTrack)

```bash
source .venv/bin/activate
python3 src/main.py --no-track
```

### Save output video

```bash
source .venv/bin/activate
python3 src/main.py --save-video --output result.mp4
```

### GPU inference (CUDA device 0)

```bash
python src/main.py --device 0
```

### All options

```
python src/main.py --help

Options:
  --source SOURCE       Camera index or video file path (default: 0)
  --model MODEL         YOLOv8 weights file (default: yolov8n.pt)
  --conf CONF           Confidence threshold (default: 0.40)
  --device DEVICE       'cpu' or '0' for first GPU (default: cpu)
  --no-track            Disable ByteTrack; pure detection mode
  --save-video          Save annotated video to --output
  --output OUTPUT       Output video filename (default: output.mp4)
  --log LOG             CSV log filename (default: detection_log.csv)
```

Press **`q`** in the display window to quit.

---

## Output

### On-screen display

| Visual element | Description |
|---|---|
| Coloured bounding box | Class-specific colour per object type |
| Label | `#<track_id> <class> <confidence%>` |
| Trajectory polyline | Last 30 centre points per track |
| FPS counter | Top-left corner |

### CSV Log — `detection_log.csv`

| Column | Description |
|---|---|
| `timestamp` | ISO-8601 datetime |
| `frame_number` | Sequential frame index |
| `track_id` | ByteTrack persistent ID (−1 if no-track mode) |
| `class` | Object class name |
| `confidence` | Detection confidence (0–1) |
| `x1 y1 x2 y2` | Bounding box coordinates (pixels) |
| `center_x center_y` | Bounding box centre (pixels) |
| `line_crossing_status` | Reserved for line-crossing logic (default: "none") |

---

## Architecture Notes

- **`detector.py`** and **`tracker.py`** share the same output schema so `main.py` can switch between them with `--no-track`.
- **`logger.py`** exposes only `init_logger()` and `log_entry()`. To swap to SQLite, replace this file with a `logger_sqlite.py` that implements the same two functions — no other file needs to change.
- **ByteTrack** is used via the official Ultralytics built-in tracker (`tracker="bytetrack.yaml"`), which is the production-recommended integration path. No third-party BYTETrack package is required.

---

## Detected Classes

| COCO ID | Class |
|---|---|
| 0 | person |
| 1 | bicycle |
| 2 | car |
| 3 | motorcycle |
| 5 | bus |
| 7 | truck |
