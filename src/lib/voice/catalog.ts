import "server-only";
import { isVoiceConfigured, listLlms, listVoices, type Voice } from "./elevenlabs";

export interface Catalog {
  connected: boolean;
  voices: Voice[];
  llms: string[];
  error?: string;
}

let cached: { at: number; value: Catalog } | null = null;
const TTL = 5 * 60_000;

/** Voices and models from the provider, for the admin's pickers. Empty when not connected. */
export async function loadCatalog(): Promise<Catalog> {
  if (!isVoiceConfigured()) return { connected: false, voices: [], llms: [] };
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  try {
    const [voices, llms] = await Promise.all([listVoices(), listLlms()]);
    cached = { at: Date.now(), value: { connected: true, voices, llms } };
    return cached.value;
  } catch (e) {
    return { connected: true, voices: [], llms: [], error: e instanceof Error ? e.message : "טעינה נכשלה" };
  }
}
