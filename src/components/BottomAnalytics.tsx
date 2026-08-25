import React, { useState } from 'react';
import { Incident, ResourceUnit, WeatherData, Severity, TrafficCorridor, TrafficSummary } from '../types';
import { LiveNewsPanel } from './LiveNewsPanel';
import { LiveTrafficCameraPanel } from './LiveTrafficCameraPanel';
import {
  GripHorizontal,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
  PieChart as PieIcon,
  BarChart2,
  Radio,
  Car,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

interface BottomAnalyticsProps {
  incidents: Incident[];
  resources: ResourceUnit[];
  weather: WeatherData;
  trafficCorridors?: TrafficCorridor[];
  trafficSummary?: TrafficSummary;
}

type WidgetId = 'INCIDENTS' | 'TRAFFIC' | 'NEWS' | 'CAMERAS';

export const BottomAnalytics: React.FC<BottomAnalyticsProps> = ({
  incidents,
  resources,
  weather,
  trafficCorridors = [],
  trafficSummary,
}) => {
  // Height Resizing & Collapse States
  const [panelHeight, setPanelHeight] = useState<number>(180);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Widget Order State & Dragging States
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>([
    'INCIDENTS',
    'TRAFFIC',
    'NEWS',
    'CAMERAS',
  ]);
  const [draggedWidget, setDraggedWidget] = useState<WidgetId | null>(null);
  const [targetWidget, setTargetWidget] = useState<WidgetId | null>(null);

  const [widget2Mode, setWidget2Mode] = useState<'TRAFFIC' | 'TIMELINE'>('TRAFFIC');
  const [timelineFilter] = useState<'TODAY' | '1HR' | '24HR'>('TODAY');

  // Vertical Resizing Handler
  const startResizing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startHeight = panelHeight;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaY = startY - currentY; // Dragging up increases height
      const newHeight = Math.max(32, Math.min(480, startHeight + deltaY));
      if (newHeight <= 45) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
      setPanelHeight(newHeight);
    };

    const onEnd = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  };

  // Drag & Drop Reordering Handlers
  const handleDragStart = (e: React.DragEvent, id: WidgetId) => {
    setDraggedWidget(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: WidgetId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (targetWidget !== id) {
      setTargetWidget(id);
    }
  };

  const handleDrop = (e: React.DragEvent, dropTargetId: WidgetId) => {
    e.preventDefault();
    if (!draggedWidget || draggedWidget === dropTargetId) {
      setDraggedWidget(null);
      setTargetWidget(null);
      return;
    }

    const newOrder = [...widgetOrder];
    const draggedIdx = newOrder.indexOf(draggedWidget);
    const targetIdx = newOrder.indexOf(dropTargetId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      newOrder[draggedIdx] = dropTargetId;
      newOrder[targetIdx] = draggedWidget;
      setWidgetOrder(newOrder);
    }

    setDraggedWidget(null);
    setTargetWidget(null);
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
    setTargetWidget(null);
  };

  // Compute Incident Distribution Data
  const criticalCount = incidents.filter((i) => i.priority === 'CRITICAL').length;
  const highCount = incidents.filter((i) => i.priority === 'HIGH').length;
  const mediumCount = incidents.filter((i) => i.priority === 'MEDIUM').length;
  const lowCount = incidents.filter((i) => i.priority === 'LOW').length;
  const resolvedCount = incidents.filter((i) => i.status === 'RESOLVED').length;

  const donutData = [
    { name: 'Critical', value: criticalCount || 1, color: '#ef4444' },
    { name: 'High', value: highCount || 2, color: '#f59e0b' },
    { name: 'Medium', value: mediumCount || 3, color: '#eab308' },
    { name: 'Low', value: lowCount || 1, color: '#10b981' },
    { name: 'Resolved', value: resolvedCount || 4, color: '#06b6d4' },
  ];

  // Traffic Corridor Speeds for BarChart
  const trafficChartData = trafficCorridors.map((c) => ({
    name: c.name.replace(' Corridor', '').replace(' Express Arterial', '').replace(' Administrative Axis', ''),
    Speed: c.avgSpeedKmh,
    FreeFlow: c.freeFlowSpeedKmh,
  }));

  // Timeline Mock Hourly Data
  const timelineData = [
    { time: '06:00', Critical: 0, High: 1, Medium: 2 },
    { time: '08:00', Critical: 1, High: 2, Medium: 1 },
    { time: '10:00', Critical: 2, High: 3, Medium: 2 },
    { time: '12:00', Critical: 1, High: 2, Medium: 3 },
    { time: '14:00', Critical: 0, High: 1, Medium: 2 },
    { time: '16:00', Critical: 1, High: 2, Medium: 1 },
  ];

  // Render individual widget component by ID
  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case 'INCIDENTS':
        return (
          <div className="flex flex-col justify-between h-full min-w-0 min-h-0">
            <div className="flex items-center justify-between border-b border-white/5 pb-1 text-[8.5px] sm:text-[9px] font-bold uppercase tracking-widest gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <PieIcon className="w-3 h-3 text-[#06B6D4] shrink-0" />
                <span className="text-white/80 truncate">Incident Distribution</span>
              </div>
              <span className="text-[#06B6D4] shrink-0 font-mono">TOTAL: {incidents.length}</span>
            </div>

            <div className="flex items-center justify-between flex-1 min-w-0 min-h-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 relative flex items-center justify-center shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={18}
                      outerRadius={34}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0a0a0a',
                        borderColor: 'rgba(255,255,255,0.1)',
                        fontSize: '10px',
                        borderRadius: '4px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-white">
                  {incidents.length}
                </div>
              </div>

              <div className="space-y-1 text-[9px] font-mono">
                {donutData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between space-x-2">
                    <div className="flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-white/60">{d.name}</span>
                    </div>
                    <span className="text-white font-bold">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'TRAFFIC':
        return (
          <div className="flex flex-col justify-between h-full min-w-0 min-h-0">
            <div className="flex items-center justify-between border-b border-white/5 pb-1 text-[9px] font-bold uppercase tracking-widest gap-1">
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setWidget2Mode('TRAFFIC')}
                  className={`px-1.5 py-0.5 rounded transition-all ${
                    widget2Mode === 'TRAFFIC' ? 'bg-[#06B6D4]/20 text-[#06B6D4] font-bold' : 'text-white/40 hover:text-white'
                  }`}
                >
                  TRAFFIC FLOW
                </button>
                <button
                  type="button"
                  onClick={() => setWidget2Mode('TIMELINE')}
                  className={`px-1.5 py-0.5 rounded transition-all ${
                    widget2Mode === 'TIMELINE' ? 'bg-[#06B6D4]/20 text-[#06B6D4] font-bold' : 'text-white/40 hover:text-white'
                  }`}
                >
                  TIMELINE
                </button>
              </div>
              <span className="text-[#10B981] text-[8px] font-bold shrink-0">
                {widget2Mode === 'TRAFFIC' ? `${trafficSummary?.cityAvgSpeedKmh || 25} KM/H` : timelineFilter}
              </span>
            </div>

            <div className="flex-1 w-full pt-1 min-h-0">
              {widget2Mode === 'TRAFFIC' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trafficChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={7} tickLine={false} interval={0} />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={8} tickLine={false} unit="k" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0a0a0a',
                        borderColor: 'rgba(255,255,255,0.1)',
                        fontSize: '10px',
                        borderRadius: '4px',
                      }}
                    />
                    <Bar dataKey="Speed" fill="#06b6d4" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="FreeFlow" fill="rgba(255,255,255,0.1)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timelineData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={8} tickLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={8} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0a0a0a',
                        borderColor: 'rgba(255,255,255,0.1)',
                        fontSize: '10px',
                        borderRadius: '4px',
                      }}
                    />
                    <Bar dataKey="Critical" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="High" stackId="a" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Medium" stackId="a" fill="#eab308" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        );

      case 'NEWS':
        return <LiveNewsPanel className="border-0 bg-transparent p-0 h-full rounded-none" />;

      case 'CAMERAS':
        return <LiveTrafficCameraPanel className="border-0 bg-transparent p-0 h-full rounded-none" />;
    }
  };

  return (
    <div
      style={{ height: isCollapsed ? '28px' : `${panelHeight}px` }}
      className={`w-full bg-[#05070A] border-t border-white/15 flex flex-col shrink-0 select-none overflow-hidden font-mono min-w-0 transition-all ${
        isResizing ? 'transition-none select-none' : ''
      }`}
    >
      {/* --- Top Vertical Resizer Handle Bar --- */}
      <div
        onMouseDown={startResizing}
        onTouchStart={startResizing}
        onDoubleClick={() => {
          setIsCollapsed((prev) => !prev);
          if (isCollapsed) setPanelHeight(180);
        }}
        title="Drag up/down to resize panel. Double-click to toggle collapse."
        className="w-full h-7 bg-[#080C10] hover:bg-cyan-950/40 border-b border-white/10 cursor-ns-resize flex items-center justify-between px-3 shrink-0 group transition-colors select-none"
      >
        <div className="flex items-center gap-2 text-white/50 group-hover:text-cyan-300 transition-colors">
          <GripHorizontal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] font-mono font-bold tracking-wider uppercase">
            ANALYTICS & FEEDS COMMAND PANEL
          </span>
          <span className="text-[9px] text-white/30 hidden sm:inline">(Drag to resize / drag tabs to reorder)</span>
        </div>

        <div className="w-16 h-1 rounded-full bg-white/20 group-hover:bg-cyan-400 group-active:bg-cyan-300 transition-colors hidden sm:block" />

        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <span className="text-[9px] font-mono text-white/40">{Math.round(panelHeight)}px</span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed((prev) => !prev);
              if (isCollapsed && panelHeight < 60) setPanelHeight(180);
            }}
            className="p-0.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* --- 4 Re-orderable Widget Grid --- */}
      {!isCollapsed && (
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 xl:gap-2.5 p-2 min-w-0 min-h-0 overflow-hidden">
          {widgetOrder.map((widgetId) => (
            <div
              key={widgetId}
              draggable
              onDragStart={(e) => handleDragStart(e, widgetId)}
              onDragOver={(e) => handleDragOver(e, widgetId)}
              onDrop={(e) => handleDrop(e, widgetId)}
              onDragEnd={handleDragEnd}
              className={`gov-glass rounded-md p-2 flex flex-col justify-between min-w-0 min-h-0 relative transition-all duration-150 group ${
                draggedWidget === widgetId ? 'opacity-30 border-2 border-dashed border-cyan-400' : ''
              } ${
                targetWidget === widgetId && draggedWidget !== widgetId
                  ? 'border-2 border-cyan-400 bg-cyan-950/40 scale-[0.98]'
                  : ''
              }`}
            >
              {/* Drag Handle Icon on Card Hover */}
              <div
                title="Drag to swap widget position"
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded bg-black/60 text-white/60 hover:text-white z-20"
              >
                <GripVertical className="w-3 h-3" />
              </div>

              {renderWidget(widgetId)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
