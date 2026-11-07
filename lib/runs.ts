import { z } from "zod";

const Step = z.object({
  call: z.string(),
  input: z.record(z.string(), z.unknown()),
  result: z.string().optional(),
});

export const Run = z.object({
  run: z.string(),
  steps: z.array(Step),
  answer: z.string().nullable(),
});

export type Run = z.infer<typeof Run>;

export type Step = z.infer<typeof Step>;

/** One-line summary of a tool call, e.g. `search_by_kql("error_severity: NOTICE")`. */
export function describeCall(step: Step): string {
  const args = Object.values(step.input).map((value) => JSON.stringify(value));

  return `${step.call}(${args.join(", ")})`;
}

/** Shortens a tool result to its first line, capped at `max` characters. */
export function shortResult(result: string | undefined, max = 140): string {
  if (result === undefined) {
    return "(no result)";
  }

  const firstLine = result.split("\n", 1)[0] ?? "";

  return firstLine.length > max ? `${firstLine.slice(0, max - 1)}…` : firstLine;
}

/** Whether a tool result reports a failure (a tool error or the server's `Error` key). */
export function isFailure(result: string | undefined): boolean {
  if (result === undefined) {
    return true;
  }

  return result.startsWith("Error calling tool") || result.startsWith('{"Error"');
}
