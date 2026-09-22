// Domain acronyms that must stay fully uppercase regardless of position --
// "dg" -> "DG" (diesel generator), not "Dg". Extend as new enum values need it.
const ACRONYMS = new Set(["dg", "ups", "amc", "cam", "gstin", "pan"]);

// Turns a raw snake_case/lowercase enum value into a Sentence case label for
// dropdown options app-wide, e.g. "past_due" -> "Past due", "platform_admin"
// -> "Platform admin". Not for proper nouns (office/vendor names, emails,
// currency/timezone codes) -- those are real data, not fixed vocabulary.
export function sentenceCase(value: string): string {
  const words = value.split("_").filter(Boolean);
  return words
    .map((word, i) => {
      if (ACRONYMS.has(word.toLowerCase())) return word.toUpperCase();
      const lower = word.toLowerCase();
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(" ");
}
