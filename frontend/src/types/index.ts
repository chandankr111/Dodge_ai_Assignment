export interface GraphNode {
  id: string;
  label: string;
  group: string;
  data: Record<string, any>;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  data?: any;
  sql?: string;
  queryType?: string;
}

export interface FlowStep {
  step: number;
  entity: string;
  status?: string;
  count?: number;
  data: any;
}
