'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  sender: 'rafa' | 'user';
  text: string;
  time: string;
}

export default function RafaPage() {
  const [language, setLanguage] = useState<'en' | 'fil'>('en');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      sender: 'rafa',
      text: "Hello, I'm Rafa. Keep a safe distance so the animal does not feel cornered. Are they bleeding, having trouble breathing, or trapped?",
      time: 'Just now',
    },
  ]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: input,
      time: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    setTimeout(() => {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'rafa',
        text:
          language === 'fil'
            ? 'Naiintindihan ko. Habang papunta ang responder, huwag munang pakainin o painumin kung posibleng may internal injury. Takpan ng malinis na tela kung nanginginig.'
            : 'Understood. While responders are on their way, do not give food or water if internal injuries are suspected. Cover gently with a clean cloth if they are shivering.',
        time: 'Just now',
      };
      setMessages((prev) => [...prev, reply]);
    }, 500);
  };

  return (
    <div className="flex flex-col flex-1 px-4 py-4 space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <Link
          href="/"
          className="flex items-center gap-1 text-fg-muted hover:text-fg min-w-[44px] min-h-[44px] text-[12px] font-semibold"
          aria-label="Back to Feed"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Feed</span>
        </Link>

        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          <div>
            <h1 className="text-[16px] font-semibold text-fg">
              Rafa Helper
            </h1>
            <p className="text-[12px] text-fg-muted">First-aid guidance</p>
          </div>
        </div>

        {/* Language Toggle EN / FIL */}
        <div className="flex rounded-xl border border-border bg-surface-muted p-0.5 text-[12px] font-semibold">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              language === 'en'
                ? 'bg-surface-card text-fg shadow-sm'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('fil')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              language === 'fil'
                ? 'bg-surface-card text-fg shadow-sm'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            FIL
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 py-2">
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
                    ? 'bg-surface-muted text-fg border-border'
                    : 'bg-fg text-surface border-fg font-normal'
                }`}
              >
                {m.text}
              </div>
              <span className="text-[12px] text-fg-muted mt-1 px-1">{m.time}</span>
            </div>
          );
        })}
      </div>

      {/* Input Form in thumb-zone */}
      <form onSubmit={handleSend} className="pt-2 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            language === 'fil'
              ? 'Magtanong kay Rafa...'
              : 'Ask Rafa...'
          }
          className="flex-1 min-h-[48px] px-4 text-[14px] bg-surface-muted text-fg rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          className="min-w-[48px] min-h-[48px] bg-fg text-surface hover:opacity-90 rounded-xl flex items-center justify-center transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
