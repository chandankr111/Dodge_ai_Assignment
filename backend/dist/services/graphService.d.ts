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
export declare function buildGraph(): GraphData;
//# sourceMappingURL=graphService.d.ts.map