/**
 * AfroMuse Prompt OS — Main Compiler
 *
 * Single entry point for the OS. Takes a raw input, scores its style
 * dominance, builds the priority order, assembles the context, and
 * renders the final prompt block by block.
 *
 * Returns the compiled prompt plus the OS metadata (styleLock + priority)
 * so callers can log or react to how the OS prioritised the request.
 */

import { assembleContext } from "./contextAssembler";
import { buildPriority } from "./priorityEngine";
import { calculateStyleDominance } from "./styleDominance";
import { renderBlock } from "./outputCompiler";
import type { PromptPacket, PromptPacketInput, CompiledPrompt } from "./types";

export function compilePrompt(input: PromptPacketInput): CompiledPrompt {
  const styleLock = calculateStyleDominance(input.style);

  const packet: PromptPacket = {
    ...input,
    styleLock,
    priority: [],
  };

  const priority = buildPriority(packet);
  packet.priority = priority;

  const ctx = assembleContext(packet);

  const blocks = priority
    .map((p) => renderBlock(p, ctx))
    .filter((s) => s && s.trim().length > 0);

  return {
    prompt: blocks.join("\n\n"),
    meta: { styleLock, priority },
  };
}

export type { PromptPacket, PromptPacketInput, CompiledPrompt, Mode } from "./types";
