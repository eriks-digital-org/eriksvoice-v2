/**
 * The prompt an agent gets, built from layers in a fixed order. Empty layers are
 * left out, and nothing is added that the admin or the client did not write:
 *  1. system and safety rules (admin, shared by everyone)
 *  2. the agent type's template (admin)
 *  3. the business details from onboarding (admin)
 *  3b. the agent's identity: the name and voice gender chosen for this agent, so a
 *      shared template never makes it introduce itself by another name or gender
 *  4. the custom agent's own instructions (admin)
 *  5. instructions from the client's active automations (later)
 * The business knowledge is not in the prompt: it is the provider's knowledge base,
 * searched during the call.
 */
export interface PromptInput {
  safetyRules: string;
  typePrompt: string;
  business: {
    name: string;
    industry: string;
    address: string;
    hours: string;
    phone: string;
  };
  customPrompt: string;
  automationInstructions: string[];
  /** The agent's own name, and the gender of its voice when known. */
  identity?: { name: string; gender?: "female" | "male" | "" };
}

function identityBlock(i: PromptInput["identity"]): string {
  if (!i?.name.trim()) return "";
  const lines = [`קוראים לך ${i.name.trim()}.`];
  if (i.gender === "male") lines.push("אתה מדבר על עצמך בלשון זכר.");
  if (i.gender === "female") lines.push("את מדברת על עצמך בלשון נקבה.");
  lines.push("אם מופיע למעלה שם או מגדר אחר שלך, מה שכתוב כאן קובע.");
  return `# הזהות שלך\n${lines.join(" ")}`;
}

export function buildPrompt(p: PromptInput): string {
  const b = p.business;
  const details = [
    ["שם העסק", b.name],
    ["תחום", b.industry],
    ["כתובת", b.address],
    ["שעות פעילות", b.hours],
    ["טלפון", b.phone],
  ]
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k}: ${v.trim()}`)
    .join("\n");

  return [
    p.safetyRules.trim(),
    p.typePrompt.trim(),
    details && `# פרטי העסק\n${details}`,
    identityBlock(p.identity),
    p.customPrompt.trim(),
    p.automationInstructions.filter((s) => s.trim()).join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** A shared template must not name a business; returns the name it found, if any. */
export function namedBusiness(text: string, names: string[]): string | null {
  return names.find((n) => n.trim().length > 2 && text.includes(n.trim())) ?? null;
}
