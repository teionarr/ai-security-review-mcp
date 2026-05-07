import { CHECKLIST_TEXT } from "./content.js";

type Section = {
  id: string;
  title: string;
  level: 2 | 3;
  body: string;
};

const sections = parseSections(CHECKLIST_TEXT);

function parseSections(md: string): Section[] {
  const out: Section[] = [];
  const lines = md.split("\n");

  type Open = { id: string; title: string; level: 2 | 3; start: number };
  let open: Open | null = null;

  const flush = (endLineExclusive: number) => {
    if (!open) return;
    const body = lines.slice(open.start, endLineExclusive).join("\n").trimEnd();
    out.push({ id: open.id, title: open.title, level: open.level, body });
    open = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const m2 = /^## ([\d]+)\.\s+(.+)$/.exec(line);
    const m3 = /^### ([\d]+\.[\d]+)\s+(.+)$/.exec(line);
    if (m2) {
      flush(i);
      open = { id: m2[1]!, title: m2[2]!.trim(), level: 2, start: i };
    } else if (m3) {
      flush(i);
      open = { id: m3[1]!, title: m3[2]!.trim(), level: 3, start: i };
    }
  }
  flush(lines.length);
  return out;
}

export function listSections(): { id: string; title: string; level: 2 | 3 }[] {
  return sections.map(({ id, title, level }) => ({ id, title, level }));
}

export function getSection(id: string): string | null {
  const trimmed = id.trim();
  const exact = sections.find((s) => s.id === trimmed);
  if (!exact) return null;

  if (exact.level === 3) {
    return exact.body;
  }

  // Level-2 (domain) request: include the domain heading + every level-3
  // child whose id starts with `${domainId}.`
  const children = sections.filter(
    (s) => s.level === 3 && s.id.startsWith(trimmed + ".")
  );
  return [exact.body, ...children.map((c) => c.body)].join("\n\n");
}

export function knownSectionIds(): string[] {
  return sections.map((s) => s.id);
}
