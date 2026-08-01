import React, { useState, useEffect } from "react";
import { Lock, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { C } from "../styles/theme";
import { fmtMoney } from "../lib/utils";
import { Panel, Badge, Button, SectionTitle, Field, inputStyle, StatCard, EmptyState } from "../components/ui/Primitives";

/**
 * todaysSummary shape (computed by the caller from existing cars/expenses
 * data, using the app's existing carNet/carStatus helpers — nothing here
 * re-implements that business logic):
 *   { date, totalRevenue, totalExpenses, cashByMethod: {method: amount}, expectedCash }
 */
export default function DailyClosePage({ dailyClose, todaysSummary, onCreate, onDelete }) {
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");

  const alreadyClosedToday = dailyClose.some((d) => d.date === todaysSummary.date);
  const difference = countedCash === "" ? null : (Number(countedCash) || 0) - todaysSummary.expectedCash;

  useEffect(() => { setCountedCash(""); setNotes(""); }, [todaysSummary.date]);

  function submit() {
    if (countedCash === "") return;
    onCreate({
      date: todaysSummary.date,
      openingCash: 0,
      expectedCash: todaysSummary.expectedCash,
      countedCash: Number(countedCash) || 0,
      totalRevenue: todaysSummary.totalRevenue,
      totalExpenses: todaysSummary.totalExpenses,
      cashByMethod: todaysSummary.cashByMethod,
      notes
    });
    setCountedCash(""); setNotes("");
  }

  return (
    <div>
      <SectionTitle sub="إقفال الصندوق نهاية اليوم ومطابقة النقدية">الإقفال اليومي</SectionTitle>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <StatCard label="إيرادات اليوم" value={fmtMoney(todaysSummary.totalRevenue)} />
        <StatCard label="مصروفات اليوم" value={fmtMoney(todaysSummary.totalExpenses)} accent={C.amber} />
        <StatCard label="النقد المتوقع بالصندوق" value={fmtMoney(todaysSummary.expectedCash)} accent={C.aqua} />
      </div>

      <Panel style={{ padding: "18px" }} className="mb-6">
        {alreadyClosedToday ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: C.green }}>
            <CheckCircle2 size={16} /> تم إقفال صندوق اليوم بالفعل.
          </div>
        ) : (
          <>
            <Field label="المبلغ النقدي الفعلي بالصندوق">
              <input type="number" style={inputStyle} value={countedCash} onChange={(e) => setCountedCash(e.target.value)} placeholder="0" />
            </Field>
            {difference !== null && difference !== 0 && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl text-xs font-medium"
                style={{ background: difference < 0 ? C.redSoft : C.amberSoft, color: difference < 0 ? C.red : C.amber, border: `1px solid ${difference < 0 ? "rgba(241,106,106,0.35)" : "rgba(240,168,60,0.35)"}` }}>
                <AlertTriangle size={14} /> فرق قدره {fmtMoney(Math.abs(difference))} {difference < 0 ? "نقص" : "زيادة"} عن المتوقع
              </div>
            )}
            <Field label="ملاحظات (اختياري)">
              <textarea style={{ ...inputStyle, minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Button onClick={submit} icon={Lock} className="w-full" disabled={countedCash === ""}>إقفال الصندوق</Button>
          </>
        )}
      </Panel>

      <SectionTitle>سجل الإقفالات السابقة</SectionTitle>
      {dailyClose.length === 0 ? (
        <EmptyState>لا يوجد إقفالات سابقة.</EmptyState>
      ) : (
        <div className="grid gap-3">
          {[...dailyClose].sort((a, b) => (a.date < b.date ? 1 : -1)).map((d) => (
            <Panel key={d.id} style={{ padding: "16px" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm" style={{ color: C.text }}>{d.date}</span>
                    {d.difference === 0 ? (
                      <Badge color={C.green} bg={C.greenSoft} border="rgba(63,203,140,0.35)">مطابق</Badge>
                    ) : (
                      <Badge color={d.difference < 0 ? C.red : C.amber} bg={d.difference < 0 ? C.redSoft : C.amberSoft} border={d.difference < 0 ? "rgba(241,106,106,0.35)" : "rgba(240,168,60,0.35)"}>
                        فرق {fmtMoney(Math.abs(d.difference))}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs mt-1" style={{ color: C.textMuted }}>
                    متوقع: {fmtMoney(d.expectedCash)} — فعلي: {fmtMoney(d.countedCash)}
                  </div>
                  {d.notes && <div className="text-xs mt-1" style={{ color: C.textFaint }}>{d.notes}</div>}
                </div>
                <button onClick={() => onDelete(d.id)} style={{ color: C.red }}><Trash2 size={16} /></button>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
