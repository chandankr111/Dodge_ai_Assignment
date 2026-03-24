import { useEffect, useRef, useState } from "react";
import { DataSet, Edge, Network, Node } from "vis-network/standalone";
import { api } from "../api/client";
import { GraphData, GraphNode } from "../types";

interface Props {
  onNodeSelect: (node: GraphNode) => void;
  highlightedNodes: string[];
}

const GROUP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  customer: { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  salesOrder: { bg: "#dcfce7", border: "#22c55e", text: "#15803d" },
  delivery: { bg: "#fef9c3", border: "#eab308", text: "#854d0e" },
  billing: { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" },
  payment: { bg: "#ede9fe", border: "#8b5cf6", text: "#5b21b6" },
  product: { bg: "#ffedd5", border: "#f97316", text: "#9a3412" },
  journal: { bg: "#f0fdf4", border: "#16a34a", text: "#14532d" },
};

export default function GraphView({ onNodeSelect, highlightedNodes }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesRef = useRef<DataSet<Node> | null>(null);
  const rawNodesRef = useRef<GraphNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const initGraph = async () => {
      try {
        const data: GraphData = await api.getGraph();
        rawNodesRef.current = data.nodes;
        setStats({ nodes: data.nodes.length, edges: data.edges.length });

        const visNodes = new DataSet<Node>(
          data.nodes.map((n) => {
            const colors = GROUP_COLORS[n.group] || GROUP_COLORS.product;
            return {
              id: n.id,
              label: n.label.length > 20 ? `${n.label.slice(0, 18)}...` : n.label,
              title: n.label,
              color: {
                background: colors.bg,
                border: colors.border,
                highlight: { background: "#fbbf24", border: "#d97706" },
                hover: { background: "#fde68a", border: "#f59e0b" },
              },
              font: { color: colors.text, size: 11 },
              shape: getShape(n.group),
              size: getSize(n.group),
              group: n.group,
            };
          })
        );

        const visEdges = new DataSet<Edge>(
          data.edges.map((e, i) => ({
            id: i + 1,
            from: e.from,
            to: e.to,
            label: e.label,
            font: { size: 9, color: "#94a3b8", align: "middle" },
            color: { color: "#cbd5e1", highlight: "#3b82f6", hover: "#64748b" },
            arrows: { to: { enabled: true, scaleFactor: 0.6 } },
            smooth: { enabled: true, type: "curvedCW", roundness: 0.2 },
          }))
        );

        nodesRef.current = visNodes;

        const network = new Network(
          containerRef.current!,
          { nodes: visNodes, edges: visEdges },
          {
            physics: {
              enabled: true,
              stabilization: { iterations: 100 },
              barnesHut: {
                gravitationalConstant: -3000,
                centralGravity: 0.3,
                springLength: 120,
                springConstant: 0.04,
                damping: 0.09,
              },
            },
            interaction: {
              hover: true,
              tooltipDelay: 200,
              zoomView: true,
              dragView: true,
            },
            layout: { improvedLayout: false },
          }
        );

        networkRef.current = network;

        network.on("click", (params) => {
          if (params.nodes.length > 0) {
            const nodeId = String(params.nodes[0]);
            const raw = rawNodesRef.current.find((n) => n.id === nodeId);
            if (raw) onNodeSelect(raw);
          }
        });

        network.on("stabilizationIterationsDone", () => {
          setLoading(false);
          network.setOptions({ physics: { enabled: false } });
        });
      } catch (err) {
        console.error("Failed to load graph:", err);
        setLoading(false);
      }
    };

    initGraph();

    return () => {
      networkRef.current?.destroy();
    };
  }, [onNodeSelect]);

  useEffect(() => {
    if (!nodesRef.current || highlightedNodes.length === 0) return;
    const updates: Node[] = highlightedNodes.map((id) => ({
      id,
      color: {
        background: "#fbbf24",
        border: "#d97706",
        highlight: { background: "#fbbf24", border: "#d97706" },
      },
      size: 24,
    }));
    nodesRef.current.update(updates);
    networkRef.current?.focus(highlightedNodes[0], {
      scale: 1.2,
      animation: { duration: 800, easingFunction: "easeInOutQuad" },
    });
  }, [highlightedNodes]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {loading && (
        <div className="graph-loading">
          <div className="spinner" />
          <p>Loading graph...</p>
        </div>
      )}

      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      <div className="graph-stats">
        <span>{stats.nodes} nodes</span>
        <span>.</span>
        <span>{stats.edges} edges</span>
      </div>

      <div className="graph-legend">
        {Object.entries(GROUP_COLORS).map(([group, colors]) => (
          <div key={group} className="legend-item">
            <span className="legend-dot" style={{ background: colors.bg, border: `2px solid ${colors.border}` }} />
            <span className="legend-label">{group}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getShape(group: string): string {
  const shapes: Record<string, string> = {
    customer: "ellipse",
    salesOrder: "box",
    delivery: "diamond",
    billing: "triangle",
    payment: "star",
    product: "dot",
    journal: "square",
  };
  return shapes[group] || "dot";
}

function getSize(group: string): number {
  const sizes: Record<string, number> = {
    customer: 20,
    salesOrder: 16,
    delivery: 14,
    billing: 14,
    payment: 16,
    product: 10,
    journal: 12,
  };
  return sizes[group] || 12;
}
