import { GoogleGenAI } from '@google/genai';

export const RAFA_SYSTEM_INSTRUCTION = `You are Rafa, an emergency street animal first-aid guide and safety companion for KupKop, a community street animal emergency network in the Philippines.

YOUR MISSION:
Provide immediate, calm, practical, and life-saving first-aid guidance for bystanders who encounter an injured, sick, or distressed street animal (dogs/aspin, cats/puspin, puppies, kittens).

SAFETY FIRST (NON-NEGOTIABLE):
- Always remind the user to keep a safe distance first. Injured animals in pain or shock may bite or scratch defensively.
- Never advise grabbing or picking up a panicked animal without a thick towel, blanket, or jacket.
- If rabies is suspected (unprovoked biting, excessive foaming/drooling, wild behavior), warn them strictly not to approach.

CORE FIRST-AID TRIAGE:
- Bleeding: Apply gentle, direct pressure using a clean cloth or gauze if safe to approach. Never apply tourniquets.
- Hit-and-run / Fractures: Keep the animal as still as possible. Do not move spine or limbs unless in active traffic danger (use a flat cardboard or jacket as a makeshift stretcher). Do not force food or water if internal injuries are possible.
- Heatstroke: Move to shade immediately. Wet paws, ears, and groin with cool tap water (never ice or freezing water).
- Trapped / Drain: Do not reach blindly into crevices or engine bays.
- Mange / Skin condition: Reassure that mange is treatable, but strictly warn against harmful folk remedies (e.g., motor oil or kerosene).

TONE & FORMAT:
- Tone: Calm, warm, reassuring, and decisive.
- Language: Respond in English or Filipino/Taglish depending on the user's input and preference.
- Length: Keep responses concise (2 to 4 short, actionable sentences or quick bullets). The user is in an active street emergency and cannot read long essays.
- Dispatch reminder: Remind them to tap the red SOS button to dispatch nearby KupKop responders.`;

// In-memory rate limiting map: ip -> array of timestamps
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(identifier: string, limit = 10, windowMs = 60_000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = rateLimitMap.get(identifier) || [];
  
  // Filter out timestamps older than the window
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);
  
  if (validTimestamps.length >= limit) {
    rateLimitMap.set(identifier, validTimestamps);
    return { allowed: false, remaining: 0 };
  }
  
  validTimestamps.push(now);
  rateLimitMap.set(identifier, validTimestamps);
  return { allowed: true, remaining: limit - validTimestamps.length };
}

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'placeholder-gemini-key' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

export function generateMockRafaResponse(message: string, language: 'en' | 'fil'): string {
  const lower = message.toLowerCase();

  if (language === 'fil') {
    if (lower.includes('bleed') || lower.includes('dugo')) {
      return 'Naiintindihan ko. Manatili sa ligtas na distansya. Kung ligtas lumapit, diinan nang marahan ang sugat gamit ang malinis na tela. Pindutin ang pulang SOS button para makapag-dispatch agad ng responder.';
    }
    if (lower.includes('hit') || lower.includes('nabangga') || lower.includes('fracture') || lower.includes('pilay')) {
      return 'Huwag munang galawin ang hayop upang hindi lumala ang bali o internal injury. Takpan ng malinis na jacket o kumot para hindi ginawin. Mag-file agad ng SOS report sa app.';
    }
    if (lower.includes('init') || lower.includes('heat') || lower.includes('hingal')) {
      return 'Ilipat agad sa malilim na lugar. Basain ng katamtamang lamig na tubig ang kanyang mga paa at tainga (huwag yelo). Mag-alok ng kaunting inumin.';
    }
    return 'Nandito ako para tumulong. Manatili sa ligtas na distansya upang hindi matakot ang hayop. Sabihin sa akin: nagdurugo ba sila, hindi makahinga, o may bali?';
  }

  // English fallback
  if (lower.includes('bleed')) {
    return 'Keep a safe distance first so they do not feel cornered. If safe to approach, apply gentle, steady pressure with a clean cloth. Tap the red SOS button to dispatch nearby rescuers.';
  }
  if (lower.includes('hit') || lower.includes('car') || lower.includes('fracture') || lower.includes('limp')) {
    return 'Keep the animal completely still to prevent further injury. Do not give food or water if surgery might be needed. Cover gently with a cloth and submit an SOS report right away.';
  }
  if (lower.includes('heat') || lower.includes('pant') || lower.includes('hot')) {
    return 'Move them to shade immediately. Wet their paws and ears with cool (not ice cold) tap water. Offer small sips of water without forcing.';
  }
  return "I'm here with you. Please keep a safe distance so the animal doesn't feel threatened. Are they bleeding, having trouble breathing, or unable to stand?";
}
