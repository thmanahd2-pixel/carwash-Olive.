import React, { useState } from "react";
import { Loader2, Droplets, LogIn } from "lucide-react";
import { signIn } from "../lib/auth";

const C = {
  bg: "#0A0D10", panel: "#12161B", border: "#232A32",
  text: "#E8EEF1", textMuted: "#8A97A3", aqua: "#20D3C2", red: "#F16A6A"
};

export default function LoginScreen({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await signIn(email, password);
      onSuccess?.();
    } catch (err) {
      setError("بيانات الدخول غير صحيحة أو الحساب غير موجود.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl p-6" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: "rgba(32,211,194,0.12)" }}>
            <Droplets color={C.aqua} size={28} />
          </div>
          <div className="text-lg font-bold" style={{ color: C.text }}>CarWash Pro</div>
          <div className="text-xs mt-1" style={{ color: C.textMuted }}>تسجيل الدخول للمتابعة</div>
        </div>

        <label className="text-xs font-semibold block mb-1" style={{ color: C.textMuted }}>البريد الإلكتروني</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: "#0E1216", border: `1px solid ${C.border}`, color: C.text }} />

        <label className="text-xs font-semibold block mb-1" style={{ color: C.textMuted }}>كلمة المرور</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: "#0E1216", border: `1px solid ${C.border}`, color: C.text }} />

        {error && <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ color: C.red, background: "rgba(241,106,106,0.12)" }}>{error}</div>}

        <button type="submit" disabled={busy}
          className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: C.aqua, color: "#04211D" }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          دخول
        </button>

        <div className="text-[11px] mt-4 text-center" style={{ color: C.textMuted }}>
          يتم إنشاء الحسابات من لوحة Supabase — لا يوجد تسجيل عام.
        </div>
      </form>
    </div>
  );
}
