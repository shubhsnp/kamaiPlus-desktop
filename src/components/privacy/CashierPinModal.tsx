'use client';

import React, { useEffect, useState } from 'react';
import { Lock, ShieldAlert, KeyRound } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { verifyOwnerPin, setProfitHidden, isProfitHidden, hasOwnerPin } from '@/lib/auth/cashierPrivacy';
import { OwnerPinSetup } from './OwnerPinSetup';

interface CashierPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CashierPinModal({ isOpen, onClose, onSuccess }: CashierPinModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  // No PIN yet: the owner sets one first (with the master password).
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      setIsChangingPin(!hasOwnerPin());
    }
  }, [isOpen]);

  const isLocked = isProfitHidden();

  const unlock = () => {
    setProfitHidden(false); // Unlock sensitive financial fields
    setPin('');
    onSuccess?.();
    onClose();
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (verifyOwnerPin(pin)) unlock();
    else setError('Incorrect 4-digit PIN.');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isChangingPin ? (hasOwnerPin() ? 'Change Owner PIN' : 'Set your Owner PIN') : 'Owner Privacy Lock'}
      size="sm"
    >
      <div className="p-1 space-y-4">
        {!isChangingPin ? (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="text-center space-y-2 py-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-900">
                {isLocked ? 'Unlock Profit Margins & Cost Prices' : 'Lock Sensitive Store Finances'}
              </h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Enter your 4-digit Owner PIN to view purchase prices, profit margins, and net profits.
              </p>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block text-center">Enter 4-Digit Owner PIN</label>
              <input
                type="password"
                maxLength={4}
                autoFocus
                placeholder="• • • •"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center text-2xl tracking-[1em] font-mono py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button type="submit" className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs h-10 rounded-xl">
                Unlock Secret Data
              </Button>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  setIsChangingPin(true);
                }}
                className="text-xs text-amber-700 font-bold hover:underline flex items-center justify-center gap-1 py-1"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Change or forgot PIN</span>
              </button>
            </div>
          </form>
        ) : (
          <OwnerPinSetup
            intro={hasOwnerPin() ? 'Set a new PIN. Your master password confirms it is you.' : 'Choose a 4-digit PIN that only you know. Staff will need it to see profit and cost prices.'}
            onDone={unlock}
            onCancel={hasOwnerPin() ? () => setIsChangingPin(false) : undefined}
          />
        )}
      </div>
    </Modal>
  );
}
