import "server-only";
import { isVoiceConfigured, listHebrewLibraryVoices, listLlms, listVoices, type Voice } from "./elevenlabs";

export interface Catalog {
  connected: boolean;
  voices: Voice[];
  llms: string[];
  error?: string;
}

/** Drops the cached catalog (after a library voice was added to the account). */
export const resetCatalog = () => {
  cached = null;
};

let cached: { at: number; value: Catalog } | null = null;
const TTL = 5 * 60_000;

/** Voices and models from the provider, for the admin's pickers. Empty when not connected. */
export async function loadCatalog(): Promise<Catalog> {
  if (!(await isVoiceConfigured())) return { connected: false, voices: [], llms: [] };
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  try {
    const [account, library, llms] = await Promise.all([
      listVoices(),
      listHebrewLibraryVoices().catch(() => [] as Voice[]),
      listLlms(),
    ]);
    // Hebrew only: the account's Hebrew voices first, then library voices not in the account yet.
    const have = new Set(account.map((v) => v.id));
    const voices = [...account.filter((v) => v.hebrew), ...library.filter((v) => !have.has(v.id))];
    cached = { at: Date.now(), value: { connected: true, voices, llms } };
    return cached.value;
  } catch (e) {
    return { connected: true, voices: [], llms: [], error: e instanceof Error ? e.message : "טעינה נכשלה" };
  }
}
