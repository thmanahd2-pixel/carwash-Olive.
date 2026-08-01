import { useMemo } from "react";

/**
 * Derives the current signed-in user's role from the `roles` table by
 * matching session email. Phase 1 scope: this is informational/display only
 * (shown in Settings, gates the Roles page itself) — it does not yet block
 * writes anywhere else in the app. Real per-action enforcement (e.g. "cashier
 * can't delete cars") is a Phase 2 item once the full permission matrix is
 * defined; Supabase RLS still allows any authenticated user everywhere for now.
 *
 * If Supabase auth isn't configured, or no matching role row exists yet, the
 * user is treated as "owner" so a fresh install / single-operator shop isn't
 * locked out of anything.
 */
export function useUserRole(session, roles) {
  return useMemo(() => {
    const email = session?.user?.email || null;
    if (!email) return { email: null, role: "owner", roleRecord: null, isOwnerOrAdmin: true };
    const match = (roles || []).find((r) => r.email && r.email.toLowerCase() === email.toLowerCase() && r.active !== false);
    const role = match?.role || "owner";
    return {
      email, role, roleRecord: match || null,
      isOwnerOrAdmin: role === "owner" || role === "admin"
    };
  }, [session, roles]);
}
