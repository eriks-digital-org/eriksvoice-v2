/** Normalizes a phone number to E.164. Israeli local numbers (05x…, 0x…) become +972…. */
export function toE164(raw: string): string | null {
  const s = raw.trim().replace(/[\s\-().]/g, "");
  let out: string;
  if (/^\+\d+$/.test(s)) out = s;
  else if (/^00\d+$/.test(s)) out = `+${s.slice(2)}`;
  else if (/^972\d{8,9}$/.test(s)) out = `+${s}`;
  else if (/^0\d{8,9}$/.test(s)) out = `+972${s.slice(1)}`;
  else if (/^5\d{8}$/.test(s)) out = `+972${s}`;
  else return null;
  return /^\+[1-9]\d{6,14}$/.test(out) ? out : null;
}
