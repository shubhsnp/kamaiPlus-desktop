'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { hasOwnerPin, verifyOwnerPin } from '@/lib/auth/cashierPrivacy';
import { OwnerPinSetup } from './OwnerPinSetup';

/**
 * Asks for the 4-digit owner PIN before showing profit and margins on one
 * screen (Android OwnerPrivacyModal). Unlike the app-wide Cashier Privacy lock
 * it changes nothing globally — closing the screen hides the figures again.
 * With no PIN yet (or a forgotten one) the owner sets one with the master password.
 */
export function OwnerPinPrompt({ isOpen, onClose, onUnlocked }: { isOpen: boolean; onClose: () => void; onUnlocked: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [settingUp, setSettingUp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      setSettingUp(!hasOwnerPin());
    }
  }, [isOpen]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyOwnerPin(pin)) {
      onUnlocked();
      onClose();
    } else {
      setError('Incorrect PIN.');
    }
  };

  const unlocked = () => {
    onUnlocked();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={settingUp ? 'Set your owner PIN' : 'Owner PIN required'} description="Profit and margins are hidden from staff." size="sm">
      {settingUp ? (
        <OwnerPinSetup
          intro={hasOwnerPin() ? 'Reset the owner PIN with your master password.' : 'Choose a 4-digit PIN that only you know. Staff will need it to see profit and cost prices.'}
          onDone={unlocked}
          onCancel={hasOwnerPin() ? () => setSettingUp(false) : undefined}
        />
      ) : (
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
          <button type="button" onClick={() => setSettingUp(true)} className="w-full text-xs font-bold text-amber-700 hover:underline">
            Forgot PIN? Reset it with your master password
          </button>
        </form>
      )}
    </Modal>
  );
}
