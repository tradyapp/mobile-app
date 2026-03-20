'use client';

import { type CSSProperties, useState } from 'react';

export interface OrionAiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface OrionAiAssistantDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  messages: OrionAiMessage[];
  isBusy: boolean;
  onSend: (message: string) => void;
}

export default function OrionAiAssistantDrawer({
  isOpen,
  onOpenChange,
  messages,
  isBusy,
  onSend,
}: OrionAiAssistantDrawerProps) {
  const [draft, setDraft] = useState('');
  const panelStyle: CSSProperties = { width: 'min(100vw, 560px)' };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[320] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close Orion AI assistant"
        onClick={() => onOpenChange(false)}
      />
      <aside className="relative h-full bg-zinc-950 text-zinc-100 shadow-[-14px_0_30px_rgba(0,0,0,0.45)]" style={panelStyle}>
        <div className="flex h-full flex-col">
          <div className="border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Orion AI</p>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-zinc-400">Tools: agregar nodo, conectar, ejecutar, upstream</p>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
                Prueba: <span className="text-zinc-200">agrega nodo candles</span>
              </div>
            ) : messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  message.role === 'user'
                    ? 'ml-auto border border-emerald-700/40 bg-emerald-900/30 text-emerald-100'
                    : 'border border-zinc-800 bg-zinc-900 text-zinc-100'
                }`}
              >
                {message.text}
              </div>
            ))}
            {isBusy && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
                Ejecutando tools...
              </div>
            )}
          </div>

          <form
            className="border-t border-zinc-800 px-3 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (!text || isBusy) return;
              onSend(text);
              setDraft('');
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Describe lo que quieres construir..."
                rows={2}
                className="min-h-[42px] flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-500"
              />
              <button
                type="submit"
                disabled={isBusy || draft.trim().length === 0}
                className="h-10 rounded-lg border border-emerald-600 bg-emerald-900/40 px-3 text-xs font-semibold text-emerald-200 disabled:opacity-60"
              >
                Enviar
              </button>
            </div>
          </form>
        </div>
      </aside>
    </div>
  );
}
