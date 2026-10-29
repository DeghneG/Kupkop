import { NextResponse } from 'next/server';
import {
  getGeminiClient,
  checkRateLimit,
  RAFA_SYSTEM_INSTRUCTION,
  generateMockRafaResponse,
} from '@/lib/gemini/rafa';


interface ChatHistoryItem {
  role: 'user' | 'model';
  text: string;
}

interface ChatRequestBody {
  message: string;
  language?: 'en' | 'fil';
  history?: ChatHistoryItem[];
}

export async function POST(request: Request) {
  try {
    // 1. Rate Limiting Guardrail (Max 10 requests / min per IP)
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const { allowed, remaining } = checkRateLimit(ip, 10, 60_000);
    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please wait a moment before sending another message.',
          isMock: false,
        },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    // 2. Validate Input & Length Caps
    const body: ChatRequestBody = await request.json();
    const rawMessage = body.message;

    if (!rawMessage || typeof rawMessage !== 'string' || rawMessage.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message cannot be empty.' },
        { status: 400 }
      );
    }

    // Truncate message to 500 chars to avoid spending surges
    const message = rawMessage.trim().slice(0, 500);
    const language = body.language === 'fil' ? 'fil' : 'en';

    // 3. Check for Gemini API Client
    const ai = getGeminiClient();

    // If API key is not configured or is placeholder, return graceful mock response
    if (!ai) {
      const mockReply = generateMockRafaResponse(message, language);
      return NextResponse.json(
        {
          response: mockReply,
          isMock: true,
          notice: 'Test Mode: Configure GEMINI_API_KEY in .env.local for live Gemini responses.',
        },
        {
          headers: {
            'X-RateLimit-Remaining': remaining.toString(),
          },
        }
      );
    }

    // 4. Construct Multi-turn Chat Payload with Max 6 Previous Turns
    const contents = [];

    if (Array.isArray(body.history)) {
      const recentHistory = body.history.slice(-6);
      for (const item of recentHistory) {
        if (item.role === 'user' || item.role === 'model') {
          contents.push({
            role: item.role,
            parts: [{ text: String(item.text).slice(0, 500) }],
          });
        }
      }
    }

    // Gemini expects the conversation to open with a user turn; drop the greeting and any leading replies
    while (contents.length > 0 && contents[0].role === 'model') contents.shift();

    // Add current user prompt with explicit language hint
    const langContext = language === 'fil' ? 'Language: Filipino/Tagalog.' : 'Language: English.';
    contents.push({
      role: 'user',
      parts: [{ text: `[${langContext}]\n${message}` }],
    });

    // 5. Call Gemini 2.5 Flash
    let replyText = '';
    let usedFallback = false;
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: RAFA_SYSTEM_INSTRUCTION,
          temperature: 0.3,
          maxOutputTokens: 700,
          // 2.5 Flash spends output tokens on hidden thinking, which cut replies off mid-sentence
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      replyText = result.text || '';
    } catch (apiErr: unknown) {
      console.warn('Primary Gemini call error, attempting fallback:', apiErr);
      
      // Fallback to the lighter 2.5 model if Flash is busy or unavailable
      try {
        const fallbackResult = await ai.models.generateContent({
          model: 'gemini-2.5-flash-lite',
          contents,
          config: {
            systemInstruction: RAFA_SYSTEM_INSTRUCTION,
            temperature: 0.3,
            maxOutputTokens: 700,
            thinkingConfig: { thinkingBudget: 0 },
          },
        });
        replyText = fallbackResult.text || '';
      } catch (fallbackErr: unknown) {
        console.error('All Gemini attempts failed:', fallbackErr);
        // Fall back gracefully to built-in triage helper so user is never stranded
        replyText = generateMockRafaResponse(message, language);
        usedFallback = true;
      }
    }

    if (!replyText) {
      replyText = generateMockRafaResponse(message, language);
      usedFallback = true;
    }

    return NextResponse.json(
      {
        response: replyText,
        // True whenever the built-in replies answered, so the chat can label them as offline answers
        isMock: usedFallback,
      },
      {
        headers: {
          'X-RateLimit-Remaining': remaining.toString(),
        },
      }
    );
  } catch (err: unknown) {
    console.error('API /api/chat error:', err);
    // Details stay in the server log; the chat shows a plain message
    return NextResponse.json(
      { error: 'Rafa could not answer just now. Please try again.' },
      { status: 500 }
    );
  }
}
