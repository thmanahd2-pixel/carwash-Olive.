import { useState, useEffect, useRef, useCallback } from "react";
import {
  loadExtendedState, persistExtended, softDeleteExtendedRecord, appendAuditLog
} from "../lib/dataStore";
import { uid } from "../lib/utils";

/**
 * Owns state + persistence for the Phase 1 extension domains: roles,
 * partners, dailyClose, fixedExpenses, auditLog. Mirrors the load/persist
 * pattern already used for cars/employees/expenses in App.jsx, but kept
 * entirely separate so nothing about the existing core data flow changes.
 *
 * @param {boolean} ready - only start loading once the core app data (and
 *   auth, if configured) has finished loading, same gating App.jsx already
 *   uses for the core load effect.
 * @param {string|null} actorEmail - current signed-in user's email, attached
 *   to every audit log entry written from this hook.
 */
export function useExtendedData(ready, actorEmail) {
  const [loaded, setLoaded] = useState(false);
  const [roles, setRoles] = useState([]);
  const [partners, setPartners] = useState([]);
  const [dailyClose, setDailyClose] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [auditLog, setAuditLog] = useState([]);

  useEffect(() => {
    if (!ready || loaded) return;
    (async () => {
      try {
        const state = await loadExtendedState();
        setRoles(state.roles); setPartners(state.partners);
        setDailyClose(state.dailyClose); setFixedExpenses(state.fixedExpenses);
        setAuditLog(state.auditLog);
      } catch (e) { console.error("Extended data load failed", e); }
      setLoaded(true);
    })();
  }, [ready, loaded]);

  // Debounced persist, same 500ms pattern as the core data effect in App.jsx.
  const persistTimer = useRef(null);
  useEffect(() => {
    if (!loaded) return;
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistExtended({ roles, partners, dailyClose, fixedExpenses });
    }, 500);
    return () => clearTimeout(persistTimer.current);
  }, [roles, partners, dailyClose, fixedExpenses, loaded]);

  const log = useCallback((action, entityType, entityId, details) => {
    appendAuditLog({ actorEmail, action, entityType, entityId, details })
      .then((entry) => setAuditLog((prev) => [entry, ...prev]))
      .catch((e) => console.warn("Audit log write deferred:", e.message));
  }, [actorEmail]);

  /* ---- roles ---- */
  const createRole = useCallback((form) => {
    const record = { id: uid(), email: form.email, name: form.name, role: form.role, permissions: form.permissions || [], active: true, notes: form.notes || "" };
    setRoles((prev) => [...prev, record]);
    log("role.create", "roles", record.id, { email: record.email, role: record.role });
  }, [log]);
  const updateRole = useCallback((id, patch) => {
    setRoles((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
    log("role.update", "roles", id, patch);
  }, [log]);
  const deleteRole = useCallback((id) => {
    setRoles((prev) => {
      const record = prev.find((r) => r.id === id);
      if (record) softDeleteExtendedRecord("roles", id, record).catch(() => {});
      return prev.filter((r) => r.id !== id);
    });
    log("role.delete", "roles", id, {});
  }, [log]);

  /* ---- partners ---- */
  const createPartner = useCallback((form) => {
    const record = { id: uid(), name: form.name, phone: form.phone || "", sharePercentage: Number(form.sharePercentage) || 0, active: true, notes: form.notes || "" };
    setPartners((prev) => [...prev, record]);
    log("partner.create", "partners", record.id, { name: record.name, sharePercentage: record.sharePercentage });
  }, [log]);
  const updatePartner = useCallback((id, patch) => {
    setPartners((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
    log("partner.update", "partners", id, patch);
  }, [log]);
  const deletePartner = useCallback((id) => {
    setPartners((prev) => {
      const record = prev.find((p) => p.id === id);
      if (record) softDeleteExtendedRecord("partners", id, record).catch(() => {});
      return prev.filter((p) => p.id !== id);
    });
    log("partner.delete", "partners", id, {});
  }, [log]);

  /* ---- daily close ---- */
  const createDailyClose = useCallback((form) => {
    const record = {
      id: uid(), date: form.date, openingCash: Number(form.openingCash) || 0,
      expectedCash: Number(form.expectedCash) || 0, countedCash: Number(form.countedCash) || 0,
      difference: (Number(form.countedCash) || 0) - (Number(form.expectedCash) || 0),
      totalRevenue: Number(form.totalRevenue) || 0, totalExpenses: Number(form.totalExpenses) || 0,
      cashByMethod: form.cashByMethod || {}, closedBy: form.closedBy || actorEmail || null,
      notes: form.notes || "", status: "closed"
    };
    setDailyClose((prev) => [...prev, record]);
    log("dailyClose.create", "dailyClose", record.id, { date: record.date, difference: record.difference });
    return record;
  }, [log, actorEmail]);
  const deleteDailyClose = useCallback((id) => {
    setDailyClose((prev) => {
      const record = prev.find((d) => d.id === id);
      if (record) softDeleteExtendedRecord("dailyClose", id, record).catch(() => {});
      return prev.filter((d) => d.id !== id);
    });
    log("dailyClose.delete", "dailyClose", id, {});
  }, [log]);

  /* ---- fixed expenses ---- */
  const createFixedExpense = useCallback((form) => {
    const record = { id: uid(), name: form.name, category: form.category, amount: Number(form.amount) || 0, frequency: form.frequency || "monthly", dueDay: form.dueDay ? Number(form.dueDay) : null, active: true, notes: form.notes || "" };
    setFixedExpenses((prev) => [...prev, record]);
    log("fixedExpense.create", "fixedExpenses", record.id, { name: record.name, amount: record.amount, frequency: record.frequency });
  }, [log]);
  const toggleFixedExpenseActive = useCallback((id) => {
    setFixedExpenses((prev) => prev.map((f) => f.id === id ? { ...f, active: !f.active } : f));
    log("fixedExpense.toggleActive", "fixedExpenses", id, {});
  }, [log]);
  const deleteFixedExpense = useCallback((id) => {
    setFixedExpenses((prev) => {
      const record = prev.find((f) => f.id === id);
      if (record) softDeleteExtendedRecord("fixedExpenses", id, record).catch(() => {});
      return prev.filter((f) => f.id !== id);
    });
    log("fixedExpense.delete", "fixedExpenses", id, {});
  }, [log]);

  return {
    loaded, roles, partners, dailyClose, fixedExpenses, auditLog,
    createRole, updateRole, deleteRole,
    createPartner, updatePartner, deletePartner,
    createDailyClose, deleteDailyClose,
    createFixedExpense, toggleFixedExpenseActive, deleteFixedExpense,
    logAction: log
  };
}
