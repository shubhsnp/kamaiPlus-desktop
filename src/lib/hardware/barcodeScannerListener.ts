'use client';

import { useEffect, useRef } from 'react';
import { isSoundMuted } from '@/lib/sound/soundSettings';

// Plays an authentic supermarket POS laser scanner beep (2400Hz frequency sine wave)
export function playSupermarketBeep() {
  if (typeof window === 'undefined' || isSoundMuted()) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, ctx.currentTime); // 2.4kHz crystal beep

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08); // 80ms duration

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (err) {
    // AudioContext autoplay restrictions fallback
  }
}

export interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minChars?: number;
  maxIntervalMs?: number; // max milliseconds between keystrokes to qualify as laser gun
  /** Stand aside (e.g. the POS search box has focus and reads the whole code itself on Enter). */
  ignore?: () => boolean;
}

export function useHardwareBarcodeScanner({
  onScan,
  enabled = true,
  minChars = 3,
  maxIntervalMs = 50,
  ignore,
}: BarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (ignore && ignore()) {
        bufferRef.current = '';
        return;
      }
      // v4.72.0: time the keys by when they were pressed (the event's own timestamp), not
      // when this code gets to run — a busy screen (e.g. the "Sale completed" preview being
      // drawn) delayed the handler, looked like slow typing, and cut the code short.
      const now = e.timeStamp > 0 ? e.timeStamp : Date.now();
      const timeDiff = Math.abs(now - lastKeyTimeRef.current);
      lastKeyTimeRef.current = now;

      // Nobody types into a page with no text box focused, so outside one a slower gun is fine.
      const active = document.activeElement as HTMLElement | null;
      const inTextBox = Boolean(active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable));
      if (timeDiff > (inTextBox ? maxIntervalMs : Math.max(maxIntervalMs, 250))) {
        bufferRef.current = '';
      }

      // If Enter key is pressed (Standard barcode scanner suffix)
      if (e.key === 'Enter') {
        const scanned = bufferRef.current.trim();
        if (scanned.length >= minChars) {
          e.preventDefault();
          e.stopPropagation();
          playSupermarketBeep();
          onScan(scanned);
          bufferRef.current = '';
        }
        return;
      }

      // Buffer single printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onScan, enabled, minChars, maxIntervalMs, ignore]);
}
