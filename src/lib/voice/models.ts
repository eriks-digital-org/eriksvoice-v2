/** Speech models that speak Hebrew (Flash and Turbo v2.5 do not). */
export const HEBREW_TTS_MODELS = [
  { id: "eleven_v4_turbo", label: "v4 Turbo (מומלץ)" },
  { id: "eleven_v4", label: "v4" },
  { id: "eleven_multilingual_v2", label: "Multilingual v2" },
  { id: "eleven_v3_conversational", label: "v3 שיחתי (אקספרסיבי)" },
];

/** Eleven Realtime: one model for hearing, thinking and speaking. '' = the custom pipeline. */
export const REALTIME_MODELS = [
  { id: "eleven_realtime_v1_mini", label: "Realtime Mini (הכי מהיר וזול)" },
  { id: "eleven_realtime_v1_max", label: "Realtime Max (חושב לפני שעונה)" },
] as const;
export type RealtimeModel = (typeof REALTIME_MODELS)[number]["id"];
export const isRealtimeModel = (v: string): v is RealtimeModel => REALTIME_MODELS.some((m) => m.id === v);

export interface AllowedVoice {
  id: string;
  name: string;
}
