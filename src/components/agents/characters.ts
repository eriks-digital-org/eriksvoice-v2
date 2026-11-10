const leadsSmile = "/agents/leads-smile.webp";
const leadsFront = "/agents/leads-front.webp";
const salesSmile = "/agents/sales-smile.webp";
const salesFront = "/agents/sales-front.webp";
const serviceSmile = "/agents/service-smile.webp";
const serviceFront = "/agents/service-front.webp";
const supportSmile = "/agents/support-smile.webp";
const supportFront = "/agents/support-front.webp";

/**
 * The four EriksVoice characters. Presentation only: which picture an agent wears is picked
 * from the words in its role/type, so nothing about the agent itself changes.
 */
export type CharacterKey = "leads" | "sales" | "service" | "support";

export interface Character {
  key: CharacterKey;
  smile: string;
  front: string;
  /** Soft glow behind a round avatar. */
  glow: string;
  /** Pastel wash behind a large portrait. */
  wash: string;
}

export const characters: Record<CharacterKey, Character> = {
  leads: {
    key: "leads",
    smile: leadsSmile,
    front: leadsFront,
    glow: "radial-gradient(circle at 50% 60%, #d9f66b88, #43e0d133 60%, transparent 72%)",
    wash: "linear-gradient(150deg, #effbc9, #d6f7f2)",
  },
  sales: {
    key: "sales",
    smile: salesSmile,
    front: salesFront,
    glow: "radial-gradient(circle at 50% 60%, #cdf27c88, #3fd8d633 60%, transparent 72%)",
    wash: "linear-gradient(150deg, #ecfacd, #d4f5f4)",
  },
  service: {
    key: "service",
    smile: serviceSmile,
    front: serviceFront,
    glow: "radial-gradient(circle at 50% 60%, #ffd56e88, #ff94c633 60%, transparent 72%)",
    wash: "linear-gradient(150deg, #fff2cc, #ffe1ef)",
  },
  support: {
    key: "support",
    smile: supportSmile,
    front: supportFront,
    glow: "radial-gradient(circle at 50% 60%, #d9a3f788, #6ea8ff33 60%, transparent 72%)",
    wash: "linear-gradient(150deg, #f3e2fc, #dde9ff)",
  },
};

const order: CharacterKey[] = ["leads", "sales", "service", "support"];

// Checked in this order, so "שירות לקוחות" lands on service and "תמיכה טכנית" on support.
const keywords: [CharacterKey, string[]][] = [
  ["leads", ["ליד", "lead", "יוצא", "outbound"]],
  ["support", ["תמיכ", "support", "בעי", "טכני", "תקל"]],
  ["sales", ["מכיר", "sales", "פגיש", "תיאום", "תאום", "meeting", "קביעת"]],
  ["service", ["שירות", "service", "קבלה", "מענה", "עונה", "טלפון", "מזכיר", "reception", "נכנס"]],
];

function byWords(text: string | null | undefined): CharacterKey | null {
  if (!text) return null;
  const t = text.toLowerCase();
  for (const [key, words] of keywords) if (words.some((w) => t.includes(w))) return key;
  return null;
}

function byHash(id: string): CharacterKey {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return order[Math.abs(h) % order.length] ?? "service";
}

export function characterFor(a: {
  id: string;
  type?: string | undefined;
  roleId?: string | null | undefined;
}): Character {
  const key = byWords(a.type) ?? byWords(a.roleId) ?? byHash(a.id);
  return characters[key];
}

/** The character of an agent type; a custom agent gets one by its id. */
export function characterForType(typeKey: string, id: string): Character {
  if (typeKey in characters) return characters[typeKey as CharacterKey];
  return characters[byHash(id)];
}
