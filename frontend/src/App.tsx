import { useCallback, useState } from "react";
import ChatPanel from "./components/ChatPanel";
import GraphView from "./components/GraphView";
import NodeInspector from "./components/NodeInspector";
import { ChatMessage, GraphNode } from "./types";
import "./index.css";

export default function App() {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I can help you analyze the Order to Cash process. Ask me anything about sales orders, deliveries, billing, or payments.",
    },
  ]);
  const [showInspector, setShowInspector] = useState(false);

  const handleNodeSelect = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setShowInspector(true);
  }, []);

  const handleChatResponse = useCallback((data: any) => {
    if (!data?.flow) return;
    const ids = data.flow
      .map((f: any) => {
        if (f.data?.salesOrder) return `so-${f.data.salesOrder}`;
        if (f.data?.billingDocument) return `bd-${f.data.billingDocument}`;
        if (f.data?.deliveryDocument) return `del-${f.data.deliveryDocument}`;
        return null;
      })
      .filter(Boolean);
    setHighlightedNodes(ids as string[]);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="header-icon">⬡</span>
          <span className="header-path">
            Mapping / <strong>Order to Cash</strong>
          </span>
        </div>
        <div className="header-right">
          <button className="btn-outline" onClick={() => setShowInspector(!showInspector)}>
            ⊞ {showInspector ? "Hide" : "Show"} Overlay
          </button>
        </div>
      </header>

      <div className="main-layout">
        <div className="graph-area">
          <GraphView onNodeSelect={handleNodeSelect} highlightedNodes={highlightedNodes} />

          {showInspector && selectedNode && (
            <div className="inspector-overlay">
              <NodeInspector node={selectedNode} onClose={() => setShowInspector(false)} />
            </div>
          )}
        </div>
        <div className="chat-area">
          <ChatPanel messages={messages} setMessages={setMessages} onChatResponse={handleChatResponse} />
        </div>
      </div>
    </div>
  );
}
