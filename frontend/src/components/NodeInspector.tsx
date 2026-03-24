import { GraphNode } from "../types";

interface Props {
  node: GraphNode;
  onClose: () => void;
}

const HIDDEN_FIELDS = ["raw", "id"];
const MAX_FIELDS = 12;

export default function NodeInspector({ node, onClose }: Props) {
  const entries = Object.entries(node.data || {}).filter(
    ([k, v]) => !HIDDEN_FIELDS.includes(k) && v !== null && v !== ""
  );

  const visible = entries.slice(0, MAX_FIELDS);
  const hidden = entries.length - MAX_FIELDS;

  return (
    <div className="inspector-card">
      <div className="inspector-header" style={{ borderLeft: `4px solid ${getGroupColor(node.group)}` }}>
        <div>
          <div className="inspector-entity">{formatLabel(node.group)}</div>
          <div className="inspector-title">{node.label}</div>
        </div>
        <button className="inspector-close" onClick={onClose}>
          x
        </button>
      </div>

      <div className="inspector-body">
        {visible.map(([key, value]) => (
          <div key={key} className="inspector-row">
            <span className="inspector-key">{formatKey(key)}:</span>
            <span className="inspector-value">{formatValue(value)}</span>
          </div>
        ))}
        {hidden > 0 && <div className="inspector-hidden">{hidden} additional fields hidden for readability</div>}
      </div>

      <div className="inspector-footer">
        <span className="inspector-connections">Entity: {formatLabel(node.group)}</span>
      </div>
    </div>
  );
}

function getGroupColor(group: string) {
  const map: Record<string, string> = {
    customer: "#3b82f6",
    salesOrder: "#22c55e",
    delivery: "#eab308",
    billing: "#ec4899",
    payment: "#8b5cf6",
    product: "#f97316",
    journal: "#16a34a",
  };
  return map[group] || "#64748b";
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && value.includes("T00:00:00")) return value.split("T")[0];
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatLabel(group: string): string {
  const map: Record<string, string> = {
    customer: "Customer",
    salesOrder: "Sales Order",
    delivery: "Delivery",
    billing: "Billing Document",
    payment: "Payment",
    product: "Product",
    journal: "Journal Entry",
  };
  return map[group] || group;
}
