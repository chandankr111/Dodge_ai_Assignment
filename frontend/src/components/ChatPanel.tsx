import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../api/client";
import { ChatMessage, FlowStep } from "../types";

interface Props {
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  onChatResponse: (data: any) => void;
}

const SUGGESTIONS = [
  "Trace the full flow of billing document 90504248",
  "Which products have the most billing documents?",
  "Show sales orders delivered but not billed",
  "Who are the top 5 customers by order amount?",
  "Show billing documents not yet paid",
];

export default function ChatPanel({ messages, setMessages, onChatResponse }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const question = text.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const res = await api.chat(question);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, data: res.data, sql: res.sql, queryType: res.queryType },
      ]);
      if (res.data) onChatResponse(res.data);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-top">
          <div className="chat-avatar">D</div>
          <div>
            <div className="chat-bot-name">Graph Agent</div>
            <div className="chat-context">Order to Cash</div>
          </div>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            {msg.role === "assistant" && (
              <div className="chat-message-avatar">
                <div className="chat-avatar small">D</div>
                <span className="chat-avatar-label">Graph Agent</span>
              </div>
            )}

            <div className={`chat-bubble ${msg.role}`}>
              <ReactMarkdown>{msg.content}</ReactMarkdown>
              {msg.data?.flow && <FlowDisplay flow={msg.data.flow} />}
              {Array.isArray(msg.data) && msg.data.length > 0 && <TableDisplay data={msg.data} />}
            </div>

            {msg.role === "user" && (
              <div className="chat-message-avatar right">
                <div className="user-avatar">You</div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="chat-message assistant">
            <div className="chat-message-avatar">
              <div className="chat-avatar small">D</div>
            </div>
            <div className="chat-bubble assistant">
              <div className="typing-indicator">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="chat-suggestions">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} className="suggestion-chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="chat-input-area">
        <div className="chat-status">
          <span className="status-dot" />
          Graph Agent is awaiting instructions
        </div>
        <div className="chat-input-row">
          <textarea
            className="chat-input"
            placeholder="Analyze anything"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
          />
          <button className="chat-send-btn" onClick={() => send(input)} disabled={loading || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function FlowDisplay({ flow }: { flow: FlowStep[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <div className="flow-display">
      <div className="flow-title">Document Flow</div>
      {flow.map((step) => (
        <div key={step.step} className="flow-step">
          <div className="flow-step-header" onClick={() => setExpanded(expanded === step.step ? null : step.step)}>
            <div className="flow-step-left">
              <span className="flow-step-number">{step.step}</span>
              <span className="flow-step-entity">{step.entity}</span>
              {step.count !== undefined && <span className="flow-step-count">{step.count} items</span>}
            </div>
            <div className="flow-step-right">
              <span className={`flow-status ${getStatusClass(step.status)}`}>{step.status || "OK"}</span>
              <span className="flow-chevron">{expanded === step.step ? "▲" : "▼"}</span>
            </div>
          </div>
          {expanded === step.step && step.data && (
            <div className="flow-step-body">
              {Array.isArray(step.data) ? (
                step.data.length > 0 ? (
                  step.data.map((item: any, i: number) => (
                    <div key={i} className="flow-data-item">
                      {Object.entries(item)
                        .filter(([k, v]) => v !== null && v !== "" && !k.startsWith("_"))
                        .slice(0, 8)
                        .map(([k, v]) => (
                          <div key={k} className="flow-data-row">
                            <span className="flow-data-key">{formatKey(k)}</span>
                            <span className="flow-data-value">{formatValue(v)}</span>
                          </div>
                        ))}
                    </div>
                  ))
                ) : (
                  <div className="flow-empty">No data available</div>
                )
              ) : (
                <div className="flow-data-item">
                  {Object.entries(step.data)
                    .filter(([k, v]) => v !== null && v !== "" && !k.startsWith("_"))
                    .slice(0, 10)
                    .map(([k, v]) => (
                      <div key={k} className="flow-data-row">
                        <span className="flow-data-key">{formatKey(k)}</span>
                        <span className="flow-data-value">{formatValue(v)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TableDisplay({ data }: { data: any[] }) {
  const keys = Object.keys(data[0]).slice(0, 6);
  return (
    <div className="table-display">
      <table className="result-table">
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k}>{formatKey(k)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((row, i) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k}>{formatValue(row[k])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 10 && <div className="table-more">+{data.length - 10} more rows</div>}
    </div>
  );
}

function getStatusClass(status?: string): string {
  if (!status) return "status-default";
  const s = status.toLowerCase();
  if (s === "c" || s === "active" || s === "cleared" || s === "posted") return "status-success";
  if (s === "a" || s === "pending") return "status-warning";
  if (s.includes("not") || s.includes("cancel") || s.includes("missing")) return "status-error";
  return "status-default";
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
