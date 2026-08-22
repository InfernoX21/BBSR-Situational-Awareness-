# ARKA data inventory (pre-change audit)

Audit date: 2026-08-23. Compiled by reading every source file under `src/` plus `server.ts`
and by probing each candidate upstream provider directly.

## Classification key

| Class | Meaning |
|---|---|
| `LIVE` | Fetched from a real current source at request time |
| `CACHED` | Previously live data, served with its own timestamp |
| `SEED` | Development/demo fixture committed in the repo |
| `SIMULATED` | Generated telemetry, jitter or animation |
| `FALLBACK` | Substitute served when a live fetch fails |
| `UNAVAILABLE` | No approved source is configured |

Rule applied throughout: if a source could not be verified, it is `UNAVAILABLE`, not `LIVE`.

## Source verification results

Probed 2026-08-23 from this workstation.

| Candidate source | Result | Verdict |
|---|---|---|
| Open-Meteo Forecast API | HTTP 200, real Bhubaneswar values, `elevation: 44 m` | **Usable** — keyless, CC-BY 4.0, <10k calls/day |
| Open-Meteo Air Quality API (CAMS) | HTTP 200, `us_aqi: 70`, `pm2_5: 20.7` | **Usable** — keyless; model output, ~45 km global grid |
| Open-Meteo Flood API (GloFAS v4) | HTTP 200, 14-day discharge series | **Usable** — keyless; largest river within ~5 km |
| OpenSky Network `/states/all` (anonymous) | HTTP 200, 2 real aircraft over Odisha | **Usable** — 400 credits/day per IP, 10 s resolution |
| Google News RSS | `ECONNRESET` from this network | **Unverifiable here** — classify at runtime |
| PIB RSS (`pib.gov.in/RssMain.aspx`) | One HTTP 200 (valid XML), then `ECONNRESET` on repeat | Reachable but **rate-limits bursts** — optional, long TTL |
| IMD (`mausam.imd.gov.in/api/...`) | HTTP 401 `Your IP/Domain needs to be whitelisted` | **Unavailable** — requires IMD agreement |
| CPCB AQI via data.gov.in | HTTP 403 to automated fetch; needs registered key | **Unavailable** — needs `DATA_GOV_IN_API_KEY` + contract |
| CWC flood forecast (`ffs.india-water.gov.in`) | HTML SPA, no documented API | **Unavailable** |
| OSDMA (`osdma.odisha.gov.in`) | DNS `ENOTFOUND` from this network | **Unverifiable** |
| TomTom Traffic Flow | Docs unreachable (`ECONNRESET`); needs key | **Unavailable** — cannot verify contract |

No public API was found or verified for: city traffic speeds/counts, CCTV streams, ANPR,
utility SCADA, police/fire/ambulance dispatch, hospital bed availability, drone telemetry,
or incident records.

---

## 1. Weather, air quality, hydrology

| UI area | Current field/data | Current source | Class | Live source available? | Proposed action |
|---|---|---|---|---|---|
| Top status bar | `temperature`, `humidity` | `/api/weather/live` → Open-Meteo | `LIVE` | Yes | Keep; add state badge + timestamp |
| Top status bar → provenance popover | `provider: 'IMD Bhubaneswar'`, `confidence: 98%`, `latency: 18 ms`, tag "Live source" | `TopStatusBar.tsx:237-241` hardcoded defaults | `SEED` | Partly | Show real provider (Open-Meteo/CAMS/GloFAS); delete invented confidence; latency measured server-side |
| `/api/weather/live` | `visibility: 8.5`, `windDirection: 'SW'`, `forecast: '...satellite radar monitoring active'` | `server.ts:272-277` hardcoded | `SEED` | Yes (`visibility`, `wind_direction_10m`) | Use real fields; delete the invented `forecast` prose |
| `/api/weather/live` | `provenance.provider: 'IMD & Open-Meteo Radar Mesh'`, `confidence: 98` | `server.ts:278-285` | `SEED` | No (IMD needs whitelisting) | Attribute Open-Meteo only; drop confidence |
| `/api/weather/live` failure path | Full weather object attributed to `'IMD Bhubaneswar Radar Station'` with `connectionStatus: 'CONNECTED'` | `server.ts:289-314` | `FALLBACK` mislabelled `LIVE` | No | Serve `CACHED` if cache exists, else `UNAVAILABLE`; never claim CONNECTED |
| `floodRiskLevel` | `precipitation > 10 ? 'HIGH' : 'MODERATE'` | `server.ts:276` | calculated placeholder | No official warning feed | Remove the authoritative badge; show rainfall + GloFAS discharge, state that no official warning feed is connected |
| Weather & Disaster → AQI card | `58 AQI`, "Good Air Quality" | `WeatherDisasterView.tsx:139-140` hardcoded | `SEED` | Yes (CAMS model) | Real `us_aqi`/PM values, labelled as modelled, not CPCB |
| Weather & Disaster → heat index | `weather.temperature + 3` | `WeatherDisasterView.tsx:95` | calculated placeholder | Yes | Use real `apparent_temperature` |
| Weather & Disaster → visibility caption | "Radar Clear" | hardcoded | `SEED` | n/a | Remove unfounded claim |
| Weather & Disaster → flood chart | `floodForecastData` — 6-point "ConvLSTM" Daya water level / rain gauge / inundation risk | `WeatherDisasterView.tsx:31-38` | `SEED` | Partly (GloFAS discharge) | Replace with real GloFAS discharge series; label model + resolution |
| Weather & Disaster → shelters | 4 shelters with capacity/occupancy/READY | `WeatherDisasterView.tsx:40-45` | `SEED` | No | `UNAVAILABLE` — needs OSDMA/BMC shelter register |
| Weather & Disaster → header | "IMD Radar Ingestion, Daya River Basin Flood Inundation Model" | hardcoded copy | `SEED` | No | Correct to actual providers |
| Map weather layer | 3500 m "IMD Doppler Radar" circle at fixed point + 4-point inundation polygon | `DigitalTwinMap.tsx:446-483` | `SEED` geometry | No | Remove fabricated radar/inundation geometry; keep layer with honest empty state |
| Map HUD | `ALT: 45m AMSL`, `DRAINAGE: STABLE (62%)` | `DigitalTwinMap.tsx:1182-1195` | `SEED` | Elevation yes (44 m) | Live viewport readout; drainage `UNAVAILABLE` |

## 2. Traffic

| UI area | Current field/data | Current source | Class | Live source available? | Proposed action |
|---|---|---|---|---|---|
| `/api/traffic/live` | 6 corridors: `avgSpeedKmh`, `congestionLevel`, `congestionScore`, `vehicleCount`, `trend` | `server.ts:643-759` hardcoded + `Math.random()` jitter | `SIMULATED` | No verified source | Operational fields → `UNAVAILABLE`; keep corridor geometry as static registry |
| `/api/traffic/live` | 8 named speed radars `TS-101…108` with `speed`, `vehicleRatePerMin` | `server.ts:761-770` hardcoded + jitter | `SIMULATED` | No | Remove; sensor layer `UNAVAILABLE` (no BSCL feed) |
| `/api/traffic/live` | `summary.cityAvgSpeedKmh`, `activeBottlenecks`, `totalVehiclesPerMin` | derived from the simulated corridors | `SIMULATED` | No | `UNAVAILABLE` |
| Client seed | `INITIAL_TRAFFIC_CORRIDORS/SENSORS/SUMMARY` | `bhubaneswarData.ts:253-389` | `SEED` | No | Geometry → static registry; metrics → null; whole fixture behind demo flag |
| Traffic Management view | corridor table, speeds, bottleneck counts | props from above | `SIMULATED` | No | Empty state + required-integration note; keep filters/controls |
| Map traffic layer | corridor colouring by congestion, sensor speed badges | `DigitalTwinMap.tsx:265-348` | `SIMULATED` | No | Draw geometry only; no congestion colour without data |
| Bottom analytics | corridor speed bar chart | `BottomAnalytics.tsx:62-67` | `SIMULATED` | No | No-data state |
| Dashboard 5 s poll | `setInterval(fetchTraffic, 5000)` | `App.tsx:177` | — | — | Slow to provider-appropriate cadence; no polling of an `UNAVAILABLE` feed |

## 3. Utilities and infrastructure

| UI area | Current field/data | Current source | Class | Live source available? | Proposed action |
|---|---|---|---|---|---|
| `/api/utilities/live` | 4 nodes with `currentLoadPct`, `outageRiskScore`, `aiAnomalyScore`, `status` | `server.ts:427-518` hardcoded + `Math.random()` | `SIMULATED` | No | `UNAVAILABLE` |
| `/api/utilities/live` | `provenance.source: 'TPCODL SCADA Modbus Telemetry Gateway'`, `confidence: 99`, `latencyMs` | same | fabricated provenance | No | Delete — asserts a government SCADA link that does not exist |
| Utilities view | 5 KPI cards (`420 MW`, `340 MLD`, `6.2 Bar`, `12 ms`, `98.4%`) | `UtilitiesView.tsx:224-281` | `SEED` | No | `UNAVAILABLE` |
| Utilities view | 5 × 7-point charts labelled "ARIMA Time-Series Predictive", badge "ACTIVE SCADA" | `UtilitiesView.tsx:25-166` | `SEED` | No | No-data state; remove model claims |
| Utilities view | 15 sub-nodes under "Live Telemetry" | same | `SEED` | No | `UNAVAILABLE` |
| Utilities view | 5 outages with `affected` population and ETA | `UtilitiesView.tsx:170-176` | `SEED` | No | `UNAVAILABLE` — needs TPCODL/WATCO/GAIL/BSNL feeds |
| Utilities view | "Enable Smart Load Shedding" toggle | `UtilitiesView.tsx:198-208` | dead control implying grid command | No | Disable with explanation; never imply grid actuation |
| Map utilities layer | `MOCK_UTILITIES` markers + hardcoded power line | `DigitalTwinMap.tsx:489-546`, `layerData.ts:552` | `SEED` | No | Layer `UNAVAILABLE` in production |
| Infrastructure view | `LANDMARKS[].status` (`OPERATIONAL`/`ALERT`) and `details` ("Grid load 420 MW", "Pump #2 under maintenance", "65,000 daily") | `bhubaneswarData.ts:139-152` | `SEED` | No | Keep coordinates/names as static geography; status → `UNKNOWN`; strip operational claims from `details` |
| Layer detail dialog | `entityCount`, `dataSizeKb`, `backendEndpoint: '/api/v1/gis/...'`, `wsChannel: 'ws://arka.telemetry/...'` | `layerData.ts:10-155` | fabricated infrastructure metadata | No | Remove non-existent endpoints/channels; show real endpoint + state |

## 4. Emergency services, resources, incidents

| UI area | Current field/data | Current source | Class | Live source available? | Proposed action |
|---|---|---|---|---|---|
| Incidents (all views + map) | 5 incidents with `aiConfidence` 87-96%, `unitsDispatched`, `recommendedAction` | `bhubaneswarData.ts:31-137` | `SEED` | No CAD/ICS source | Empty in production; operator-created only; demo fixtures behind flag |
| `/api/workflow/incident/:id` | Identical seeded workflow for **any** incident id — fixed GPS, 2 cameras, hospitals, 5-event timeline with `12:31 PM` timestamps, `analytics.slaCompliant` | `server.ts:53-119` | `SEED` | No | `UNAVAILABLE`; keep operator-recorded transitions only |
| `/api/workflow/analytics` | `totalIncidentsProcessed: 142`, `slaCompliancePct: 94.8`, 5 agency scores | `server.ts:161-179` | `SEED` | No | Compute from real recorded transitions; empty ⇒ no-data |
| Hospitals layer | `MOCK_HOSPITALS` `availableBeds`, `availableICU`, `traumaLevel` + 4 s random walk | `layerData.ts:295`, `LayerManager.ts:294-298` | `SEED`+`SIMULATED` | No | Locations = geography; bed counts `UNAVAILABLE`; stop the random walk |
| Police layer | `MOCK_POLICE` `personnelCount`, `status`, patrol positions | `layerData.ts:382` | `SEED` | No | Stations = geography; unit status/positions `UNAVAILABLE` |
| Fire layer | `MOCK_FIRE` `tendersAvailable`, `foamCapacityLiters`, coverage radius | `layerData.ts:479` | `SEED` | No | Stations = geography; readiness `UNAVAILABLE` |
| Nearest-unit routing | `findNearestHospital` / `findNearestPolicePatrol` + straight-line "routes" drawn on map | `LayerManager.ts:321-351`, `DigitalTwinMap.tsx:666-735` | derived from seed | No | Remove implied dispatch routes; if kept, label "straight-line distance, not a road route" |
| Resource Tracker | `fleetUnits` — 8 units with `battery`, `fuel`, live coordinates, assigned incident | `ResourceTrackerView.tsx:35-44` | `SEED` | No | `UNAVAILABLE` — needs AVL/GPS feed |
| Resource Tracker | `RESOURCE_UNITS` totals/available/dispatched | `bhubaneswarData.ts:154-160` | `SEED` | No | `UNAVAILABLE` |
| Resource Tracker | "Dispatch" action → log line only | `App.tsx:477` | false success | No | Disable or mark clearly as local-only annotation |
| Agencies (sidebar) | `personnel`, `activeUnits`, `status: 'ONLINE'` for 7 agencies | `bhubaneswarData.ts:9-17` | `SEED` | No | Names/contacts = static directory; personnel/units/status `UNAVAILABLE` |

## 5. Cameras, drones, AI detections

| UI area | Current field/data | Current source | Class | Live source available? | Proposed action |
|---|---|---|---|---|---|
| `/api/cctv/streams` | 4 cameras, `detectedVehicles` with `Math.random()` jitter | `server.ts:522-632` | `SIMULATED` | No | `UNAVAILABLE` |
| `/api/cctv/streams` | `streamUrl` → Google sample MP4s; `thumbnailUrl` → Unsplash stock photos | same | fabricated media | No | Remove; no stand-in video for a CCTV feed |
| `/api/cctv/streams` | `provenance.source: 'Bhubaneswar BSCL Smart City Camera Network'`, `confidence: 96` | same | fabricated provenance | No | Delete |
| Map camera popover | "VEHICLE #104" / "ANPR READ" bounding boxes, "RTSP LIVE" pill | `DigitalTwinMap.tsx:1006-1019` | fabricated AI output | No | Remove entirely |
| Traffic Cameras view | 16 `INITIAL_TRAFFIC_CAMERAS` with `aiAnalytics.confidencePct`, queue lengths, sample MP4 streams | `bhubaneswarData.ts:391-904` | `SEED` | No | `UNAVAILABLE`; keep camera-site geography only if labelled |
| `/api/camera-ai/cameras/:id/latest` | 4 tracked objects with bboxes/trajectories, `fps: 60`, `latency_ms: 4` | `server.ts:1180-1198` | `SEED` | Local service only | Proxy the real Sadaksh service; `UNAVAILABLE` when offline |
| `/api/camera-ai/metrics`, `/events`, `/analyze` | queue length, health score, 3 canned events, `ANALYSIS_COMPLETED` | `server.ts:1200-1236` | `SEED` | Local service only | Proxy or `UNAVAILABLE` |
| `/api/camera-ai/health`, `/status`, `/analyze-frame` | genuine proxy to `127.0.0.1:8008`, honest offline error | `server.ts:1126-1178` | `LIVE`/`UNAVAILABLE` | Yes (local) | Keep — already honest |
| `/api/traffic-cameras/snapshot` | returns an Unsplash photo as a camera snapshot | `server.ts:1114-1123` | fabricated media | No | `UNAVAILABLE` |
| Drones | 4 GARUDA units with battery/alt/speed | `bhubaneswarData.ts:162-167` | `SEED` | No | `UNAVAILABLE` |
| Drone telemetry ticker | battery −1 every 15 s, `speedKmh = 20 + random*30` | `App.tsx:180-188` | `SIMULATED` | No | Remove the generator |
| Drone feed modal | video element for a "drone feed" | `DroneFeedModal.tsx` | fabricated media | No | `UNAVAILABLE` state |

## 6. Intelligence and AI

| UI area | Current field/data | Current source | Class | Live source available? | Proposed action |
|---|---|---|---|---|---|
| `/api/news/bhubaneswar` | Google News RSS items | live RSS fetch | `LIVE` (when reachable) | Yes | Keep; classify at runtime; attribute as media aggregator, not official advisory |
| `/api/news/bhubaneswar` | `highlights[]` synthesised per item ("under real-time Bhubaneswar surveillance monitoring") | `server.ts:210-215` | fabricated summary | No | Remove synthesised highlights |
| `/api/news/bhubaneswar` failure path | 2 hardcoded articles attributed to OSDMA and OTV | `server.ts:223-250` | `FALLBACK` | No | `CACHED` or `UNAVAILABLE`; never invent advisories |
| Client seed | `INITIAL_INTELLIGENCE` — 4 articles incl. named Mayor quote, Unsplash publisher logos | `bhubaneswarData.ts:169-242` | `SEED` | No | Behind demo flag; empty otherwise |
| Intelligence Feed view | `14 Sources`, `28 Locations`, `BERT + Gemini 3.6` | `IntelligenceFeedView.tsx:109-130` | `SEED` | No | Real feed count; remove model claims |
| Intelligence Feed view | `intelligenceItems.length * 8 + 42` as a metric | `IntelligenceFeedView.tsx:118` | fabricated arithmetic | No | Remove |
| AI fusion | `fusedIncident` initialised to `INITIAL_INCIDENTS[0]` — a seed shown as AI output | `App.tsx:117` | `SEED` | — | Initialise to `null` |
| AI fusion (no key) | HTTP 503 + `fallbackIncident` with `aiConfidence: 94` | `server.ts:797-819` | fabricated AI output | No | Return honest `UNAVAILABLE`; client must surface it |
| AI fusion (client) | reads `json.fusedIncident`; the 503 body key is `fallbackIncident`, and `res.ok` is never checked | `App.tsx:212-221` | silent no-op | — | Handle non-OK responses and show the error |
| AI fusion model id | `'gemini-3.6-flash'` | `server.ts:852` | likely invalid model id | — | Verify against the API; surface real errors |
| Analytics view | `agencyData` response times/dispatches, `aiTrendData` confidence/risk series | `AnalyticsView.tsx:52-67` | `SEED` | No | No-data states |
| Bottom analytics | `donutData` falls back to `1/2/3/1/4` when counts are 0 | `BottomAnalytics.tsx:53-60` | fabricated distribution | — | Show true zeros / empty state |
| Bottom analytics | `timelineData` hourly incident counts | `BottomAnalytics.tsx:69-76` | `SEED` | No history store | No-data state |

## 7. System health, audit, connectivity, security

| UI area | Current field/data | Current source | Class | Live source available? | Proposed action |
|---|---|---|---|---|---|
| Status bar "Systems normal 7/7" | 7 streams hardcoded `CONNECTED` with latencies 12-45 ms | `LiveDataManager.ts:19-69` | `SEED` | Yes (measure it) | Derive from real fetch outcomes; `updateHealth` is currently never called |
| Health modal providers | "TPCODL & WATCO SCADA Modbus Gateway", "389 CCTV Feeds with YOLOv9", "BPIA Airport Radar" | same | fabricated providers | No | Replace with the real provider list |
| Live log bar | 6 seeded log lines incl. "synchronized with 142 IoT sensors & 389 CCTV feeds" | `bhubaneswarData.ts:244-251` | `SEED` | — | Start empty; record only real events, distinguishing provider vs operator |
| Offline banner | "running on cached data with a local draft queue" | `App.tsx:269` | unsupported claim | — | `queueDraft` is never called anywhere; state the real behaviour |
| Offline sync | `syncPendingDrafts()` waits 1 s, deletes the queue, logs "sync completed successfully" | `OfflineManager.ts:69-78` | false success + data loss | No endpoint | Do not discard; keep queued and marked unsent |
| `/api/adsb/live` fallback | 3 aircraft attributed to "BPIA ADS-B Ground Sensor #04" / AAI, `confidence: 99`, with no fallback marker | `server.ts:356-423` | fabricated provenance | OpenSky verified | Real OpenSky only; `UNAVAILABLE` on failure |
| `/api/telegram/verify-code` | any 6-character code returns "successfully linked" | `server.ts:944-960` | fake auth success | — | Verify against codes actually issued by the bot |
| `/api/telegram/send-test` | returns success without sending anything | `server.ts:962-968` | false success | — | Send for real or fail honestly |
| `/api/telegram/set-token` | unauthenticated POST writes the token to `.env`, clobbering other keys; spawns a new unbounded poll loop per call | `server.ts:972-1009` | security defect | — | No `.env` write; in-memory only; single loop |
| `startTelegramPolling` | `while(true)` with no delay when Telegram returns `ok:false` | `server.ts:1254-1292` | hot loop | — | Backoff on all failure paths |
| `/api/telegram/test-chat` | canned "ARKA Active Emergencies Report" listing 3 incidents | `server.ts:1049-1078` | fabricated ops data | — | Remove fabricated incident text |
| `/api/telegram/status` | `status: 'ONLINE'`, `linkedUsersCount: 1` | `server.ts:930-942` | `SEED` | — | Derive from real bot state |
| `/api/health` | `workflowEngine: 'ONLINE_ACTIVE'` | `server.ts:46` | unverified claim | — | Report measurable facts only |
| `/api/openclaw/status`, `/tools` | agent roster, `totalTools: 20` (10 listed) | `server.ts:892-927` | static capability descriptor | n/a | Keep as static config; correct the count |
| Operator identity | "Duty Officer" | `TopStatusBar.tsx:363` | already labelled "Demo session" | `SEED` | Keep — honest; note no auth exists |
| `/api/workflow/incident/:id` store | `inMemoryWorkflows` keyed by arbitrary URL id, unbounded | `server.ts:51` | memory growth | — | Bound the store |

## 8. Not operational data — left as-is

Static UI copy, icon choices, design tokens, nav labels, category/priority/status enum lists,
filter option arrays, chart colour palettes, the Bhubaneswar map centre and zoom, basemap and
tile-source URLs, corridor and facility **coordinates**, and the OpenClaw tool catalogue
(a capability descriptor, not a reading).

---

## Verification gap found during the audit

`npm run lint` (`tsc --noEmit`) reports zero errors but type-checks **no React component**:
`@types/react` is not installed and React 19 ships no types, so `react` resolves to JavaScript
via `allowJs` and every component's props are inferred as `any`. Evidence: `App.tsx` omits three
props that `RightIntelligenceCenterProps` declares as required and the check still passes.
Component-level regressions therefore cannot be caught by the existing check.
