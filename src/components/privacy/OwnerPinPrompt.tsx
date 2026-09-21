'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { verifyOwnerPin } from '@/lib/auth/cashierPrivacy';

/**
 * Asks for the 4-digit owner PIN before showing profit and margins on one
 * screen (Android OwnerPrivacyModal). Unlike the app-wide Cashier Privacy lock
 * it changes nothing globally — closing the screen hides the figures again.
 */
export function OwnerPinPrompt({ isOpen, onClose, onUnlocked }: { isOpen: boolean; onClose: () => void; onUnlocked: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
    }
  }, [isOpen]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyOwnerPin(pin)) {
      onUnlocked();
      onClose();
    } else {
      setError('Incorrect PIN. (Change it anytime from the Cashier Privacy lock.)');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Owner PIN required" description="Profit and margins are hidden from staff." size="sm">
      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="••••"
          className="w-full text-center tracking-[0.6em] text-2xl font-black py-3 rounded-xl border border-slate-300 focus:outline-none focus:border-slate-900"
        />
        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={pin.length !== 4}>
          <KeyRound className="w-4 h-4" /> Show Profit
        </Button>
      </form>
    </Modal>
  );
}
