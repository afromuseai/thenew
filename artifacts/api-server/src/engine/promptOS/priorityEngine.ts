/**
 * AfroMuse Prompt OS — Priority Engine
 *
 * Produces the ordered list of blocks the compiler will emit. When the
 * user's style direction is strong enough (styleLock > 0.5) it leads the
 * prompt; otherwise the mode block leads and style is still emitted but
 * only after the music context.
 */

import type { PromptPacket } from "./types";

export function buildPriority(packet: PromptPacket): string[] {
  const priority: string[] = [];

  // 1. Style ALWAYS first if strong enough
  if ((packet.styleLock ?? 0) > 0.5) {
    priority.push("STYLE");
  }

  // 2. Mode defines structure behaviour
  priority.push("MODE");

  // 3. Identity layer always before context
  priority.push("TITLE");

  // 4. Core musical parameters
  priority.push("GENRE", "MOOD", "BPM", "KEY");

  // 5. If style was not promoted, still emit it after the context block
  if ((packet.styleLock ?? 0) <= 0.5) {
    priority.push("STYLE");
  }

  // 6. DNA last (influences but does not dominate)
  priority.push("BEAT_DNA", "ARTIST_DNA");

  return priority;
}
