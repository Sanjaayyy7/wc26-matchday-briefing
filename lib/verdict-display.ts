import type { Verdict } from "./kit-color";

/** Human label + icon for a settled prediction's verdict (design-language §2.4). */
export function verdictDisplay(verdict: Verdict): { label: string; icon: string } {
  switch (verdict) {
    case "nailed":
      return { label: "Nailed", icon: "◎" };
    case "hit":
      return { label: "Hit", icon: "✓" };
    case "close":
      return { label: "Close", icon: "~" };
    case "miss":
      return { label: "Miss", icon: "✗" };
  }
}
