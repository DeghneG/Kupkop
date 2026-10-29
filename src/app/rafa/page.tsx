'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

import { Send, MessageSquareHeart, AlertCircle, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  sender: 'rafa' | 'user';
  text: string;
  time: string;
  /** Answered by the built-in replies because Gemini was unavailable */
  offline?: boolean;
}

// Bold spans only (**text**); single-asterisk emphasis is dropped to plain text
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    ) : (
      part.replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|[.,!?]|$)/g, '$1$2')
    )
  );
}

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul' | 'ol'; items: { text: string; children: string[] }[] };

// Gemini replies use light Markdown: paragraphs, "*"/"-" bullets, "1." steps and **bold**
function RafaText({ text }: { text: string }) {
  const blocks: Block[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      blocks.push({ kind: 'p', lines: [] });
      continue;
    }
    const nested = /^\s{2,}/.test(line);
    const bullet = line.match(/^\s*[*-]\s+(.*)$/);
    const step = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const kind = bullet ? 'ul' : step ? 'ol' : 'p';
    const last = blocks[blocks.length - 1];

    if (kind === 'p') {
      if (last?.kind === 'p' && last.lines.length) last.lines.push(line.trim());
      else blocks.push({ kind: 'p', lines: [line.trim()] });
    } else {
      const itemText = (bullet ?? step)![1];
      const parent = last && last.kind !== 'p' ? last.items[last.items.length - 1] : undefined;
      // Indented bullets belong to the step above them, so step numbers stay 1, 2, 3
      if (nested && parent) parent.children.push(itemText);
      else if (last && last.kind === kind) last.items.push({ text: itemText, children: [] });
      else blocks.push({ kind, items: [{ text: itemText, children: [] }] });
    }
  }

  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.kind === 'p') {
          return b.lines.length ? <p key={i}>{renderInline(b.lines.join(' '))}</p> : null;
        }
        const List = b.kind === 'ol' ? 'ol' : 'ul';
        return (
          <List key={i} className={`${b.kind === 'ol' ? 'list-decimal' : 'list-disc'} pl-5 space-y-1`}>
            {b.items.map((item, j) => (
              <li key={j}>
                {renderInline(item.text)}
                {item.children.length > 0 && (
                  <ul className="mt-1 list-[circle] pl-5 space-y-1">
                    {item.children.map((child, k) => (
                      <li key={k}>{renderInline(child)}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

const quickPromptChips = [
  { label: 'Bleeding', queryEn: 'How do I stop the bleeding safely?', queryFil: 'Paano pigilan ang pagdugo ng sugat nang ligtas?' },
  { label: 'Moving animal', queryEn: 'Can I move an injured animal, and how do I lift it safely?', queryFil: 'Nasugatan o nabangga ang hayop, paano ilipat nang ligtas?' },
  { label: 'Scared dog', queryEn: 'A dog is growling and scared. How do I approach safely?', queryFil: 'Galit o natatakot ang aso, paano lalapitan nang ligtas?' },
  { label: 'Keep warm', queryEn: 'The animal is in shock and shaking. How do I keep it warm?', queryFil: 'Nanginginig at giniginaw sa shock ang hayop, paano papainitin?' },
  { label: 'Animal bit me', queryEn: 'An animal bit or scratched me, what should I do right now?', queryFil: 'Kinagat o kinalmot ako ng hayop, ano ang dapat kong gawin ngayon?' },
  { label: 'While waiting', queryEn: 'What should I do while waiting for responders to arrive?', queryFil: 'Ano ang dapat kong gawin habang naghihintay ng responder?' },
];

export default function RafaPage() {
  const [language, setLanguage] = useState<'en' | 'fil'>('en');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      sender: 'rafa',
      text:
        "Hello, I'm Rafa. Keep a safe distance so the animal does not feel cornered. Are they bleeding, having trouble breathing, or trapped?",
      time: 'Just now',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = useCallback(
    async (textToSend: string) => {
      if (!textToSend.trim() || loading) return;

      setErrorMsg(null);

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const userMsg: Message = {
        id: `u-${now.getTime()}`,
        sender: 'user',
        text: textToSend.trim(),
        time: timeStr,
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput('');
      setLoading(true);

      try {
        // Build history payload for multi-turn context
        const historyPayload = updatedMessages.slice(-6).map((m) => ({
          role: (m.sender === 'rafa' ? 'model' : 'user') as 'model' | 'user',
          text: m.text,
        }));

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: textToSend.trim(),
            language,
            history: historyPayload,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to get a response from Rafa.');
        }

        const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const rafaReply: Message = {
          id: `r-${Date.now()}`,
          sender: 'rafa',
          text: data.response,
          time: replyTime,
          offline: data.isMock === true,
        };

        setMessages((prev) => [...prev, rafaReply]);
      } catch (err: unknown) {
        const errText = err instanceof Error ? err.message : 'Error reaching Rafa. Please try again.';
        setErrorMsg(errText);
      } finally {
        setLoading(false);
      }
    },
    [messages, language, loading]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  const handleChipClick = (queryEn: string, queryFil: string) => {
    const text = language === 'fil' ? queryFil : queryEn;
    handleSendMessage(text);
  };

  return (
    <div className="flex flex-col flex-1 px-4 py-3 space-y-3">
      {/* 1. Header with semantic tokens */}
      <header className="flex items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-surface-muted border border-border flex items-center justify-center shrink-0">
            <MessageSquareHeart className="w-4 h-4 text-rafa" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-fg font-brand leading-none">Rafa</h1>
            <p className="text-[12px] text-fg-muted mt-1">First-aid guidance</p>
          </div>
        </div>

        {/* Language Toggle EN / FIL */}
        <div
          role="radiogroup"
          aria-label="Language selector"
          className="flex rounded-xl border border-border bg-surface-muted p-0.5 text-[12px] font-semibold"
        >
          <button
            type="button"
            role="radio"
            aria-checked={language === 'en'}
            onClick={() => setLanguage('en')}
            className={`min-h-[44px] min-w-[44px] px-3 rounded-lg transition-colors cursor-pointer ${
              language === 'en'
                ? 'bg-surface text-fg shadow-sm'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={language === 'fil'}
            onClick={() => setLanguage('fil')}
            className={`min-h-[44px] min-w-[44px] px-3 rounded-lg transition-colors cursor-pointer ${
              language === 'fil'
                ? 'bg-surface text-fg shadow-sm'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            FIL
          </button>
        </div>
      </header>

      {/* 2. Chat Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-3 py-1 pr-1">
        {messages.map((m) => {
          const isRafa = m.sender === 'rafa';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isRafa ? 'items-start' : 'items-end'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-[14px] leading-relaxed shadow-sm border ${
                  isRafa
                    ? 'bg-surface text-fg border-border'
                    : 'bg-action text-action-fg font-normal border-action'
                }`}
              >
                {isRafa ? <RafaText text={m.text} /> : m.text}
              </div>
              <span className="text-[12px] text-fg-muted mt-1 px-1">
                {m.offline
                  ? `${m.time} · ${language === 'fil' ? 'Offline na sagot, basic na gabay lang' : 'Offline answer, basic guidance only'}`
                  : m.time}
              </span>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex flex-col items-start space-y-1">
            <div className="flex items-center gap-2 bg-surface text-fg-muted border border-border rounded-2xl px-4 py-3 shadow-sm text-[14px]">
              <Loader2 className="w-4 h-4 animate-spin text-rafa" />
              <span>Rafa is analyzing...</span>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div
            role="alert"
            className="flex items-center gap-2 p-3 rounded-xl bg-reported-bg text-reported-fg border border-reported-fg/20 text-[12px] font-normal"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Quick Triage Chips (Strictly 12px font size, neutral outlined) */}
      <div className="pt-1">
        <p className="text-[12px] font-normal text-fg-muted mb-1.5">
          Tap for immediate emergency guidance:
        </p>
        <div className="flex flex-wrap gap-2">
          {quickPromptChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={loading}
              onClick={() => handleChipClick(chip.queryEn, chip.queryFil)}
              className="min-h-[44px] px-4 rounded-full text-[12px] font-semibold border border-border bg-surface hover:bg-surface-muted text-fg transition-colors cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Input Form in Thumb-Zone */}
      <form onSubmit={handleSubmit} className="pt-1 flex items-center gap-2">
        <input
          type="text"
          value={input}
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            language === 'fil'
              ? 'Magtanong kay Rafa (hal. nagdurugo ang pusa)...'
              : 'Ask Rafa (e.g. dog bleeding from leg)...'
          }
          className="flex-1 min-h-[48px] px-4 text-[14px] bg-surface text-fg placeholder:text-fg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-action shadow-sm disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="min-w-[48px] min-h-[48px] bg-action hover:opacity-95 text-action-fg rounded-xl flex items-center justify-center transition-opacity shadow-sm focus:outline-none focus:ring-2 focus:ring-action cursor-pointer disabled:opacity-40 border-none shrink-0"
          aria-label="Send message"
        >
          <Send className="w-4 h-4 text-action-fg" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
