'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, ScanLine } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { getGeminiApiKey, setGeminiApiKey } from '@/lib/ai/geminiClient';

/**
 * Gemini API key for AI purchase-bill scanning (Purchases → Scan Bill). The
 * desktop app has no server, so the shop's own key is kept on this computer
 * and sent only to Google's Gemini API.
 */
export function AiScanSettingsCard() {
  const [key, setKey] = useState(() => (typeof window === 'undefined' ? '' : getGeminiApiKey()));
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setGeminiApiKey(key);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Card className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <ScanLine className="w-4 h-4 text-violet-600" />
        <h3 className="text-sm font-black text-slate-900">AI Purchase Bill Scan</h3>
      </div>
      <p className="text-xs text-slate-500">
        Photo / PDF of a supplier bill → items, quantities and rates filled in automatically. Needs a Google Gemini API key
        (free from aistudio.google.com). It is saved only on this computer.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste Gemini API key"
            className="w-full px-3 py-2 pr-9 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:border-slate-900"
          />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer" aria-label={show ? 'Hide key' : 'Show key'}>
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button type="button" onClick={save} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">
          {saved ? 'Saved ✓' : 'Save Key'}
        </button>
      </div>
    </Card>
  );
}
