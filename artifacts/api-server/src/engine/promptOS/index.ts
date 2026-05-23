import { PromptInput } from "../promptBrain/types";
import { resolvePromptMode } from "./router";
import { buildContext } from "./contextBuilder";
import { buildPrompt } from "../promptBrain/buildPrompt";

export function generatePrompt(input: PromptInput) {
  const mode = resolvePromptMode(input);
  const context = buildContext(input);

  return buildPrompt({
    ...input,
    promptMode: mode,
    context, // future-proof (not required but useful)
  });
}