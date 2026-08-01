import React from "react";
import { X } from "lucide-react";
import { C } from "../../styles/theme";

// These mirror the primitives already defined inline in App.jsx (Panel,
// Badge, Button, Modal, Field, SectionTitle, PillGroup, inputStyle) so the
// five new Phase 1 pages look identical without touching App.jsx itself.

export function Panel({ children, style, className = "" }) {
  return <div className={`rounded-2xl ${className}`} style={{ background: C.panel, border: `1px solid ${C.border}`, ...style }}>{children}</div>;
}

export function Badge({ children, color = C.aqua, bg = C.aquaSoft, border = C.aquaBorder }) {
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ color, background: bg, border: `1px solid ${border}` }}>{children}</span>;
}

export function Button({ children, onClick, variant = "primary", className = "", icon: Icon, disabled, type = "button" }) {
  const styles = {
    primary: { background: C.aqua, color: "#04211D", border: `1px solid ${C.aqua}` },
    ghost: { background: "transparent", color: C.text, border: `1px solid ${C.border}` },
    danger: { background: "transparent", color: C.red, border: `1px solid rgba(241,106,106,0.4)` },
    subtle: { background: C.panel2, color: C.text, border: `1px solid ${C.border}` },
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100 ${className}`}
      style={styles[variant]}>
      {Icon && <Icon size={16} />}{children}
    </button>
  );
}

export function StatCard({ label, value, sub, icon: Icon, accent = C.aqua }) {
  return (
    <Panel style={{ padding: "18px" }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs" style={{ color: C.textMuted }}>{label}</div>
          <div className="text-2xl font-bold mt-1.5" style={{ color: C.text }}>{value}</div>
          {sub && <div className="text-xs mt-1" style={{ color: C.textFaint }}>{sub}</div>}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}1F`, color: accent }}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </Panel>
  );
}

export function SectionTitle({ children, sub }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold" style={{ color: C.text }}>{children}</h2>
      {sub && <p className="text-sm mt-0.5" style={{ color: C.textMuted }}>{sub}</p>}
    </div>
  );
}

export function Modal({ open, onClose, children, title, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(4,6,8,0.72)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl`}
        style={{ background: C.panel, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between px-5 py-4 sticky top-0" style={{ background: C.panel, borderBottom: `1px solid ${C.borderSoft}` }}>
          <h3 className="font-bold text-base" style={{ color: C.text }}>{title}</h3>
          <button onClick={onClose} style={{ color: C.textMuted }}><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold mb-1.5" style={{ color: C.textMuted }}>{label}</label>
      {children}
    </div>
  );
}

export const inputStyle = { width: "100%", background: C.panel2, border: `1px solid ${C.border}`, color: C.text, borderRadius: "12px", padding: "10px 12px", fontSize: "14px", outline: "none" };

export function PillGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button key={opt.value ?? opt} type="button" onClick={() => onChange(opt.value ?? opt)}
          className="px-3.5 py-2 rounded-xl text-sm font-medium transition-all"
          style={value === (opt.value ?? opt) ? { background: C.aquaSoft, color: C.aqua, border: `1px solid ${C.aquaBorder}` } : { background: C.panel2, color: C.textMuted, border: `1px solid ${C.border}` }}>
          {opt.label ?? opt}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ children }) {
  return <div className="text-sm py-10 text-center rounded-xl" style={{ color: C.textFaint, background: C.panel2, border: `1px dashed ${C.border}` }}>{children}</div>;
}
