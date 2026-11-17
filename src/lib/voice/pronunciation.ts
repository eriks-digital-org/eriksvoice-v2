import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import * as voice from "./elevenlabs";

type Db = ReturnType<typeof createAdminClient>;

export interface PronunciationRow {
  id?: string;
  term: string;
  say: string;
  note: string;
  category: string;
  enabled: boolean;
}

const hasLatin = (s: string) => /[A-Za-z]/.test(s);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The provider matches case-sensitively and uses the first rule that matches, so each Latin
 * term also gets its common case forms ("lead", "Lead"; acronyms stay as written), and a
 * form already taken by an earlier row is skipped.
 */
export function toProviderRules(rows: PronunciationRow[]) {
  const seen = new Set<string>();
  const rules: { string_to_replace: string; alias: string }[] = [];
  for (const r of rows) {
    if (!r.enabled) continue;
    const term = r.term.trim();
    const say = r.say.trim();
    if (!term || !say) continue;
    const forms = hasLatin(term) && term !== term.toUpperCase() ? [term, term.toLowerCase(), capitalize(term.toLowerCase())] : [term];
    for (const f of forms) {
      if (seen.has(f)) continue;
      seen.add(f);
      rules.push({ string_to_replace: f, alias: say });
    }
  }
  // Longer phrases first, so "landing page" wins over a rule for one of its words.
  return rules.sort((a, b) => b.string_to_replace.length - a.string_to_replace.length);
}

/**
 * One dictionary at the provider: the shared one (clientId null) or a business's own words.
 * Sent again only when its rules changed since the last time. Returns null when the list is
 * empty. On a provider failure the last dictionary that was sent stays in use.
 */
async function ensureDictionary(db: Db, clientId: string | null): Promise<voice.PronunciationLocator | null> {
  const holder = clientId ? db.from("clients") : db.from("system_settings");
  let rulesQ = db.from("pronunciation_rules").select("term, say, note, category, enabled").order("position");
  rulesQ = clientId ? rulesQ.eq("client_id", clientId) : rulesQ.is("client_id", null);
  const [{ data: rows }, { data: settings }] = await Promise.all([
    rulesQ,
    (clientId ? db.from("clients").select("pronunciation_dict_id, pronunciation_dict_version, pronunciation_dict_hash").eq("id", clientId) : db.from("system_settings").select("pronunciation_dict_id, pronunciation_dict_version, pronunciation_dict_hash").eq("id", true)).single(),
  ]);
  const rules = toProviderRules((rows ?? []) as PronunciationRow[]);
  const current =
    settings?.pronunciation_dict_id && settings.pronunciation_dict_version
      ? { pronunciation_dictionary_id: settings.pronunciation_dict_id as string, version_id: settings.pronunciation_dict_version as string }
      : null;
  if (rules.length === 0) return null;
  const hash = createHash("sha256").update(JSON.stringify(rules)).digest("hex");
  if (current && settings?.pronunciation_dict_hash === hash) return current;
  try {
    const label = clientId ? `EriksVoice client ${clientId.slice(0, 8)}` : "EriksVoice";
    const created = await voice.createPronunciationDictionary(`${label} ${new Date().toISOString().slice(0, 16)}`, rules);
    const patch = {
      pronunciation_dict_id: created.pronunciation_dictionary_id,
      pronunciation_dict_version: created.version_id,
      pronunciation_dict_hash: hash,
    };
    await (clientId ? holder.update(patch).eq("id", clientId) : holder.update(patch).eq("id", true));
    if (current) await voice.archivePronunciationDictionary(current.pronunciation_dictionary_id);
    return created;
  } catch (e) {
    console.error("pronunciation: dictionary not sent", clientId ?? "shared", (e as Error).message);
    return current;
  }
}

/** The shared dictionary for every agent. */
export function ensurePronunciationDictionary(db: Db): Promise<voice.PronunciationLocator | null> {
  return ensureDictionary(db, null);
}

/** The dictionaries of one business's agents: its own words first (they win), then the shared list. */
export async function pronunciationFor(db: Db, clientId: string): Promise<voice.PronunciationLocator[]> {
  const [own, shared] = await Promise.all([ensureDictionary(db, clientId), ensureDictionary(db, null)]);
  return [own, shared].filter((x): x is voice.PronunciationLocator => Boolean(x));
}
