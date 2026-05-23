/**
 * AfroMuse Prompt OS — Style Dominance Engine
 *
 * Translates the user's free-form `style` text into a numeric strength
 * score (0–1) the OS uses to decide whether the style block should lead
 * the prompt and how much weight downstream providers should give it.
 */

export function calculateStyleDominance(style?: string): number {
  if (!style) return 0.2;

  const length = style.trim().length;

  if (length > 120) return 1.0; // full creative direction
  if (length > 60)  return 0.7; // strong direction
  if (length > 20)  return 0.5; // moderate
  return 0.3;                   // weak cue
}
