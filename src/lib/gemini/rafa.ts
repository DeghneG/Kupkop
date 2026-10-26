import { GoogleGenAI } from '@google/genai';

export const RAFA_SYSTEM_INSTRUCTION = `You are Rafa, an emergency street animal first-aid guide and safety companion for KupKop, a community street animal emergency network in the Philippines.

YOUR MISSION:
Provide immediate, calm, practical, and life-saving first-aid guidance for bystanders who encounter an injured, sick, or distressed street animal (dogs/aspin, cats/puspin, puppies, kittens).

STRICT SCOPE & OFF-TOPIC REFUSAL (NON-NEGOTIABLE):
- You ONLY answer questions regarding street animal first-aid, animal emergency stabilization, animal safety, and the KupKop emergency network.
- If the user asks about ANYTHING outside this scope (e.g. who created this app, coding, homework, general chat, weather, politics, recipes, jokes, or non-animal subjects):
  You MUST politely decline to answer:
  - English: "I'm sorry, but Rafa cannot answer questions outside of street animal emergencies and first-aid guidance. If an animal is injured or in distress, please let me know what happened so I can help."
  - Filipino/Taglish: "Pasensya na, ngunit hindi sumasagot si Rafa sa mga tanong sa labas ng emergency at first-aid para sa mga hayop. Kung may hayop na nangangailangan ng tulong, sabihin lamang sa akin."
- NEVER answer off-topic questions under any circumstances.

SAFETY FIRST:
- Always remind the user to keep a safe distance first. Injured animals in pain or shock may bite or scratch defensively.
- Never advise grabbing or picking up a panicked animal without a thick towel, blanket, or jacket.
- If rabies is suspected (unprovoked biting, excessive foaming/drooling, wild behavior), warn them strictly not to approach.

CORE FIRST-AID TRIAGE:
- Bleeding: Apply gentle, direct pressure using a clean cloth or gauze if safe to approach. Never apply tourniquets.
- Hit-and-run / Fractures: Keep the animal as still as possible. Do not move spine or limbs unless in active traffic danger (use a flat cardboard or jacket as a makeshift stretcher). Do not force food or water if internal injuries are possible.
- Heatstroke: Move to shade immediately. Wet paws, ears, and groin with cool tap water (never ice or freezing water).
- Trapped / Drain: Do not reach blindly into crevices or engine bays.
- Mange / Skin condition: Reassure that mange is treatable, but strictly warn against harmful folk remedies (e.g., motor oil or kerosene).
- Human medicines: Strictly warn that paracetamol, ibuprofen, and aspirin are toxic and fatal to dogs and cats.

TONE & FORMAT:
- Tone: Calm, warm, reassuring, and decisive.
- Language: Respond in English or Filipino/Taglish depending on the user's input and preference.
- Length: Keep responses concise (2 to 4 short, actionable sentences or quick bullets).
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

const ANIMAL_EMERGENCY_KEYWORDS = [
  'dog', 'cat', 'aspin', 'puspin', 'puppy', 'kitten', 'animal', 'pet', 'paw', 'tail', 'fur',
  'aso', 'pusa', 'tuta', 'kuting', 'hayop',
  'bleed', 'blood', 'dugo', 'nagdurugo',
  'hit', 'ran', 'run', 'car', 'vehicle', 'motor', 'bangga', 'nabangga', 'sagasa', 'nasagasa',
  'fracture', 'broken', 'bone', 'limp', 'limping', 'bali', 'pilay', 'napilay',
  'wound', 'cut', 'injury', 'injured', 'hurt', 'sugat', 'nasugatan',
  'bite', 'bitten', 'kagat', 'nakagat', 'rabies', 'laway',
  'mange', 'skin', 'scab', 'galis', 'kurikong',
  'heat', 'hot', 'pant', 'panting', 'heatstroke', 'init', 'naarawan', 'hingal',
  'poison', 'poisoned', 'toxic', 'lason', 'nalason', 'vomit', 'suka', 'nagsusuka',
  'trapped', 'stuck', 'drain', 'canal', 'sewer', 'naipit', 'nakaipit', 'kanal',
  'breathe', 'breathing', 'choking', 'hininga', 'hirap',
  'sick', 'weak', 'dying', 'lethargic', 'masakit', 'nanghihina',
  'emergency', 'sos', 'help', 'rescue', 'saklolo', 'tulong', 'first aid',
  'medicine', 'paracetamol', 'biogesic', 'ibuprofen', 'aspirin', 'gamot', 'vet', 'clinic', 'doktor',
];

const GREETING_KEYWORDS = [
  'hi', 'hello', 'hey', 'kamusta', 'kumusta', 'good morning', 'good afternoon', 'good evening',
  'who are you', 'sino ka', 'introduce', 'what is rafa',
];

export function generateMockRafaResponse(message: string, language: 'en' | 'fil'): string {
  const clean = message.toLowerCase().trim();

  // 1. Check for basic greetings or "who are you"
  const isGreeting = GREETING_KEYWORDS.some((k) => clean === k || clean.startsWith(k + ' ') || clean.endsWith(' ' + k));
  if (isGreeting && !ANIMAL_EMERGENCY_KEYWORDS.some((k) => clean.includes(k))) {
    if (language === 'fil') {
      return 'Kumusta! Ako si Rafa, ang emergency first-aid guide ng KupKop para sa mga hayop sa kalsada. May nasaktan o nangangailangan ba ng saklolo na aso o pusa malapit sa iyo ngayon?';
    }
    return "Hello! I'm Rafa, KupKop's emergency animal first-aid guide. Is there an injured or distressed street animal near you that needs help right now?";
  }

  // 2. Check if the message contains ANY animal emergency or triage keywords
  const isRelated = ANIMAL_EMERGENCY_KEYWORDS.some((kw) => clean.includes(kw));

  // If outside scope, strictly decline
  if (!isRelated) {
    if (language === 'fil') {
      return 'Pasensya na, ngunit hindi sumasagot si Rafa sa mga tanong sa labas ng emergency at first-aid para sa mga hayop. Kung may hayop na nangangailangan ng tulong, sabihin lamang sa akin.';
    }
    return "I'm sorry, but Rafa cannot answer questions outside of street animal emergencies and first-aid guidance. If an animal is injured or in distress, please let me know what happened so I can help.";
  }

  // 3. In-scope emergency guidance (Filipino)
  if (language === 'fil') {
    if (clean.includes('bleed') || clean.includes('dugo')) {
      return 'Naiintindihan ko. Manatili sa ligtas na distansya. Kung ligtas lumapit, diinan nang marahan ang sugat gamit ang malinis na tela. Pindutin ang pulang SOS button para makapag-dispatch agad ng responder.';
    }
    if (clean.includes('hit') || clean.includes('bangga') || clean.includes('fracture') || clean.includes('bali') || clean.includes('pilay')) {
      return 'Huwag munang galawin ang hayop upang hindi lumala ang bali o internal injury. Takpan ng malinis na jacket o kumot para hindi ginawin. Mag-file agad ng SOS report sa app.';
    }
    if (clean.includes('init') || clean.includes('heat') || clean.includes('hingal')) {
      return 'Ilipat agad sa malilim na lugar. Basain ng katamtamang lamig na tubig ang kanyang mga paa at tainga (huwag yelo). Mag-alok ng kaunting inumin.';
    }
    if (clean.includes('gamot') || clean.includes('medicine') || clean.includes('paracetamol') || clean.includes('biogesic') || clean.includes('ibuprofen')) {
      return 'MAHIGPIT NA BABALA: Huwag kailanman magbigay ng paracetamol, biogesic, o ibuprofen sa hayop — ito ay nakalalason at nakamamatay sa aso at pusa. Dalhin agad sa pinakamalapit na vet clinic.';
    }
    return 'Nandito ako para tumulong. Manatili sa ligtas na distansya upang hindi matakot ang hayop. Sabihin sa akin: nagdurugo ba sila, hindi makahinga, o may bali?';
  }

  // 4. In-scope emergency guidance (English)
  if (clean.includes('bleed') || clean.includes('blood')) {
    return 'Keep a safe distance first so they do not feel cornered. If safe to approach, apply gentle, steady pressure with a clean cloth. Tap the red SOS button to dispatch nearby rescuers.';
  }
  if (clean.includes('hit') || clean.includes('car') || clean.includes('fracture') || clean.includes('limp') || clean.includes('bone')) {
    return 'Keep the animal completely still to prevent further injury. Do not give food or water if surgery might be needed. Cover gently with a cloth and submit an SOS report right away.';
  }
  if (clean.includes('heat') || clean.includes('pant') || clean.includes('hot')) {
    return 'Move them to shade immediately. Wet their paws and ears with cool (not ice cold) tap water. Offer small sips of water without forcing.';
  }
  if (clean.includes('medicine') || clean.includes('paracetamol') || clean.includes('tylenol') || clean.includes('ibuprofen') || clean.includes('aspirin')) {
    return 'STRICT WARNING: Never give human pain medication (like paracetamol, ibuprofen, or aspirin) to animals. It causes fatal liver and kidney failure. Contact a clinic immediately.';
  }
  return "I'm here with you. Please keep a safe distance so the animal doesn't feel threatened. Are they bleeding, having trouble breathing, or unable to stand?";
}
