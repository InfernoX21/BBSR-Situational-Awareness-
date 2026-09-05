import React, { useState, useEffect } from 'react';
import { Network, Share2, Layers, MapPin, Eye, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import type { CityEntity, EntityRelationship } from '../../types';
import { operationalStore, useOperationalStore } from '../../store/useOperationalStore';

export const KnowledgeGraphView: React.FC = () => {
  const { selectedEntity } = useOperationalStore();
  const [nodes, setNodes] = useState<CityEntity[]>([]);
  const [edges, setEdges] = useState<EntityRelationship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/knowledge-graph')
      .then((res) => res.json())
      .then((data) => {
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const activeNode = selectedEntity || nodes[0];

  const connectedEdges = edges.filter(
    (e) => e.sourceId === activeNode?.id || e.targetId === activeNode?.id
  );

  return (
    <div className="h-full bg-zinc-950 text-zinc-100 flex flex-col p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-orange-400" />
          <div>
            <h2 className="text-sm font-bold font-mono text-zinc-100 tracking-wider">
              CITY KNOWLEDGE GRAPH EXPLORER
            </h2>
            <p className="text-xs text-zinc-400">
              Interconnected city entity & relationship intelligence layer for Bhubaneswar
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setLoading(true);
            fetch('/api/knowledge-graph')
              .then((res) => res.json())
              .then((data) => {
                setNodes(data.nodes || []);
                setEdges(data.edges || []);
                setLoading(false);
              });
          }}
          className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-300 rounded flex items-center gap-1.5 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Graph
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Left: Entity List */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 space-y-3 flex flex-col">
          <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-orange-400" />
            Registered Entities ({nodes.length})
          </h3>
          <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
            {nodes.map((node) => {
              const isSelected = activeNode?.id === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => operationalStore.setSelectedEntity(node)}
                  className={`p-3 rounded border text-xs cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-orange-500/10 border-orange-500/50 text-zinc-100'
                      : 'bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-zinc-200">{node.name}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono mt-0.5">{node.id} • {node.address || 'Bhubaneswar'}</p>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-900 border border-zinc-800 text-orange-400">
                    {node.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center: Graph Relationship Network Diagram */}
        <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-orange-400" />
              Relationship Connections for: <span className="text-orange-400 font-bold">{activeNode?.name}</span>
            </h3>
            <span className="text-xs font-mono text-zinc-500">
              {connectedEdges.length} Active Edges
            </span>
          </div>

          {/* Active Node Detail Highlight */}
          {activeNode && (
            <div className="bg-zinc-950/90 border border-zinc-800 rounded p-3 text-xs space-y-2 font-mono">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <span className="text-orange-400 font-bold">{activeNode.name}</span>
                <span className="text-emerald-400">STATUS: {activeNode.status}</span>
              </div>
              <p className="text-zinc-300">Entity Type: {activeNode.type} | ID: {activeNode.id}</p>
              {activeNode.lat && activeNode.lng && (
                <p className="text-zinc-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                  {activeNode.lat.toFixed(4)}° N, {activeNode.lng.toFixed(4)}° E
                </p>
              )}
            </div>
          )}

          {/* Graph Edges List */}
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {connectedEdges.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-zinc-500">
                No active graph edges for selected entity.
              </div>
            ) : (
              connectedEdges.map((edge) => {
                const sourceNode = nodes.find((n) => n.id === edge.sourceId);
                const targetNode = nodes.find((n) => n.id === edge.targetId);
                return (
                  <div
                    key={edge.id}
                    className="p-3 bg-zinc-950/80 border border-zinc-800 rounded text-xs font-mono flex items-center justify-between hover:border-orange-500/40 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded bg-zinc-900 text-orange-400 text-[10px] border border-zinc-800">
                        {sourceNode?.name || edge.sourceId}
                      </span>
                      <ArrowRight className="w-4 h-4 text-zinc-500" />
                      <span className="px-2 py-0.5 rounded bg-zinc-900 text-orange-400 text-[10px] border border-zinc-800">
                        {targetNode?.name || edge.targetId}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30 text-[10px]">
                        {edge.relationType} ({edge.label})
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
