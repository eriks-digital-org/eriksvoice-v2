/** Speech models that speak Hebrew (Flash and Turbo v2.5 do not). */
export const HEBREW_TTS_MODELS = [
  { id: "eleven_v4_turbo", label: "v4 Turbo (מומלץ)" },
  { id: "eleven_v4", label: "v4" },
  { id: "eleven_multilingual_v2", label: "Multilingual v2" },
  { id: "eleven_v3_conversational", label: "v3 שיחתי (אקספרסיבי)" },
];

export interface AllowedVoice {
  id: string;
  name: string;
}
