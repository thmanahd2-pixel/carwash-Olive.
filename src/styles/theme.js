// Shared design tokens, mirrored from App.jsx's inline theme so every new
// Phase 1 page (roles, partners, daily close, fixed expenses, audit log)
// matches the existing look exactly. App.jsx keeps its own local copy —
// nothing here replaces it, this just gives new modular files the same values.
export const C = {
  bg: "#0A0D10", panel: "#12161B", panel2: "#171C22",
  border: "#232A32", borderSoft: "#1B2128",
  text: "#E8EEF1", textMuted: "#8A97A3", textFaint: "#5C6773",
  aqua: "#20D3C2", aquaSoft: "rgba(32,211,194,0.12)", aquaBorder: "rgba(32,211,194,0.35)",
  amber: "#F0A83C", amberSoft: "rgba(240,168,60,0.12)",
  red: "#F16A6A", redSoft: "rgba(241,106,106,0.12)",
  green: "#3FCB8C", greenSoft: "rgba(63,203,140,0.12)",
  violet: "#8B7CF6", violetSoft: "rgba(139,124,246,0.12)",
};

export const FONT_DISPLAY = "'Tajawal', system-ui, sans-serif";
