import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Droplets, Car, Users, BarChart3, Settings as SettingsIcon, Search,
  Play, ChevronLeft, Star, AlertTriangle, CheckCircle2, Clock,
  Plus, X, Download, TrendingUp, TrendingDown, Gauge, Timer,
  Sparkles, Award, Zap, FileDown, FileJson, FileSpreadsheet,
  Loader2, Trash2, User, Phone, Camera, Image as ImageIcon,
  Wallet, Receipt, TrendingUp as ProfitIcon, Upload, ShieldCheck,
  PackageCheck, ZoomIn, DollarSign
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar
} from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Cloud, CloudOff, RefreshCw, LogOut, WifiOff, PackagePlus
} from "lucide-react";
import {
  loadInitialState, persistCore, softDeleteRecord,
  getPhotosLocal, savePhotosLocal, deletePhotosLocal,
  onConnectivityChange, isOnline, flushQueue, getPendingCount, getLastSync,
  exportFullBackup, importFullBackup
} from "./lib/dataStore";
import { isSupabaseConfigured } from "./lib/supabaseClient";
import { getSession, onAuthChange, signOut } from "./lib/auth";
import LoginScreen from "./components/LoginScreen";

// ---- Phase 1 extension: roles, partners, daily close, fixed expenses, audit log ----
// These are additive — none of the imports or code above this line were changed.
import { Handshake, Lock as LockIcon, Repeat as RepeatIcon, History as HistoryIcon } from "lucide-react";
import { useExtendedData } from "./hooks/useExtendedData";
import { useUserRole } from "./hooks/useUserRole";
import RolesPage from "./pages/RolesPage";
import PartnersPage from "./pages/PartnersPage";
import DailyClosePage from "./pages/DailyClosePage";
import FixedExpensesPage from "./pages/FixedExpensesPage";
import AuditLogPage from "./pages/AuditLogPage";

/* ============================== DESIGN TOKENS ============================== */
const C = {
  bg: "#0A0D10", panel: "#12161B", panel2: "#171C22",
  border: "#232A32", borderSoft: "#1B2128",
  text: "#E8EEF1", textMuted: "#8A97A3", textFaint: "#5C6773",
  aqua: "#20D3C2", aquaSoft: "rgba(32,211,194,0.12)", aquaBorder: "rgba(32,211,194,0.35)",
  amber: "#F0A83C", amberSoft: "rgba(240,168,60,0.12)",
  red: "#F16A6A", redSoft: "rgba(241,106,106,0.12)",
  green: "#3FCB8C", greenSoft: "rgba(63,203,140,0.12)",
  violet: "#8B7CF6", violetSoft: "rgba(139,124,246,0.12)",
};
const FONT_DISPLAY = "'Tajawal', system-ui, sans-serif";

/* ============================== CONSTANTS ============================== */
const STAGES = [
  { key: "arrival", label: "وصول السيارة" },
  { key: "washStart", label: "بدء الغسيل" },
  { key: "dirtRemoved", label: "إزالة الأتربة" },
  { key: "soapStart", label: "بدء الصابون" },
  { key: "soapEnd", label: "انتهاء الصابون" },
  { key: "rinse", label: "الشطف بالماء" },
  { key: "moveToDry", label: "النقل لمنطقة التجفيف" },
  { key: "dryStart", label: "بدء التجفيف الخارجي" },
  { key: "dryEnd", label: "انتهاء التجفيف الخارجي" },
  { key: "interiorStart", label: "بدء التنظيف الداخلي" },
  { key: "interiorEnd", label: "انتهاء التنظيف الداخلي" },
  { key: "inspection", label: "فحص الجودة" },
  { key: "delivered", label: "تسليم السيارة" },
];
const CAR_TYPES = ["سيدان", "دفع رباعي", "بيك أب", "فان", "أخرى"];
const CAR_SIZES = ["صغيرة", "متوسطة", "كبيرة"];
const DIRT_LEVELS = ["خفيف", "متوسط", "شديد"];
const SERVICE_TYPES = ["خارجي فقط", "خارجي + داخلي", "خدمة كاملة", "بريميوم"];
const PROBLEM_OPTIONS = ["بقع ماء", "زجاج غير نظيف", "الداخلية غير نظيفة", "شكوى عميل", "أخرى"];
const PAYMENT_METHODS = ["نقدًا", "زين كاش", "كي كارد", "ماستركارد", "فيزا"];
const EXPENSE_CATEGORIES = ["ماء", "صابون", "مناشف", "وقود", "كهرباء", "صيانة", "معدات", "رواتب الموظفين", "شاي", "طعام", "مواد تنظيف", "أخرى"];
const SIZE_KEY = { "صغيرة": "small", "متوسطة": "medium", "كبيرة": "large" };
const DEFAULT_TARGETS = { small: 35, medium: 40, large: 50 };
const PIE_COLORS = [C.aqua, C.amber, C.violet, C.red, C.green];

/* ============================== HELPERS ============================== */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
function fmtMin(mins) {
  if (mins == null || isNaN(mins)) return "—";
  const m = Math.round(mins);
  if (m < 60) return `${m} د`;
  const h = Math.floor(m / 60);
  return `${h}س ${m % 60}د`;
}
function fmtMoney(n) {
  if (n == null || isNaN(n)) return "0";
  return Math.round(n).toLocaleString("ar-EG");
}
function elapsedMinutes(fromISO, toISO) {
  if (!fromISO || !toISO) return null;
  return (new Date(toISO) - new Date(fromISO)) / 60000;
}
function carTotalMinutes(car) {
  return elapsedMinutes(car.timestamps.arrival, car.timestamps.delivered || new Date().toISOString());
}
function carStatus(car) { return car.timestamps.delivered ? "completed" : "inprogress"; }
function targetForCar(car, settings) { return settings.targets[SIZE_KEY[car.carSize] || "medium"]; }
function carNet(car) { return Math.max(0, (Number(car.price) || 0) - (Number(car.discount) || 0)); }
function isSameDay(a, b) { return new Date(a).toDateString() === new Date(b).toDateString(); }
function startOfWeek(d) { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; }
function startOfMonth(d) { const x = new Date(d); x.setDate(1); x.setHours(0, 0, 0, 0); return x; }

function download(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function compressImage(file, maxDim = 900, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadJSZip() {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => reject(new Error("jszip load failed"));
    document.head.appendChild(s);
  });
}

function toCSV(header, rows) {
  return "\uFEFF" + [header, ...rows].map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}

function buildPDFReport(cars, employees, expenses, settings) {
  const doc = new jsPDF();
  const completed = cars.filter((c) => carStatus(c) === "completed");
  const totalRevenue = completed.reduce((s, c) => s + carNet(c), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  doc.setFontSize(16);
  doc.text("CarWash Pro - Business Report", 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")}`, 14, 22);

  doc.setFontSize(11);
  doc.text(`Total cars: ${cars.length}   Completed: ${completed.length}   Employees: ${employees.length}`, 14, 30);
  doc.text(`Total revenue: ${Math.round(totalRevenue)}   Total expenses: ${Math.round(totalExpenses)}   Net: ${Math.round(totalRevenue - totalExpenses)}`, 14, 36);

  autoTable(doc, {
    startY: 42,
    head: [["Car #", "Customer", "Type", "Size", "Price", "Discount", "Paid", "Status", "Date"]],
    body: cars.map((c) => [
      c.carNumber || "-", c.customerName || "-", c.carType || "-", c.carSize || "-",
      Math.round(c.price || 0), Math.round(c.discount || 0), c.paid ? "Yes" : "No",
      carStatus(c) === "completed" ? "Completed" : "In progress",
      c.timestamps?.arrival ? c.timestamps.arrival.slice(0, 10) : "-"
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [32, 211, 194] }
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 10,
    head: [["Date", "Category", "Amount", "Description"]],
    body: expenses.map((e) => [e.date || "-", e.category || "-", Math.round(e.amount || 0), e.description || "-"]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [240, 168, 60] }
  });

  return doc;
}

/* ============================== UI PRIMITIVES ============================== */
function Panel({ children, style, className = "" }) {
  return <div className={`rounded-2xl ${className}`} style={{ background: C.panel, border: `1px solid ${C.border}`, ...style }}>{children}</div>;
}
function Badge({ children, color = C.aqua, bg = C.aquaSoft, border = C.aquaBorder }) {
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ color, background: bg, border: `1px solid ${border}` }}>{children}</span>;
}
function Button({ children, onClick, variant = "primary", className = "", icon: Icon, disabled, type = "button" }) {
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
function StatCard({ label, value, sub, icon: Icon, accent = C.aqua }) {
  return (
    <Panel style={{ padding: "18px" }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs" style={{ color: C.textMuted }}>{label}</div>
          <div className="text-2xl font-bold mt-1.5" style={{ color: C.text }}>{value}</div>
          {sub && <div className="text-xs mt-1" style={{ color: C.textFaint }}>{sub}</div>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}1F`, color: accent }}>
          <Icon size={18} />
        </div>
      </div>
    </Panel>
  );
}
function RatingStars({ value, onChange, size = 20 }) {
  return (
    <div className="flex gap-1" style={{ direction: "ltr" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange && onChange(n)}>
          <Star size={size} fill={n <= value ? C.amber : "none"} color={n <= value ? C.amber : C.textFaint} />
        </button>
      ))}
    </div>
  );
}
function SectionTitle({ children, sub }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold" style={{ color: C.text }}>{children}</h2>
      {sub && <p className="text-sm mt-0.5" style={{ color: C.textMuted }}>{sub}</p>}
    </div>
  );
}
function Modal({ open, onClose, children, title, wide }) {
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
function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold mb-1.5" style={{ color: C.textMuted }}>{label}</label>
      {children}
    </div>
  );
}
const inputStyle = { width: "100%", background: C.panel2, border: `1px solid ${C.border}`, color: C.text, borderRadius: "12px", padding: "10px 12px", fontSize: "14px", outline: "none" };
function PillGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className="px-3.5 py-2 rounded-xl text-sm font-medium transition-all"
          style={value === opt ? { background: C.aquaSoft, color: C.aqua, border: `1px solid ${C.aquaBorder}` } : { background: C.panel2, color: C.textMuted, border: `1px solid ${C.border}` }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

/* ============================== SIDEBAR ============================== */
function Sidebar({ tab, setTab, alertCount }) {
  const items = [
    { id: "dashboard", label: "الرئيسية", icon: Gauge },
    { id: "cars", label: "السيارات", icon: Car },
    { id: "employees", label: "الموظفون", icon: Users },
    { id: "expenses", label: "المصروفات", icon: Wallet },
    { id: "analytics", label: "التحليلات والتقارير", icon: BarChart3 },
    { id: "fixedExpenses", label: "المصروفات الثابتة", icon: RepeatIcon },
    { id: "dailyClose", label: "الإقفال اليومي", icon: LockIcon },
    { id: "partners", label: "الشركاء", icon: Handshake },
    { id: "roles", label: "الأدوار والصلاحيات", icon: ShieldCheck },
    { id: "auditLog", label: "سجل التدقيق", icon: HistoryIcon },
    { id: "settings", label: "الإعدادات والنسخ الاحتياطي", icon: SettingsIcon },
  ];
  return (
    <>
      <div className="hidden sm:flex flex-col w-64 shrink-0 h-screen sticky top-0 p-4" style={{ background: C.panel, borderInlineStart: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2.5 px-2 py-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: C.aquaSoft }}>
            <Droplets size={19} color={C.aqua} />
          </div>
          <div>
            <div className="font-bold text-sm" style={{ color: C.text }}>مغسلة برو</div>
            <div className="text-[11px]" style={{ color: C.textFaint }}>نظام إدارة الأداء والمالية</div>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {items.map((it) => {
            const Icon = it.icon; const active = tab === it.id;
            return (
              <button key={it.id} onClick={() => setTab(it.id)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all relative"
                style={active ? { background: C.aquaSoft, color: C.aqua } : { color: C.textMuted }}>
                <Icon size={18} />{it.label}
                {it.id === "dashboard" && alertCount > 0 && (
                  <span className="ms-auto text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center" style={{ background: C.red, color: "#fff" }}>{alertCount}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-auto px-2 py-3 text-[11px]" style={{ color: C.textFaint }}>
          <ShieldCheck size={12} className="inline me-1" /> بياناتك تُحفظ تلقائيًا وباستمرار
        </div>
      </div>
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 flex justify-around py-2 px-1 overflow-x-auto" style={{ background: C.panel, borderTop: `1px solid ${C.border}` }}>
        {items.map((it) => {
          const Icon = it.icon; const active = tab === it.id;
          return (
            <button key={it.id} onClick={() => setTab(it.id)} className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl relative shrink-0" style={{ color: active ? C.aqua : C.textFaint }}>
              <Icon size={18} />
              <span className="text-[9px] font-medium">{it.label.split(" ")[0]}</span>
              {it.id === "dashboard" && alertCount > 0 && <span className="absolute top-0 end-1 w-2 h-2 rounded-full" style={{ background: C.red }} />}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ============================== PHOTO WIDGETS ============================== */
function PhotoPicker({ label, photos, onAdd, onRemove }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(null);

  async function handleFiles(files) {
    setBusy(true);
    for (const file of Array.from(files)) {
      try { const b64 = await compressImage(file); onAdd(b64); } catch (e) { /* skip */ }
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold" style={{ color: C.textMuted }}>{label}</label>
        <button type="button" onClick={() => inputRef.current?.click()} className="text-xs font-medium flex items-center gap-1" style={{ color: C.aqua }}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />} إضافة صورة
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </div>
      {photos.length === 0 ? (
        <div className="text-xs py-3 text-center rounded-xl" style={{ color: C.textFaint, background: C.panel2, border: `1px dashed ${C.border}` }}>لا توجد صور بعد</div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden group" style={{ border: `1px solid ${C.border}` }}>
              <img src={p} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => setZoom(p)} />
              <button type="button" onClick={() => onRemove(i)} className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
                <X size={11} color="#fff" />
              </button>
            </div>
          ))}
        </div>
      )}
      {zoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: "rgba(4,6,8,0.9)" }} onClick={() => setZoom(null)}>
          <img src={zoom} alt="" className="max-w-full max-h-[80vh] rounded-xl" />
          <button className="absolute top-5 end-5" onClick={() => setZoom(null)}><X size={26} color="#fff" /></button>
          <a href={zoom} download="car-photo.jpg" onClick={(e) => e.stopPropagation()} className="absolute bottom-6 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5" style={{ background: C.aqua, color: "#04211D" }}>
            <Download size={14} /> تنزيل
          </a>
        </div>
      )}
    </div>
  );
}

function PhotoGalleryBadge({ before = [], after = [] }) {
  if (before.length === 0 && after.length === 0) return null;
  return (
    <Badge color={C.violet} bg={C.violetSoft} border="rgba(139,124,246,0.4)">
      <ImageIcon size={12} /> {before.length + after.length} صورة
    </Badge>
  );
}

/* ============================== NEW CAR MODAL ============================== */
function NewCarModal({ open, onClose, employees, onCreate }) {
  const [form, setForm] = useState(initial());
  function initial() {
    return {
      carNumber: "", customerName: "", carType: CAR_TYPES[0], carSize: CAR_SIZES[1],
      dirtLevel: DIRT_LEVELS[1], notes: "", serviceType: SERVICE_TYPES[0], employeeIds: [],
      price: "", discount: "", paymentMethod: PAYMENT_METHODS[0], paid: false,
      photosBefore: [],
    };
  }
  useEffect(() => { if (open) setForm(initial()); }, [open]);
  function toggleEmp(id) { setForm((f) => ({ ...f, employeeIds: f.employeeIds.includes(id) ? f.employeeIds.filter((x) => x !== id) : [...f.employeeIds, id] })); }
  function submit() { onCreate(form); onClose(); }

  return (
    <Modal open={open} onClose={onClose} title="استقبال سيارة جديدة" wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="رقم اللوحة (اختياري)">
          <input style={inputStyle} value={form.carNumber} onChange={(e) => setForm({ ...form, carNumber: e.target.value })} placeholder="أ ب ج 1234" />
        </Field>
        <Field label="اسم العميل (اختياري)">
          <input style={inputStyle} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="اسم العميل" />
        </Field>
      </div>
      <Field label="نوع السيارة"><PillGroup options={CAR_TYPES} value={form.carType} onChange={(v) => setForm({ ...form, carType: v })} /></Field>
      <Field label="حجم السيارة"><PillGroup options={CAR_SIZES} value={form.carSize} onChange={(v) => setForm({ ...form, carSize: v })} /></Field>
      <Field label="مستوى الاتساخ"><PillGroup options={DIRT_LEVELS} value={form.dirtLevel} onChange={(v) => setForm({ ...form, dirtLevel: v })} /></Field>
      <Field label="نوع الخدمة"><PillGroup options={SERVICE_TYPES} value={form.serviceType} onChange={(v) => setForm({ ...form, serviceType: v })} /></Field>
      <Field label="فريق العمل">
        {employees.length === 0 ? <div className="text-sm" style={{ color: C.textFaint }}>أضف موظفين أولاً من صفحة الموظفين.</div> : (
          <div className="flex flex-wrap gap-2">
            {employees.map((emp) => (
              <button key={emp.id} type="button" onClick={() => toggleEmp(emp.id)} className="px-3 py-1.5 rounded-full text-sm font-medium"
                style={form.employeeIds.includes(emp.id) ? { background: C.aquaSoft, color: C.aqua, border: `1px solid ${C.aquaBorder}` } : { background: C.panel2, color: C.textMuted, border: `1px solid ${C.border}` }}>
                {emp.name}
              </button>
            ))}
          </div>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="السعر (د.ع / ر.س)"><input type="number" style={inputStyle} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" /></Field>
        <Field label="الخصم"><input type="number" style={inputStyle} value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} placeholder="0" /></Field>
      </div>
      <Field label="طريقة الدفع"><PillGroup options={PAYMENT_METHODS} value={form.paymentMethod} onChange={(v) => setForm({ ...form, paymentMethod: v })} /></Field>
      <div className="flex items-center gap-2 mb-4">
        <input type="checkbox" id="paidNow" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} className="w-4 h-4" />
        <label htmlFor="paidNow" className="text-sm" style={{ color: C.text }}>تم الدفع</label>
      </div>

      <Field label="صور قبل الغسيل">
        <PhotoPicker label="" photos={form.photosBefore} onAdd={(b64) => setForm((f) => ({ ...f, photosBefore: [...f.photosBefore, b64] }))} onRemove={(i) => setForm((f) => ({ ...f, photosBefore: f.photosBefore.filter((_, x) => x !== i) }))} />
      </Field>

      <Field label="ملاحظات العميل">
        <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات إضافية..." />
      </Field>
      <Button onClick={submit} icon={Play} className="w-full mt-2">بدء الاستقبال وتسجيل الوقت</Button>
    </Modal>
  );
}

/* ============================== QUALITY MODAL ============================== */
function QualityModal({ car, onClose, onSave, getPhotos, setPhotos }) {
  const [rating, setRating] = useState(5);
  const [problems, setProblems] = useState([]);
  const [afterPhotos, setAfterPhotos] = useState([]);
  useEffect(() => {
    if (car) {
      setRating(car.quality?.rating || 5);
      setProblems(car.quality?.problems || []);
      setAfterPhotos(getPhotos(car.id)?.after || []);
    }
  }, [car]);
  if (!car) return null;
  function toggleProblem(p) { setProblems((ps) => (ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p])); }
  function save() {
    setPhotos(car.id, (prev) => ({ before: prev?.before || [], after: afterPhotos }));
    onSave(car.id, { rating, problems });
  }
  return (
    <Modal open={!!car} onClose={onClose} title="فحص الجودة قبل التسليم" wide>
      <Field label="صور بعد الغسيل">
        <PhotoPicker label="" photos={afterPhotos} onAdd={(b64) => setAfterPhotos((p) => [...p, b64])} onRemove={(i) => setAfterPhotos((p) => p.filter((_, x) => x !== i))} />
      </Field>
      <Field label="تقييم الجودة"><RatingStars value={rating} onChange={setRating} size={28} /></Field>
      <Field label="هل توجد مشاكل؟">
        <div className="flex flex-wrap gap-2">
          {PROBLEM_OPTIONS.map((p) => (
            <button key={p} type="button" onClick={() => toggleProblem(p)} className="px-3 py-1.5 rounded-full text-sm font-medium"
              style={problems.includes(p) ? { background: C.redSoft, color: C.red, border: `1px solid rgba(241,106,106,0.4)` } : { background: C.panel2, color: C.textMuted, border: `1px solid ${C.border}` }}>
              {p}
            </button>
          ))}
        </div>
      </Field>
      <Button onClick={save} icon={CheckCircle2} className="w-full mt-2">تأكيد وتسليم السيارة</Button>
    </Modal>
  );
}

/* ============================== INVOICE MODAL ============================== */
function InvoiceModal({ car, onClose, onSave }) {
  const [form, setForm] = useState(null);
  useEffect(() => { if (car) setForm({ price: car.price || "", discount: car.discount || "", paymentMethod: car.paymentMethod || PAYMENT_METHODS[0], paid: !!car.paid }); }, [car]);
  if (!car || !form) return null;
  return (
    <Modal open={!!car} onClose={onClose} title="بيانات الفاتورة">
      <div className="grid grid-cols-2 gap-3">
        <Field label="السعر"><input type="number" style={inputStyle} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
        <Field label="الخصم"><input type="number" style={inputStyle} value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} /></Field>
      </div>
      <Field label="طريقة الدفع"><PillGroup options={PAYMENT_METHODS} value={form.paymentMethod} onChange={(v) => setForm({ ...form, paymentMethod: v })} /></Field>
      <div className="flex items-center gap-2 mb-4">
        <input type="checkbox" id="paidEdit" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} className="w-4 h-4" />
        <label htmlFor="paidEdit" className="text-sm" style={{ color: C.text }}>تم الدفع</label>
      </div>
      <Button onClick={() => { onSave(car.id, form); onClose(); }} icon={DollarSign} className="w-full">حفظ الفاتورة</Button>
    </Modal>
  );
}

/* ============================== CAR CARD ============================== */
function CarCard({ car, employees, settings, onAdvance, onOpenQuality, onOpenInvoice, onDelete, getPhotos }) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (carStatus(car) !== "inprogress") return;
    const t = setInterval(() => forceTick((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, [car]);

  const doneCount = STAGES.filter((s) => car.timestamps[s.key]).length;
  const nextStage = STAGES[doneCount];
  const status = carStatus(car);
  const total = carTotalMinutes(car);
  const target = targetForCar(car, settings);
  const overTarget = status === "inprogress" && total > target;
  const empNames = car.employeeIds.map((id) => employees.find((e) => e.id === id)?.name).filter(Boolean);
  const photos = getPhotos(car.id) || { before: [], after: [] };
  const net = carNet(car);

  return (
    <Panel style={{ padding: "16px" }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm" style={{ color: C.text }}>{car.carNumber || "بدون رقم"}</span>
            <Badge color={C.textMuted} bg={C.panel2} border={C.border}>{car.carType}</Badge>
            <Badge color={C.textMuted} bg={C.panel2} border={C.border}>{car.carSize}</Badge>
            <PhotoGalleryBadge before={photos.before} after={photos.after} />
          </div>
          <div className="text-xs mt-1" style={{ color: C.textFaint }}>
            {car.serviceType} · اتساخ {car.dirtLevel}{car.customerName ? ` · ${car.customerName}` : ""}
          </div>
        </div>
        {status === "completed" ? (
          <Badge color={C.green} bg={C.greenSoft} border="rgba(63,203,140,0.4)"><CheckCircle2 size={12} /> مكتملة</Badge>
        ) : overTarget ? (
          <Badge color={C.red} bg={C.redSoft} border="rgba(241,106,106,0.4)"><AlertTriangle size={12} /> متأخرة</Badge>
        ) : (
          <Badge><Clock size={12} /> جارية</Badge>
        )}
      </div>

      {empNames.length > 0 && <div className="text-xs mb-3" style={{ color: C.textMuted }}>👤 {empNames.join("، ")}</div>}

      <div className="flex gap-1 mb-3">
        {STAGES.map((s) => <div key={s.key} className="h-1.5 flex-1 rounded-full" style={{ background: car.timestamps[s.key] ? C.aqua : C.borderSoft }} title={s.label} />)}
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="text-xs" style={{ color: C.textMuted }}>{status === "completed" ? "الوقت الإجمالي" : "الوقت المنقضي"}</div>
        <div className="text-lg font-bold" style={{ color: overTarget ? C.red : C.text }}>
          {fmtMin(total)} <span className="text-xs font-normal" style={{ color: C.textFaint }}>/ هدف {target}د</span>
        </div>
      </div>

      {(car.price || net > 0) && (
        <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl" style={{ background: C.panel2 }}>
          <span className="text-xs" style={{ color: C.textMuted }}>{car.paymentMethod}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: C.text }}>{fmtMoney(net)}</span>
            <Badge color={car.paid ? C.green : C.amber} bg={car.paid ? C.greenSoft : C.amberSoft} border={car.paid ? "rgba(63,203,140,0.4)" : "rgba(240,168,60,0.4)"}>
              {car.paid ? "مدفوع" : "غير مدفوع"}
            </Badge>
          </div>
        </div>
      )}

      {status === "inprogress" ? (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => nextStage.key === "delivered" ? onOpenQuality(car) : onAdvance(car.id, nextStage.key)} icon={nextStage.key === "delivered" ? Sparkles : ChevronLeft}>
            {nextStage.key === "delivered" ? "إنهاء وفحص الجودة" : `التالي: ${nextStage.label}`}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <RatingStars value={car.quality?.rating || 0} size={14} />
          <div className="flex items-center gap-3">
            <button onClick={() => onOpenInvoice(car)} className="text-xs flex items-center gap-1" style={{ color: C.aqua }}><Receipt size={13} /> الفاتورة</button>
            <button onClick={() => onDelete(car.id)} style={{ color: C.textFaint }}><Trash2 size={15} /></button>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ============================== DASHBOARD ============================== */
function Dashboard({ cars, employees, settings, expenses, alerts }) {
  const today = new Date().toDateString();
  const todayCars = cars.filter((c) => new Date(c.createdAt).toDateString() === today);
  const completed = todayCars.filter((c) => carStatus(c) === "completed");
  const waiting = todayCars.filter((c) => carStatus(c) === "inprogress");
  const durations = completed.map((c) => carTotalMinutes(c)).filter((x) => x != null);
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const fastest = durations.length ? Math.min(...durations) : null;
  const slowest = durations.length ? Math.max(...durations) : null;
  const activeEmployeeIds = new Set(waiting.flatMap((c) => c.employeeIds));

  const todayRevenue = cars.filter((c) => isSameDay(c.createdAt, new Date())).reduce((a, c) => a + carNet(c), 0);
  const todayExpenses = expenses.filter((e) => isSameDay(e.date, new Date())).reduce((a, e) => a + (Number(e.amount) || 0), 0);

  const byDay = useMemo(() => {
    const map = {};
    cars.filter((c) => carStatus(c) === "completed").forEach((c) => {
      const key = new Date(c.timestamps.delivered).toLocaleDateString("ar-EG", { weekday: "short" });
      (map[key] = map[key] || []).push(carTotalMinutes(c));
    });
    return Object.entries(map).map(([day, vals]) => ({ day, متوسط: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) }));
  }, [cars]);

  const byEmployee = useMemo(() => employees.map((emp) => {
    const vals = cars.filter((c) => c.employeeIds.includes(emp.id) && carStatus(c) === "completed").map((c) => carTotalMinutes(c));
    return { name: emp.name, متوسط: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0 };
  }).filter((e) => e.متوسط > 0), [cars, employees]);

  const perHour = useMemo(() => {
    const map = {};
    todayCars.forEach((c) => { const h = new Date(c.createdAt).getHours(); map[h] = (map[h] || 0) + 1; });
    return Object.entries(map).sort((a, b) => a[0] - b[0]).map(([h, n]) => ({ ساعة: `${h}:00`, سيارات: n }));
  }, [todayCars]);

  const completionRate = todayCars.length ? Math.round((completed.length / todayCars.length) * 100) : 0;

  return (
    <div>
      <SectionTitle sub="نظرة عامة على أداء المغسلة اليوم">لوحة التحكم</SectionTitle>

      {alerts.length > 0 && (
        <div className="mb-5 flex flex-col gap-2">
          {alerts.slice(0, 4).map((a, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: C.redSoft, border: `1px solid rgba(241,106,106,0.35)` }}>
              <AlertTriangle size={17} color={C.red} className="shrink-0" />
              <span className="text-sm" style={{ color: C.text }}>{a}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="سيارات اليوم" value={todayCars.length} icon={Car} accent={C.aqua} />
        <StatCard label="سيارات مكتملة" value={completed.length} icon={CheckCircle2} accent={C.green} />
        <StatCard label="سيارات بالانتظار" value={waiting.length} icon={Clock} accent={C.amber} />
        <StatCard label="متوسط وقت الغسيل" value={fmtMin(avg)} icon={Timer} accent={C.violet} />
        <StatCard label="أسرع سيارة" value={fmtMin(fastest)} icon={TrendingDown} accent={C.green} />
        <StatCard label="أبطأ سيارة" value={fmtMin(slowest)} icon={TrendingUp} accent={C.red} />
        <StatCard label="موظفون يعملون الآن" value={activeEmployeeIds.size} icon={Users} accent={C.aqua} />
        <StatCard label="نسبة الإنجاز" value={`${completionRate}%`} icon={Gauge} accent={C.amber} />
      </div>

      <Panel style={{ padding: "18px", marginBottom: 16 }}>
        <div className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: C.text }}><Wallet size={15} color={C.aqua} /> الملخص المالي اليوم</div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-xl" style={{ background: C.panel2 }}>
            <div className="text-xs mb-1" style={{ color: C.textFaint }}>الإيرادات</div>
            <div className="text-lg font-bold" style={{ color: C.green }}>{fmtMoney(todayRevenue)}</div>
          </div>
          <div className="text-center p-3 rounded-xl" style={{ background: C.panel2 }}>
            <div className="text-xs mb-1" style={{ color: C.textFaint }}>المصروفات</div>
            <div className="text-lg font-bold" style={{ color: C.red }}>{fmtMoney(todayExpenses)}</div>
          </div>
          <div className="text-center p-3 rounded-xl" style={{ background: C.panel2 }}>
            <div className="text-xs mb-1" style={{ color: C.textFaint }}>الربح</div>
            <div className="text-lg font-bold" style={{ color: C.aqua }}>{fmtMoney(todayRevenue - todayExpenses)}</div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel style={{ padding: "18px" }}>
          <div className="font-semibold text-sm mb-3" style={{ color: C.text }}>متوسط الوقت حسب اليوم</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={byDay}>
              <CartesianGrid stroke={C.borderSoft} vertical={false} />
              <XAxis dataKey="day" stroke={C.textFaint} fontSize={12} />
              <YAxis stroke={C.textFaint} fontSize={12} />
              <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
              <Line type="monotone" dataKey="متوسط" stroke={C.aqua} strokeWidth={2.5} dot={{ fill: C.aqua, r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel style={{ padding: "18px" }}>
          <div className="font-semibold text-sm mb-3" style={{ color: C.text }}>متوسط الوقت حسب الموظف</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byEmployee}>
              <CartesianGrid stroke={C.borderSoft} vertical={false} />
              <XAxis dataKey="name" stroke={C.textFaint} fontSize={12} />
              <YAxis stroke={C.textFaint} fontSize={12} />
              <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
              <Bar dataKey="متوسط" fill={C.violet} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel style={{ padding: "18px" }}>
          <div className="font-semibold text-sm mb-3" style={{ color: C.text }}>عدد السيارات لكل ساعة (اليوم)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={perHour}>
              <CartesianGrid stroke={C.borderSoft} vertical={false} />
              <XAxis dataKey="ساعة" stroke={C.textFaint} fontSize={12} />
              <YAxis stroke={C.textFaint} fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
              <Bar dataKey="سيارات" fill={C.aqua} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel style={{ padding: "18px" }}>
          <div className="font-semibold text-sm mb-3" style={{ color: C.text }}>نسبة الإنجاز اليوم</div>
          <ResponsiveContainer width="100%" height={220}>
            <RadialBarChart innerRadius="60%" outerRadius="100%" data={[{ name: "إنجاز", value: completionRate, fill: C.aqua }]} startAngle={90} endAngle={-270}>
              <RadialBar background={{ fill: C.borderSoft }} dataKey="value" cornerRadius={20} />
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ fill: C.text, fontSize: 28, fontWeight: 700 }}>{completionRate}%</text>
            </RadialBarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}

/* ============================== CARS PAGE ============================== */
function CarsPage({ cars, employees, settings, onCreate, onAdvance, onSaveQuality, onSaveInvoice, onDelete, getPhotos, setPhotos }) {
  const [showNew, setShowNew] = useState(false);
  const [qualityCar, setQualityCar] = useState(null);
  const [invoiceCar, setInvoiceCar] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("الكل");

  const filtered = cars.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).filter((c) => {
    if (filter === "جارية" && carStatus(c) !== "inprogress") return false;
    if (filter === "مكتملة" && carStatus(c) !== "completed") return false;
    if (filter === "غير مدفوعة" && (c.paid || carStatus(c) !== "completed")) return false;
    if (!query) return true;
    const q = query.trim();
    return (c.carNumber || "").includes(q) || (c.customerName || "").includes(q) || c.carType.includes(q) || c.serviceType.includes(q);
  });

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <SectionTitle sub="استقبال السيارات، الفوترة، الصور، وتتبع كل مرحلة لحظة بلحظة">السيارات</SectionTitle>
        <Button icon={Plus} onClick={() => setShowNew(true)}>سيارة جديدة</Button>
      </div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 end-3" color={C.textFaint} />
          <input style={{ ...inputStyle, paddingInlineEnd: 34 }} placeholder="ابحث برقم اللوحة أو العميل أو النوع..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <PillGroup options={["الكل", "جارية", "مكتملة", "غير مدفوعة"]} value={filter} onChange={setFilter} />
      </div>

      {filtered.length === 0 ? (
        <Panel style={{ padding: "40px", textAlign: "center" }}>
          <Car size={28} color={C.textFaint} className="mx-auto mb-2" />
          <div style={{ color: C.textMuted }}>لا توجد سيارات مطابقة. ابدأ باستقبال سيارة جديدة.</div>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((car) => (
            <CarCard key={car.id} car={car} employees={employees} settings={settings}
              onAdvance={onAdvance} onOpenQuality={setQualityCar} onOpenInvoice={setInvoiceCar}
              onDelete={onDelete} getPhotos={getPhotos} />
          ))}
        </div>
      )}

      <NewCarModal open={showNew} onClose={() => setShowNew(false)} employees={employees} onCreate={onCreate} />
      <QualityModal car={qualityCar} onClose={() => setQualityCar(null)}
        onSave={(id, q) => { onSaveQuality(id, q); setQualityCar(null); }}
        getPhotos={getPhotos} setPhotos={setPhotos} />
      <InvoiceModal car={invoiceCar} onClose={() => setInvoiceCar(null)} onSave={onSaveInvoice} />
    </div>
  );
}

/* ============================== EMPLOYEES PAGE ============================== */
function EmployeeModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", phone: "", position: "" });
  useEffect(() => { if (open) setForm({ name: "", phone: "", position: "" }); }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="إضافة موظف">
      <Field label="الاسم"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الموظف" /></Field>
      <Field label="الهاتف (اختياري)"><input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05xxxxxxxx" /></Field>
      <Field label="الوظيفة"><input style={inputStyle} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="غسال / مشرف / ..." /></Field>
      <Button className="w-full mt-1" icon={Plus} disabled={!form.name.trim()} onClick={() => { onCreate(form); onClose(); }}>إضافة الموظف</Button>
    </Modal>
  );
}

function EmployeesPage({ employees, cars, onCreate, onToggleActive, onDelete }) {
  const [showNew, setShowNew] = useState(false);
  const stats = employees.map((emp) => {
    const empCars = cars.filter((c) => c.employeeIds.includes(emp.id) && carStatus(c) === "completed");
    const durations = empCars.map((c) => carTotalMinutes(c));
    const avgTime = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
    const ratings = empCars.map((c) => c.quality?.rating).filter(Boolean);
    const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    return { ...emp, carsCompleted: empCars.length, avgTime, avgRating, totalHours: durations.reduce((a, b) => a + b, 0) / 60 };
  }).sort((a, b) => b.carsCompleted - a.carsCompleted);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <SectionTitle sub="أداء الفريق ولوحة الصدارة">الموظفون</SectionTitle>
        <Button icon={Plus} onClick={() => setShowNew(true)}>إضافة موظف</Button>
      </div>
      {stats.length > 0 && (
        <Panel style={{ padding: "18px", marginBottom: 16 }}>
          <div className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: C.text }}><Award size={16} color={C.amber} /> لوحة الصدارة</div>
          <div className="flex flex-col gap-2">
            {stats.slice(0, 5).map((e, i) => (
              <div key={e.id} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: i === 0 ? C.amberSoft : C.panel2, color: i === 0 ? C.amber : C.textMuted }}>{i + 1}</div>
                <div className="text-sm flex-1" style={{ color: C.text }}>{e.name}</div>
                <div className="text-xs" style={{ color: C.textMuted }}>{e.carsCompleted} سيارة</div>
                <div className="text-xs" style={{ color: C.textFaint }}>{fmtMin(e.avgTime)}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {employees.length === 0 ? (
        <Panel style={{ padding: "40px", textAlign: "center" }}>
          <Users size={28} color={C.textFaint} className="mx-auto mb-2" />
          <div style={{ color: C.textMuted }}>لا يوجد موظفون بعد. أضف أول موظف للبدء.</div>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {stats.map((emp) => (
            <Panel key={emp.id} style={{ padding: "16px" }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: C.aquaSoft }}><User size={17} color={C.aqua} /></div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: C.text }}>{emp.name}</div>
                    <div className="text-xs" style={{ color: C.textFaint }}>{emp.position || "غير محدد"}</div>
                  </div>
                </div>
                <button onClick={() => onToggleActive(emp.id)}>
                  <Badge color={emp.active ? C.green : C.textFaint} bg={emp.active ? C.greenSoft : C.panel2} border={emp.active ? "rgba(63,203,140,0.4)" : C.border}>{emp.active ? "يعمل" : "غير نشط"}</Badge>
                </button>
              </div>
              {emp.phone && <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: C.textMuted }}><Phone size={12} /> {emp.phone}</div>}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="text-center"><div className="text-sm font-bold" style={{ color: C.text }}>{emp.carsCompleted}</div><div className="text-[10px]" style={{ color: C.textFaint }}>سيارات</div></div>
                <div className="text-center"><div className="text-sm font-bold" style={{ color: C.text }}>{fmtMin(emp.avgTime)}</div><div className="text-[10px]" style={{ color: C.textFaint }}>متوسط الوقت</div></div>
                <div className="text-center"><div className="text-sm font-bold flex items-center justify-center gap-1" style={{ color: C.text }}>{emp.avgRating ? emp.avgRating.toFixed(1) : "—"} <Star size={11} fill={C.amber} color={C.amber} /></div><div className="text-[10px]" style={{ color: C.textFaint }}>الجودة</div></div>
              </div>
              <button onClick={() => onDelete(emp.id)} className="text-xs mt-3 flex items-center gap-1" style={{ color: C.textFaint }}><Trash2 size={12} /> حذف الموظف</button>
            </Panel>
          ))}
        </div>
      )}
      <EmployeeModal open={showNew} onClose={() => setShowNew(false)} onCreate={onCreate} />
    </div>
  );
}

/* ============================== EXPENSES PAGE ============================== */
function ExpenseModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState(initial());
  function initial() { return { category: EXPENSE_CATEGORIES[0], amount: "", description: "", date: new Date().toISOString().slice(0, 16), receipt: null }; }
  useEffect(() => { if (open) setForm(initial()); }, [open]);
  async function handleReceipt(file) { try { const b64 = await compressImage(file, 700, 0.55); setForm((f) => ({ ...f, receipt: b64 })); } catch (e) {} }
  return (
    <Modal open={open} onClose={onClose} title="إضافة مصروف">
      <Field label="الفئة"><PillGroup options={EXPENSE_CATEGORIES} value={form.category} onChange={(v) => setForm({ ...form, category: v })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="المبلغ"><input type="number" style={inputStyle} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" /></Field>
        <Field label="التاريخ والوقت"><input type="datetime-local" style={inputStyle} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
      </div>
      <Field label="الوصف"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="تفاصيل المصروف..." /></Field>
      <Field label="صورة الإيصال (اختياري)">
        <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && handleReceipt(e.target.files[0])} className="text-xs" style={{ color: C.textMuted }} />
        {form.receipt && <img src={form.receipt} alt="" className="mt-2 w-24 h-24 object-cover rounded-lg" style={{ border: `1px solid ${C.border}` }} />}
      </Field>
      <Button className="w-full mt-1" icon={Plus} disabled={!form.amount} onClick={() => { onCreate({ ...form, date: new Date(form.date).toISOString() }); onClose(); }}>إضافة المصروف</Button>
    </Modal>
  );
}

function ExpensesPage({ expenses, cars, onCreate, onDelete }) {
  const [showNew, setShowNew] = useState(false);
  const now = new Date();
  const todayTotal = expenses.filter((e) => isSameDay(e.date, now)).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const weekTotal = expenses.filter((e) => new Date(e.date) >= startOfWeek(now)).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const monthTotal = expenses.filter((e) => new Date(e.date) >= startOfMonth(now)).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const yearTotal = expenses.filter((e) => new Date(e.date).getFullYear() === now.getFullYear()).reduce((a, e) => a + (Number(e.amount) || 0), 0);

  const byCategory = useMemo(() => {
    const map = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + (Number(e.amount) || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const sorted = expenses.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <SectionTitle sub="تسجيل ومتابعة كل مصروفات المغسلة">المصروفات</SectionTitle>
        <Button icon={Plus} onClick={() => setShowNew(true)}>إضافة مصروف</Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="مصروفات اليوم" value={fmtMoney(todayTotal)} icon={Wallet} accent={C.red} />
        <StatCard label="مصروفات الأسبوع" value={fmtMoney(weekTotal)} icon={Wallet} accent={C.amber} />
        <StatCard label="مصروفات الشهر" value={fmtMoney(monthTotal)} icon={Wallet} accent={C.violet} />
        <StatCard label="مصروفات السنة" value={fmtMoney(yearTotal)} icon={Wallet} accent={C.textMuted} />
      </div>

      {byCategory.length > 0 && (
        <Panel style={{ padding: "18px", marginBottom: 16 }}>
          <div className="font-semibold text-sm mb-3" style={{ color: C.text }}>المصروفات حسب الفئة</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byCategory} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke={C.borderSoft} horizontal={false} />
              <XAxis type="number" stroke={C.textFaint} fontSize={11} />
              <YAxis type="category" dataKey="name" stroke={C.textFaint} fontSize={11} width={90} />
              <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
              <Bar dataKey="value" fill={C.red} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {sorted.length === 0 ? (
        <Panel style={{ padding: "40px", textAlign: "center" }}>
          <Receipt size={28} color={C.textFaint} className="mx-auto mb-2" />
          <div style={{ color: C.textMuted }}>لا توجد مصروفات مسجلة بعد.</div>
        </Panel>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((e) => (
            <Panel key={e.id} style={{ padding: "12px 16px" }} className="flex items-center gap-3">
              {e.receipt ? <img src={e.receipt} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" /> : <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.panel2 }}><Receipt size={16} color={C.textFaint} /></div>}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: C.text }}>{e.category}{e.description ? ` — ${e.description}` : ""}</div>
                <div className="text-xs" style={{ color: C.textFaint }}>{new Date(e.date).toLocaleString("ar-EG")}</div>
              </div>
              <div className="text-sm font-bold shrink-0" style={{ color: C.red }}>{fmtMoney(e.amount)}</div>
              <button onClick={() => onDelete(e.id)} style={{ color: C.textFaint }}><Trash2 size={14} /></button>
            </Panel>
          ))}
        </div>
      )}
      <ExpenseModal open={showNew} onClose={() => setShowNew(false)} onCreate={onCreate} />
    </div>
  );
}

/* ============================== ANALYTICS + REPORTS PAGE ============================== */
function AnalyticsPage({ cars, employees, expenses, settings }) {
  const [exporting, setExporting] = useState(false);
  const completedCars = cars.filter((c) => carStatus(c) === "completed");
  const now = new Date();

  const byType = useMemo(() => {
    const map = {};
    completedCars.forEach((c) => (map[c.carType] = map[c.carType] || []).push(carTotalMinutes(c)));
    return Object.entries(map).map(([name, vals]) => ({ name, value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) }));
  }, [completedCars]);

  const byDirt = useMemo(() => {
    const map = {};
    completedCars.forEach((c) => (map[c.dirtLevel] = map[c.dirtLevel] || []).push(carTotalMinutes(c)));
    return Object.entries(map).map(([name, vals]) => ({ name, متوسط: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) }));
  }, [completedCars]);

  const byService = useMemo(() => {
    const map = {};
    completedCars.forEach((c) => (map[c.serviceType] = (map[c.serviceType] || 0) + 1));
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [completedCars]);

  const stageAverages = useMemo(() => STAGES.slice(1).map((s, i) => {
    const prevKey = STAGES[i].key;
    const vals = completedCars.map((c) => elapsedMinutes(c.timestamps[prevKey], c.timestamps[s.key])).filter((v) => v != null && v >= 0);
    return { stage: s.label, متوسط: vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0 };
  }), [completedCars]);
  const mostDelayedStage = stageAverages.slice().sort((a, b) => b.متوسط - a.متوسط)[0];

  const employeeAvg = useMemo(() => employees.map((emp) => {
    const empCars = completedCars.filter((c) => c.employeeIds.includes(emp.id));
    const vals = empCars.map((c) => carTotalMinutes(c));
    return { name: emp.name, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, count: empCars.length };
  }).filter((e) => e.avg != null), [completedCars, employees]);
  const mostEfficient = employeeAvg.slice().sort((a, b) => a.avg - b.avg)[0];
  const mostProductive = employeeAvg.slice().sort((a, b) => b.count - a.count)[0];

  const peakHours = useMemo(() => {
    const map = {};
    cars.forEach((c) => { const h = new Date(c.createdAt).getHours(); map[h] = (map[h] || 0) + 1; });
    const arr = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return { peak: arr[0], slow: arr[arr.length - 1] };
  }, [cars]);

  const overallAvg = completedCars.length ? completedCars.reduce((a, c) => a + carTotalMinutes(c), 0) / completedCars.length : null;

  const mostCommonService = byService.slice().sort((a, b) => b.value - a.value)[0];
  const mostDelayedCars = completedCars.slice().sort((a, b) => carTotalMinutes(b) - carTotalMinutes(a)).slice(0, 5);

  // Revenue / Profit trend (last 14 days)
  const trend = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const rev = cars.filter((c) => isSameDay(c.createdAt, d)).reduce((a, c) => a + carNet(c), 0);
      const exp = expenses.filter((e) => isSameDay(e.date, d)).reduce((a, e) => a + (Number(e.amount) || 0), 0);
      days.push({ day: d.toLocaleDateString("ar-EG", { day: "numeric", month: "numeric" }), إيرادات: rev, مصروفات: exp, ربح: rev - exp });
    }
    return days;
  }, [cars, expenses]);

  function periodTotals(fromDate) {
    const revCars = cars.filter((c) => new Date(c.createdAt) >= fromDate);
    const rev = revCars.reduce((a, c) => a + carNet(c), 0);
    const exp = expenses.filter((e) => new Date(e.date) >= fromDate).reduce((a, e) => a + (Number(e.amount) || 0), 0);
    return { rev, exp, profit: rev - exp, avgPerCar: revCars.length ? rev / revCars.length : 0 };
  }
  const weekF = periodTotals(startOfWeek(now));
  const monthF = periodTotals(startOfMonth(now));

  function exportCSV() {
    const header = ["رقم اللوحة", "العميل", "النوع", "الحجم", "الاتساخ", "الخدمة", "الموظفون", "الوقت (د)", "السعر", "الخصم", "الصافي", "طريقة الدفع", "مدفوع", "الجودة", "الحالة", "التاريخ"];
    const rows = cars.map((c) => [
      c.carNumber, c.customerName, c.carType, c.carSize, c.dirtLevel, c.serviceType,
      c.employeeIds.map((id) => employees.find((e) => e.id === id)?.name).filter(Boolean).join(" / "),
      Math.round(carTotalMinutes(c) || 0), c.price || 0, c.discount || 0, carNet(c), c.paymentMethod, c.paid ? "نعم" : "لا",
      c.quality?.rating || "", carStatus(c) === "completed" ? "مكتملة" : "جارية", new Date(c.createdAt).toLocaleString("ar-EG"),
    ]);
    download("cars-report.csv", toCSV(header, rows), "text/csv;charset=utf-8");
  }
  function exportExpensesCSV() {
    const header = ["الفئة", "المبلغ", "الوصف", "التاريخ"];
    const rows = expenses.map((e) => [e.category, e.amount, e.description, new Date(e.date).toLocaleString("ar-EG")]);
    download("expenses-report.csv", toCSV(header, rows), "text/csv;charset=utf-8");
  }
  function exportJSON() { download("carwash-database.json", JSON.stringify({ cars, employees, expenses, settings }, null, 2), "application/json"); }
  function exportXLSX() {
    try {
      const rows = cars.map((c) => ({
        "رقم اللوحة": c.carNumber, "العميل": c.customerName, "النوع": c.carType, "الحجم": c.carSize,
        "الوقت (د)": Math.round(carTotalMinutes(c) || 0), "الصافي": carNet(c), "مدفوع": c.paid ? "نعم" : "لا",
        "الحالة": carStatus(c) === "completed" ? "مكتملة" : "جارية", "التاريخ": new Date(c.createdAt).toLocaleString("ar-EG"),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "السيارات");
      XLSX.writeFile(wb, "carwash-data.xlsx");
    } catch (e) { exportCSV(); }
  }

  async function exportAnalysisPackage() {
    setExporting(true);
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();
      zip.file("database.json", JSON.stringify({ cars, employees, expenses, settings }, null, 2));
      zip.file("cars_report.csv", toCSV(
        ["رقم اللوحة", "النوع", "الحجم", "الاتساخ", "الخدمة", "الوقت(د)", "الصافي", "مدفوع", "الحالة", "التاريخ"],
        cars.map((c) => [c.carNumber, c.carType, c.carSize, c.dirtLevel, c.serviceType, Math.round(carTotalMinutes(c) || 0), carNet(c), c.paid ? "نعم" : "لا", carStatus(c), c.createdAt])
      ));
      zip.file("expenses_report.csv", toCSV(["الفئة", "المبلغ", "الوصف", "التاريخ"], expenses.map((e) => [e.category, e.amount, e.description, e.date])));
      zip.file("employee_statistics.csv", toCSV(
        ["الموظف", "سيارات مكتملة", "متوسط الوقت(د)", "متوسط الجودة"],
        employeeAvg.map((e) => [e.name, e.count, Math.round(e.avg), (employees.find(x=>x.name===e.name))?.avgRating || ""])
      ));
      zip.file("car_statistics.json", JSON.stringify({ byType, byDirt, byService, stageAverages, mostDelayedStage, mostDelayedCars: mostDelayedCars.map(c=>({car:c.carNumber, minutes: Math.round(carTotalMinutes(c))})) }, null, 2));
      zip.file("performance_timeline.json", JSON.stringify(cars.map((c) => ({ id: c.id, carNumber: c.carNumber, timestamps: c.timestamps })), null, 2));
      zip.file("photos_metadata.json", JSON.stringify(cars.map((c) => ({ id: c.id, carNumber: c.carNumber, hasPhotos: true })), null, 2));
      zip.file("revenue_expenses_trend.json", JSON.stringify(trend, null, 2));
      zip.file("README.txt", "هذه الحزمة معدة للتحليل التشغيلي — يمكن رفعها مباشرة لتحليل الأداء والاختناقات والربحية.");
      const blob = await zip.generateAsync({ type: "blob" });
      download("carwash-analysis-package.zip", blob, "application/zip");
    } catch (e) {
      exportJSON(); exportCSV(); exportExpensesCSV();
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <SectionTitle sub="تحليلات تشغيلية وتقارير مالية شاملة">التحليلات والتقارير</SectionTitle>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="متوسط وقت الخدمة" value={fmtMin(overallAvg)} icon={Timer} accent={C.aqua} />
        <StatCard label="أكثر مرحلة تأخيرًا" value={mostDelayedStage?.stage || "—"} sub={mostDelayedStage ? `${mostDelayedStage.متوسط} دقيقة` : ""} icon={AlertTriangle} accent={C.red} />
        <StatCard label="الموظف الأكفأ" value={mostEfficient?.name || "—"} sub={mostEfficient ? fmtMin(mostEfficient.avg) : ""} icon={Zap} accent={C.green} />
        <StatCard label="الأكثر إنتاجية" value={mostProductive?.name || "—"} sub={mostProductive ? `${mostProductive.count} سيارة` : ""} icon={Award} accent={C.amber} />
      </div>

      <Panel style={{ padding: "18px", marginBottom: 16 }}>
        <div className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: C.text }}><ProfitIcon size={15} color={C.aqua} /> اللوحة المالية</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl" style={{ background: C.panel2 }}>
            <div className="text-xs mb-1" style={{ color: C.textFaint }}>إيرادات الأسبوع</div>
            <div className="text-base font-bold" style={{ color: C.green }}>{fmtMoney(weekF.rev)}</div>
          </div>
          <div className="p-3 rounded-xl" style={{ background: C.panel2 }}>
            <div className="text-xs mb-1" style={{ color: C.textFaint }}>ربح الأسبوع</div>
            <div className="text-base font-bold" style={{ color: C.aqua }}>{fmtMoney(weekF.profit)}</div>
          </div>
          <div className="p-3 rounded-xl" style={{ background: C.panel2 }}>
            <div className="text-xs mb-1" style={{ color: C.textFaint }}>إيرادات الشهر</div>
            <div className="text-base font-bold" style={{ color: C.green }}>{fmtMoney(monthF.rev)}</div>
          </div>
          <div className="p-3 rounded-xl" style={{ background: C.panel2 }}>
            <div className="text-xs mb-1" style={{ color: C.textFaint }}>ربح الشهر</div>
            <div className="text-base font-bold" style={{ color: C.aqua }}>{fmtMoney(monthF.profit)}</div>
          </div>
        </div>
        <div className="text-xs mt-3" style={{ color: C.textFaint }}>متوسط الإيراد لكل سيارة (هذا الشهر): {fmtMoney(monthF.avgPerCar)}</div>
      </Panel>

      <Panel style={{ padding: "18px", marginBottom: 16 }}>
        <div className="font-semibold text-sm mb-3" style={{ color: C.text }}>اتجاه الإيرادات والمصروفات والربح (14 يومًا)</div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trend}>
            <CartesianGrid stroke={C.borderSoft} vertical={false} />
            <XAxis dataKey="day" stroke={C.textFaint} fontSize={11} />
            <YAxis stroke={C.textFaint} fontSize={11} />
            <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="إيرادات" stroke={C.green} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="مصروفات" stroke={C.red} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ربح" stroke={C.aqua} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Panel style={{ padding: "18px" }}>
          <div className="font-semibold text-sm mb-3" style={{ color: C.text }}>متوسط الوقت لكل مرحلة (تحليل الاختناقات)</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stageAverages} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid stroke={C.borderSoft} horizontal={false} />
              <XAxis type="number" stroke={C.textFaint} fontSize={11} />
              <YAxis type="category" dataKey="stage" stroke={C.textFaint} fontSize={10.5} width={130} />
              <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
              <Bar dataKey="متوسط" radius={[0, 6, 6, 0]}>
                {stageAverages.map((s, i) => <Cell key={i} fill={mostDelayedStage && s.stage === mostDelayedStage.stage ? C.red : C.aqua} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel style={{ padding: "18px" }}>
          <div className="font-semibold text-sm mb-3" style={{ color: C.text }}>متوسط الوقت حسب مستوى الاتساخ</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byDirt}>
              <CartesianGrid stroke={C.borderSoft} vertical={false} />
              <XAxis dataKey="name" stroke={C.textFaint} fontSize={12} />
              <YAxis stroke={C.textFaint} fontSize={12} />
              <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
              <Bar dataKey="متوسط" fill={C.amber} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel style={{ padding: "18px", marginBottom: 16 }}>
        <div className="font-semibold text-sm mb-3" style={{ color: C.text }}>أكثر 5 سيارات تأخرًا</div>
        <div className="flex flex-col gap-2">
          {mostDelayedCars.length === 0 ? <div className="text-sm" style={{ color: C.textFaint }}>لا توجد بيانات كافية.</div> : mostDelayedCars.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span style={{ color: C.text }}>{c.carNumber || "بدون رقم"} · {c.carType}</span>
              <span style={{ color: C.red }} className="font-semibold">{fmtMin(carTotalMinutes(c))}</span>
            </div>
          ))}
        </div>
        <div className="text-xs mt-3" style={{ color: C.textFaint }}>الخدمة الأكثر طلبًا: {mostCommonService?.name || "—"} ({mostCommonService?.value || 0} سيارة) · ساعة الذروة: {peakHours.peak ? `${peakHours.peak[0]}:00` : "—"}</div>
      </Panel>

      <Panel style={{ padding: "18px" }}>
        <div className="font-semibold text-sm mb-3" style={{ color: C.text }}>التصدير والتقارير</div>
        <div className="flex flex-wrap gap-2.5 mb-3">
          <Button variant="subtle" icon={FileSpreadsheet} onClick={exportXLSX}>تصدير Excel</Button>
          <Button variant="subtle" icon={FileDown} onClick={exportCSV}>تصدير CSV (سيارات)</Button>
          <Button variant="subtle" icon={FileDown} onClick={exportExpensesCSV}>تصدير CSV (مصروفات)</Button>
          <Button variant="subtle" icon={FileJson} onClick={exportJSON}>تصدير JSON</Button>
        </div>
        <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: 12 }}>
          <Button icon={exporting ? Loader2 : PackageCheck} onClick={exportAnalysisPackage} disabled={exporting}>
            {exporting ? "جارٍ التجهيز..." : "تصدير حزمة التحليل الكاملة (ZIP)"}
          </Button>
          <div className="text-xs mt-2" style={{ color: C.textFaint }}>حزمة مصممة للرفع إلى ChatGPT أو أي محلل بيانات لاكتشاف الاختناقات وفرص التحسين.</div>
        </div>
      </Panel>
    </div>
  );
}

/* ============================== SETTINGS + BACKUP PAGE ============================== */
function SettingsPage({ settings, onSave, cars, employees, expenses, onRestoreAll, allPhotos, syncStatus, onSyncNow, onSignOut, cloudConfigured }) {
  const [targets, setTargets] = useState(settings.targets);
  useEffect(() => setTargets(settings.targets), [settings]);
  const [saved, setSaved] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef(null);

  function save() { onSave({ ...settings, targets }); setSaved(true); setTimeout(() => setSaved(false), 1800); }

  async function exportCompleteBusinessData() {
    setExporting(true);
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();

      zip.file("complete-database.json", JSON.stringify({ cars, employees, expenses, settings, photos: allPhotos, exportedAt: new Date().toISOString() }, null, 2));

      zip.file("cars.csv", toCSV(
        ["رقم السيارة", "العميل", "النوع", "الحجم", "السعر", "الخصم", "مدفوع", "الحالة", "التاريخ"],
        cars.map((c) => [c.carNumber, c.customerName, c.carType, c.carSize, c.price, c.discount, c.paid ? "نعم" : "لا", carStatus(c), c.timestamps?.arrival])
      ));
      zip.file("expenses.csv", toCSV(["التاريخ", "الفئة", "المبلغ", "الوصف"], expenses.map((e) => [e.date, e.category, e.amount, e.description])));
      zip.file("employees.csv", toCSV(["الاسم", "الهاتف", "الوظيفة", "نشط"], employees.map((e) => [e.name, e.phone, e.position, e.active ? "نعم" : "لا"])));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cars), "السيارات");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenses), "المصاريف");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(employees), "الموظفون");
      zip.file("complete-data.xlsx", XLSX.write(wb, { type: "array", bookType: "xlsx" }));

      const pdfDoc = buildPDFReport(cars, employees, expenses, settings);
      zip.file("business-report.pdf", pdfDoc.output("blob"));

      const blob = await zip.generateAsync({ type: "blob" });
      download(`carwash-complete-export-${new Date().toISOString().slice(0, 10)}.zip`, blob, "application/zip");
    } finally {
      setExporting(false);
    }
  }

  async function downloadBackup() {
    const payload = { cars, employees, expenses, settings, photos: allPhotos, exportedAt: new Date().toISOString() };
    download(`carwash-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload), "application/json");
  }

  function handleImport(file) {
    setRestoring(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        onRestoreAll(data);
      } catch (err) { alert("ملف النسخة الاحتياطية غير صالح."); }
      setRestoring(false);
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <SectionTitle sub="الأهداف الزمنية، النسخ الاحتياطي، واستعادة البيانات">الإعدادات</SectionTitle>

      <Panel style={{ padding: "20px", maxWidth: 480, marginBottom: 16 }}>
        <div className="font-semibold text-sm mb-4" style={{ color: C.text }}>الوقت المستهدف للغسيل (بالدقائق)</div>
        {[["small", "سيارة صغيرة"], ["medium", "سيارة متوسطة"], ["large", "سيارة كبيرة"]].map(([key, label]) => (
          <Field key={key} label={label}>
            <input type="number" style={inputStyle} value={targets[key]} onChange={(e) => setTargets({ ...targets, [key]: Number(e.target.value) || 0 })} />
          </Field>
        ))}
        <Button onClick={save} icon={CheckCircle2} className="w-full mt-1">{saved ? "تم الحفظ ✓" : "حفظ الإعدادات"}</Button>
      </Panel>

      <Panel style={{ padding: "20px", maxWidth: 480, marginBottom: 16 }}>
        <div className="font-semibold text-sm mb-2 flex items-center gap-2" style={{ color: C.text }}>
          {syncStatus?.online ? <Cloud size={16} color={C.aqua} /> : <WifiOff size={16} color={C.amber} />} حالة المزامنة السحابية
        </div>
        {!cloudConfigured ? (
          <p className="text-xs mb-2" style={{ color: C.textMuted }}>لم يتم ربط Supabase بعد — البيانات محفوظة محليًا فقط على هذا الجهاز. أضف بيانات الاتصال في ملف .env للمزامنة السحابية.</p>
        ) : (
          <>
            <p className="text-xs mb-1" style={{ color: C.textMuted }}>
              {syncStatus?.online ? "متصل — تتم المزامنة تلقائيًا" : "غير متصل بالإنترنت — التغييرات محفوظة محليًا وستُزامن تلقائيًا عند عودة الاتصال"}
            </p>
            <p className="text-xs mb-3" style={{ color: C.textMuted }}>
              عناصر بانتظار المزامنة: {syncStatus?.pending ?? 0} · آخر مزامنة: {syncStatus?.lastSync ? new Date(syncStatus.lastSync).toLocaleString("ar-EG") : "—"}
            </p>
            <div className="flex gap-2.5">
              <Button variant="subtle" icon={RefreshCw} onClick={onSyncNow} className="flex-1">مزامنة الآن</Button>
              <Button variant="ghost" icon={LogOut} onClick={onSignOut} className="flex-1">تسجيل الخروج</Button>
            </div>
          </>
        )}
      </Panel>

      <Panel style={{ padding: "20px", maxWidth: 480, marginBottom: 16 }}>
        <div className="font-semibold text-sm mb-2 flex items-center gap-2" style={{ color: C.text }}><PackagePlus size={16} color={C.violet} /> تصدير بيانات الأعمال الكاملة</div>
        <p className="text-xs mb-4" style={{ color: C.textMuted }}>
          يُنشئ ملف ZIP واحد يحتوي على JSON و CSV و Excel و تقرير PDF — مناسب للتحليل الخارجي (مثل ChatGPT) أو الأرشفة.
        </p>
        <Button variant="subtle" icon={exporting ? Loader2 : PackagePlus} onClick={exportCompleteBusinessData} disabled={exporting} className="w-full">
          {exporting ? "جارٍ التصدير..." : "تصدير بيانات الأعمال الكاملة"}
        </Button>
      </Panel>

      <Panel style={{ padding: "20px", maxWidth: 480 }}>
        <div className="font-semibold text-sm mb-2 flex items-center gap-2" style={{ color: C.text }}><ShieldCheck size={16} color={C.aqua} /> النسخ الاحتياطي والاستعادة</div>
        <p className="text-xs mb-4" style={{ color: C.textMuted }}>
          تُحفظ بياناتك تلقائيًا وباستمرار مع كل تحديث، محليًا وسحابيًا. يمكنك أيضًا تنزيل نسخة احتياطية كاملة (تشمل الصور) في أي وقت، أو استيراد نسخة سابقة.
        </p>
        <div className="flex flex-col gap-2.5">
          <Button variant="subtle" icon={Download} onClick={downloadBackup} className="w-full">تنزيل نسخة احتياطية كاملة</Button>
          <Button variant="subtle" icon={restoring ? Loader2 : Upload} onClick={() => fileRef.current?.click()} disabled={restoring} className="w-full">
            {restoring ? "جارٍ الاستيراد..." : "استيراد نسخة احتياطية"}
          </Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files[0] && handleImport(e.target.files[0])} />
        </div>
      </Panel>
    </div>
  );
}

/* ============================== ALERTS ENGINE ============================== */
function computeAlerts(cars, employees, expenses, settings) {
  const alerts = [];
  cars.filter((c) => carStatus(c) === "inprogress").forEach((c) => {
    const total = carTotalMinutes(c);
    const target = targetForCar(c, settings);
    if (total > target * 1.3) alerts.push(`السيارة ${c.carNumber || "بدون رقم"} تجاوزت الوقت المستهدف بـ ${Math.round(total - target)} دقيقة`);
  });
  const completed = cars.filter((c) => carStatus(c) === "completed");
  const overallAvg = completed.length ? completed.reduce((a, c) => a + carTotalMinutes(c), 0) / completed.length : null;
  if (overallAvg) {
    employees.forEach((emp) => {
      const empCars = completed.filter((c) => c.employeeIds.includes(emp.id));
      if (empCars.length < 2) return;
      const empAvg = empCars.reduce((a, c) => a + carTotalMinutes(c), 0) / empCars.length;
      if (empAvg > overallAvg * 1.2) alerts.push(`الموظف ${emp.name} أبطأ من المتوسط العام بنسبة ${Math.round((empAvg / overallAvg - 1) * 100)}%`);
    });
  }
  const recentQuality = completed.slice(-10).map((c) => c.quality?.rating).filter(Boolean);
  if (recentQuality.length >= 5) {
    const avgQ = recentQuality.reduce((a, b) => a + b, 0) / recentQuality.length;
    if (avgQ < 3.5) alerts.push(`جودة الخدمة في تراجع — متوسط آخر التقييمات ${avgQ.toFixed(1)}★`);
  }
  const unpaidCount = completed.filter((c) => !c.paid && carNet(c) > 0).length;
  if (unpaidCount > 0) alerts.push(`يوجد ${unpaidCount} سيارة مكتملة غير مدفوعة`);
  return alerts;
}

/* ============================== MAIN APP ============================== */
export default function CarWashApp() {
  const [loading, setLoading] = useState(true);
  const [cars, setCars] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState({ targets: DEFAULT_TARGETS });
  const [photosMap, setPhotosMap] = useState({}); // carId -> {before:[], after:[]}
  const [tab, setTab] = useState("dashboard");

  // ---- Auth (only gates the app when Supabase is actually configured) ----
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(!isSupabaseConfigured);

  // ---- Connectivity / sync status ----
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState(null);

  // ---- PWA install prompt ----
  const [installPrompt, setInstallPrompt] = useState(null);

  // ---- Phase 1 extension: roles, partners, daily close, fixed expenses, audit log ----
  // Loads/persists independently of the core cars/employees/expenses state above.
  const ext = useExtendedData(!loading, session?.user?.email || null);
  const currentUserRole = useUserRole(session, ext.roles);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  // Auth bootstrap
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSession().then((s) => { setSession(s); setAuthChecked(true); });
    return onAuthChange((s) => setSession(s));
  }, []);

  // Connectivity + periodic sync
  useEffect(() => {
    const unsub = onConnectivityChange(async (isUp) => {
      setOnline(isUp);
      if (isUp) {
        const { flushed } = await flushQueue();
        if (flushed > 0) refreshSyncStatus();
      }
    });
    const interval = setInterval(refreshSyncStatus, 30000);
    refreshSyncStatus();
    return () => { unsub(); clearInterval(interval); };
  }, []);

  async function refreshSyncStatus() {
    setPending(await getPendingCount());
    setLastSync(await getLastSync());
  }

  // Capture the browser's native "Add to Home Screen" prompt
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  const installApp = useCallback(async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }, [installPrompt]);

  // Load core data: IndexedDB first (instant + offline-safe), then merge cloud
  useEffect(() => {
    if (isSupabaseConfigured && !session) { setLoading(!authChecked); return; }
    (async () => {
      setLoading(true);
      try {
        const state = await loadInitialState();
        setCars(state.cars); setEmployees(state.employees); setExpenses(state.expenses);
        setSettings(state.settings); setPhotosMap(state.photosMap);
      } catch (e) { console.error("Load failed", e); }
      await refreshSyncStatus();
      setLoading(false);
    })();
  }, [session, authChecked]);

  // Persist core data on change (IndexedDB write is immediate; cloud push is best-effort)
  const persistTimer = useRef(null);
  useEffect(() => {
    if (loading) return;
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistCore({ cars, employees, expenses, settings }).then(refreshSyncStatus);
    }, 500);
    return () => clearTimeout(persistTimer.current);
  }, [cars, employees, expenses, settings, loading]);

  const getPhotos = useCallback((carId) => photosMap[carId], [photosMap]);
  const setPhotos = useCallback((carId, updater) => {
    setPhotosMap((prev) => {
      const next = { ...prev, [carId]: typeof updater === "function" ? updater(prev[carId]) : updater };
      savePhotosLocal(carId, next[carId]).then(refreshSyncStatus).catch((e) => console.error("photo save failed", e));
      return next;
    });
  }, []);

  const alerts = useMemo(() => computeAlerts(cars, employees, expenses, settings), [cars, employees, expenses, settings]);

  // ---- Phase 1 extension: derived numbers for Partners (net profit) and Daily Close (today's cash) ----
  // Reuses the existing carNet/carStatus/isSameDay helpers above — no business logic duplicated.
  const netProfit = useMemo(() => {
    const revenue = cars.filter((c) => carStatus(c) === "completed").reduce((s, c) => s + carNet(c), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const fixedMonthly = ext.fixedExpenses.filter((f) => f.active !== false).reduce((s, f) => {
      const amt = Number(f.amount) || 0;
      return s + (f.frequency === "weekly" ? amt * (52 / 12) : f.frequency === "yearly" ? amt / 12 : amt);
    }, 0);
    return revenue - totalExpenses - fixedMonthly;
  }, [cars, expenses, ext.fixedExpenses]);

  const todaysSummary = useMemo(() => {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const todaysCars = cars.filter((c) => carStatus(c) === "completed" && c.timestamps?.delivered && isSameDay(c.timestamps.delivered, now));
    const todaysExpenses = expenses.filter((e) => e.date === date);
    const totalRevenue = todaysCars.reduce((s, c) => s + carNet(c), 0);
    const totalExpenses = todaysExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const cashByMethod = {};
    todaysCars.forEach((c) => {
      if (!c.paid) return;
      const method = c.paymentMethod || "غير محدد";
      cashByMethod[method] = (cashByMethod[method] || 0) + carNet(c);
    });
    const cashRevenue = cashByMethod["نقدًا"] || 0;
    const expectedCash = cashRevenue - totalExpenses;
    return { date, totalRevenue, totalExpenses, cashByMethod, expectedCash };
  }, [cars, expenses]);

  const createCar = useCallback((form) => {
    const now = new Date().toISOString();
    const id = uid();
    setCars((prev) => [...prev, {
      id, carNumber: form.carNumber, customerName: form.customerName, carType: form.carType, carSize: form.carSize,
      dirtLevel: form.dirtLevel, notes: form.notes, serviceType: form.serviceType, employeeIds: form.employeeIds,
      price: form.price, discount: form.discount, paymentMethod: form.paymentMethod, paid: form.paid,
      timestamps: { arrival: now }, quality: { rating: 0, problems: [] }, createdAt: now,
    }]);
    if (form.photosBefore && form.photosBefore.length) setPhotos(id, { before: form.photosBefore, after: [] });
  }, [setPhotos]);

  const advanceStage = useCallback((carId, stageKey) => {
    setCars((prev) => prev.map((c) => c.id === carId ? { ...c, timestamps: { ...c.timestamps, [stageKey]: new Date().toISOString() } } : c));
  }, []);
  const saveQuality = useCallback((carId, quality) => {
    setCars((prev) => prev.map((c) => c.id === carId ? { ...c, quality, timestamps: { ...c.timestamps, delivered: new Date().toISOString() } } : c));
  }, []);
  const saveInvoice = useCallback((carId, invoice) => {
    setCars((prev) => prev.map((c) => c.id === carId ? { ...c, ...invoice } : c));
  }, []);
  // Deletes are soft: the record is tagged deleted=true and kept forever in
  // IndexedDB + Supabase (see SUPABASE_SETUP.md). Only the visible UI list shrinks.
  const deleteCar = useCallback((id) => {
    setCars((prev) => {
      const record = prev.find((c) => c.id === id);
      if (record) softDeleteRecord("cars", id, record).catch(() => {});
      return prev.filter((c) => c.id !== id);
    });
    deletePhotosLocal(id).catch(() => {});
    setPhotosMap((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const createEmployee = useCallback((form) => setEmployees((prev) => [...prev, { id: uid(), name: form.name, phone: form.phone, position: form.position, active: true }]), []);
  const toggleEmployeeActive = useCallback((id) => setEmployees((prev) => prev.map((e) => e.id === id ? { ...e, active: !e.active } : e)), []);
  const deleteEmployee = useCallback((id) => setEmployees((prev) => {
    const record = prev.find((e) => e.id === id);
    if (record) softDeleteRecord("employees", id, record).catch(() => {});
    return prev.filter((e) => e.id !== id);
  }), []);

  const createExpense = useCallback((form) => setExpenses((prev) => [...prev, { id: uid(), ...form }]), []);
  const deleteExpense = useCallback((id) => setExpenses((prev) => {
    const record = prev.find((e) => e.id === id);
    if (record) softDeleteRecord("expenses", id, record).catch(() => {});
    return prev.filter((e) => e.id !== id);
  }), []);

  const restoreAll = useCallback(async (data) => {
    const merged = await importFullBackup(data);
    setCars(merged.cars); setEmployees(merged.employees); setExpenses(merged.expenses);
    setSettings(merged.settings); setPhotosMap(merged.photosMap);
    await refreshSyncStatus();
    alert("تمت استعادة النسخة الاحتياطية بنجاح.");
  }, []);

  const handleSignOut = useCallback(async () => { await signOut(); }, []);
  const handleSyncNow = useCallback(async () => {
    await persistCore({ cars, employees, expenses, settings });
    await flushQueue();
    await refreshSyncStatus();
  }, [cars, employees, expenses, settings]);

  if (isSupabaseConfigured && authChecked && !session) {
    return <LoginScreen onSuccess={() => {}} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, fontFamily: FONT_DISPLAY }}>
        <Loader2 className="animate-spin" color={C.aqua} size={28} />
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ fontFamily: FONT_DISPLAY, background: C.bg, minHeight: "100vh" }} className="flex">
      <style>{`
        * { box-sizing: border-box; }
        input:focus, textarea:focus { border-color: ${C.aqua} !important; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 8px; }
      `}</style>
      <Sidebar tab={tab} setTab={setTab} alertCount={alerts.length} />
      <div className="flex-1 p-4 sm:p-6 pb-24 sm:pb-6 max-w-[1400px] mx-auto w-full">
        {!online && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: C.amberSoft, color: C.amber, border: `1px solid rgba(240,168,60,0.35)` }}>
            <CloudOff size={14} /> غير متصل بالإنترنت — البيانات تُحفظ محليًا وستُزامن تلقائيًا عند عودة الاتصال {pending > 0 ? `(${pending} بانتظار المزامنة)` : ""}
          </div>
        )}
        {installPrompt && (
          <div className="flex items-center justify-between gap-2 mb-4 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: C.aquaSoft, color: C.aqua, border: `1px solid ${C.aquaBorder}` }}>
            <span>ثبّت التطبيق على جهازك لتجربة أسرع وعمل بدون إنترنت</span>
            <Button variant="primary" onClick={installApp} className="!py-1 !px-3">تثبيت</Button>
          </div>
        )}
        {tab === "dashboard" && <Dashboard cars={cars} employees={employees} settings={settings} expenses={expenses} alerts={alerts} />}
        {tab === "cars" && (
          <CarsPage cars={cars} employees={employees} settings={settings}
            onCreate={createCar} onAdvance={advanceStage} onSaveQuality={saveQuality} onSaveInvoice={saveInvoice}
            onDelete={deleteCar} getPhotos={getPhotos} setPhotos={setPhotos} />
        )}
        {tab === "employees" && <EmployeesPage employees={employees} cars={cars} onCreate={createEmployee} onToggleActive={toggleEmployeeActive} onDelete={deleteEmployee} />}
        {tab === "expenses" && <ExpensesPage expenses={expenses} cars={cars} onCreate={createExpense} onDelete={deleteExpense} />}
        {tab === "analytics" && <AnalyticsPage cars={cars} employees={employees} expenses={expenses} settings={settings} />}
        {tab === "fixedExpenses" && (
          <FixedExpensesPage fixedExpenses={ext.fixedExpenses}
            onCreate={ext.createFixedExpense} onToggleActive={ext.toggleFixedExpenseActive} onDelete={ext.deleteFixedExpense} />
        )}
        {tab === "dailyClose" && (
          <DailyClosePage dailyClose={ext.dailyClose} todaysSummary={todaysSummary}
            onCreate={ext.createDailyClose} onDelete={ext.deleteDailyClose} />
        )}
        {tab === "partners" && (
          <PartnersPage partners={ext.partners} netProfit={netProfit}
            onCreate={ext.createPartner} onUpdate={ext.updatePartner} onDelete={ext.deletePartner} />
        )}
        {tab === "roles" && (
          <RolesPage roles={ext.roles} currentUserRole={currentUserRole}
            onCreate={ext.createRole} onUpdate={ext.updateRole} onDelete={ext.deleteRole} />
        )}
        {tab === "auditLog" && <AuditLogPage auditLog={ext.auditLog} />}
        {tab === "settings" && (
          <SettingsPage settings={settings} onSave={setSettings} cars={cars} employees={employees} expenses={expenses}
            onRestoreAll={restoreAll} allPhotos={photosMap}
            syncStatus={{ online, pending, lastSync }} onSyncNow={handleSyncNow} onSignOut={handleSignOut}
            cloudConfigured={isSupabaseConfigured} />
        )}
      </div>
    </div>
  );
}
