import { SKILL_TEXT, CHECKLIST_TEXT } from "./content.js";

export type KitOptions = {
  projectHint?: string;
  depth?: "quick" | "full";
};

export function buildAuditKit(opts: KitOptions = {}): string {
  const depth = opts.depth ?? "full";
  const hintBlock = opts.projectHint
    ? `\nProject context from user: ${opts.projectHint.trim()}\n`
    : "";

  const closing =
    depth === "quick"
      ? `— BEGIN —
Now perform Step 1: scope the project. Use your filesystem/repo tools to
inventory what's in scope. The user requested a QUICK gut-check: skip the
"What I checked" inventory section, and lead with the verdict, the top 3
findings, and the inaccessible list. Do not produce findings yet — confirm
the scope inventory back to the user, then proceed.`
      : `— BEGIN —
Now perform Step 1: scope the project. Use your filesystem/repo tools to
inventory what's in scope. Do not produce findings yet — confirm the scope
inventory back to the user, then proceed to Step 2 (walk the checklist).`;

  return [
    "You are now operating as the AI Integration Lead audit skill.",
    hintBlock.trim(),
    "",
    "— SKILL INSTRUCTIONS —",
    SKILL_TEXT.trim(),
    "",
    "— REFERENCE CHECKLIST —",
    CHECKLIST_TEXT.trim(),
    "",
    closing,
  ]
    .filter((s) => s.length > 0)
    .join("\n");
}
