import 'server-only';
import { Type } from '@google/genai';
import { getGeminiClient } from '@/lib/gemini/rafa';

export interface PhotoCheck {
  hasAnimal: boolean;
  /** A photo of a screen, a printout or a screenshot instead of a live scene */
  isScreen: boolean;
  graphic: boolean;
  note: string;
}

const PROMPT = `You check photos sent to KupKop, a street animal emergency app in the Philippines.
The photo should be a live phone camera picture of an injured, sick or trapped dog or cat outdoors.
Answer only about what is visible:
- has_animal: is a dog or cat (or clearly part of one) visible?
- is_screen: is this a photo of a screen, a printed picture, or a screenshot rather than a real scene?
- graphic: does it show heavy blood, open wounds or other gore that should stay blurred until tapped?
- note: one short sentence describing the photo, no guesses about diagnosis.`;

/** Asks Gemini about a report photo. Null when Gemini is not configured or the photo can't be read. */
export async function checkReportPhoto(photoUrl: string): Promise<PhotoCheck | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  const res = await fetch(photoUrl);
  if (!res.ok) return null;
  const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/webp';
  if (!mimeType.startsWith('image/')) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > 4 * 1024 * 1024) return null;

  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: PROMPT }, { inlineData: { mimeType, data: bytes.toString('base64') } }] }],
    config: {
      temperature: 0,
      maxOutputTokens: 200,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          has_animal: { type: Type.BOOLEAN },
          is_screen: { type: Type.BOOLEAN },
          graphic: { type: Type.BOOLEAN },
          note: { type: Type.STRING },
        },
        required: ['has_animal', 'is_screen', 'graphic', 'note'],
      },
    },
  });

  try {
    const parsed = JSON.parse(result.text || '{}');
    if (typeof parsed.has_animal !== 'boolean') return null;
    return {
      hasAnimal: parsed.has_animal,
      isScreen: Boolean(parsed.is_screen),
      graphic: Boolean(parsed.graphic),
      note: String(parsed.note || '').slice(0, 200),
    };
  } catch {
    return null;
  }
}
