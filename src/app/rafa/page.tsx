'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, Sparkles, Heart, Shield } from 'lucide-react';

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
      text: "Hello, I'm Rafa. Stay calm. If you're near an injured street animal, keep a safe distance so the animal doesn't get startled. Are they actively bleeding, having difficulty breathing, or trapped?",
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

    // Simulated Rafa response
    setTimeout(() => {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'rafa',
        text:
          language === 'fil'
            ? 'Naiintindihan ko. Habang papunta ang responder, huwag munang pakainin o painumin kung posibleng may internal injury. Takpan ng malinis na tela kung nanginginig.'
            : "Understood. While responders are on their way, do not give food or water if internal injuries are suspected. Cover gently with a clean towel if they are in shock or shivering.",
        time: 'Just now',
      };
      setMessages((prev) => [...prev, reply]);
    }, 600);
  };

  return (
    <div className="flex flex-col flex-1 px-4 py-4 min-h-[calc(100vh-80px)]">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white min-w-[48px] min-h-[48px]"
          aria-label="Back to Feed"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-xs font-bold">Feed</span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
              Rafa Helper
            </h1>
            <p className="text-[10px] text-zinc-500">First-aid & rules triage</p>
          </div>
        </div>

        {/* Language Toggle EN / FIL */}
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2 py-1 rounded-md transition-colors ${
              language === 'en'
                ? 'bg-teal-600 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('fil')}
            className={`px-2 py-1 rounded-md transition-colors ${
              language === 'fil'
                ? 'bg-teal-600 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            FIL
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.map((m) => {
          const isRafa = m.sender === 'rafa';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isRafa ? 'items-start' : 'items-end'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                  isRafa
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-950 dark:text-teal-100 border border-teal-200 dark:border-teal-900/60 rounded-tl-sm'
                    : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-tr-sm font-medium'
                }`}
              >
                {m.text}
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 px-1">{m.time}</span>
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
              ? 'Magtanong kay Rafa (hal. paano mag-pressure bandage)...'
              : 'Ask Rafa (e.g., how to apply pressure on bleeding)...'
          }
          className="flex-1 min-h-[48px] px-3.5 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          type="submit"
          className="min-w-[48px] min-h-[48px] bg-teal-600 hover:bg-teal-700 text-white rounded-xl flex items-center justify-center transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
