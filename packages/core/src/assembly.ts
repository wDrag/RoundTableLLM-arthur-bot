import type { MergeResult, MergeUnit, ScoredOutput } from "@/types.js";

const HIGH_RISK_PATTERNS = [
  /\bexploit\b/i,
  /\bbypass\b/i,
  /\bmalware\b/i,
  /\bphishing\b/i,
  /\bcredential theft\b/i
];

const normalizeKey = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(" ");

const extractUnits = (content: string, role: string): MergeUnit[] => {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletLines = lines.filter((line) => /^(-|\*|\d+\.)\s+/.test(line));
  const source = bulletLines.length > 0 ? bulletLines : [content.trim()];

  return source
    .map((text, index) => ({
      id: `${role.toUpperCase()}-${index + 1}`,
      sourceRole: role as MergeUnit["sourceRole"],
      text: text.replace(/^(-|\*|\d+\.)\s+/, "")
    }))
    .filter((unit) => unit.text.length > 0);
};

const findHighRiskReason = (text: string): string | null => {
  const match = HIGH_RISK_PATTERNS.find((pattern) => pattern.test(text));
  return match ? `Matched pattern ${match.toString()}` : null;
};

export const assembleOutputs = (scored: ScoredOutput[]): MergeResult => {
  const valid = scored
    .filter((item) => item.status === "VALID")
    .sort((a, b) => b.weightedScore - a.weightedScore);

  const base = valid[0];
  if (!base) {
    return { merged: [], disagreements: [], quarantined: [] };
  }

  const merged: MergeUnit[] = [];
  const disagreements: MergeUnit[] = [];
  const quarantined: MergeUnit[] = [];
  const keyMap = new Map<string, MergeUnit>();

  const addUnit = (unit: MergeUnit): void => {
    const key = normalizeKey(unit.text);
    const existing = keyMap.get(key);
    if (!existing) {
      keyMap.set(key, unit);
      merged.push(unit);
      return;
    }
    if (existing.text !== unit.text) {
      disagreements.push(unit);
    }
  };

  const baseUnits = extractUnits(base.content, base.role).map((unit) => ({
    ...unit,
    text: `${unit.text} [${base.role.toUpperCase()}]`
  }));
  baseUnits.forEach((unit) => addUnit(unit));

  valid.slice(1).forEach((item) => {
    const units = extractUnits(item.content, item.role);
    units.forEach((unit) => {
      const tagged = { ...unit, text: `${unit.text} [${item.role.toUpperCase()}]` };
      const reason = findHighRiskReason(tagged.text);
      if (reason) {
        quarantined.push({ ...tagged, reason });
        return;
      }
      addUnit(tagged);
    });
  });

  return { merged, disagreements, quarantined };
};
