/**
 * AfroMuse Prompt Brain — Style Weighting
 *
 * Decides how strongly the user's free-form `style` direction should
 * dominate the auto-derived genre/mood/dna context. The weighting is
 * surfaced as a short adjective the brain places next to the direction
 * block so downstream models honour the user's intent in proportion to
 * how much detail they provided.
 */

export type StyleEmphasis = "primary" | "guiding" | "supporting" | "absent";

export interface StyleWeight {
  emphasis: StyleEmphasis;
  /** Short label inserted into the prompt, e.g. "highest priority". */
  label: string;
  /** Numeric weight 0–1 — useful for downstream provider knobs. */
  score: number;
}

/**
 * Heuristic weighting based on length and richness of the user's style text.
 * Empty → absent; very short → supporting; medium → guiding; rich → primary.
 */
export function weighStyle(style?: string): StyleWeight {
  const trimmed = (style ?? "").trim();
  if (!trimmed) {
    return { emphasis: "absent", label: "no direction provided", score: 0 };
  }

  const wordCount = trimmed.split(/\s+/).length;

  if (wordCount >= 18) {
    return { emphasis: "primary", label: "highest priority — honour exactly", score: 1 };
  }
  if (wordCount >= 8) {
    return { emphasis: "guiding", label: "primary direction", score: 0.8 };
  }
  return { emphasis: "supporting", label: "supporting cue", score: 0.55 };
}
