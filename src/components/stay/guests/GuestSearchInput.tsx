'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, Phone, Mail, Check, X } from 'lucide-react';
import { guestRepository } from '@/lib/stay/repositories/guestRepository';
import type { Guest } from '@/lib/stay/types';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface GuestSearchInputProps {
  businessId: string;
  selectedGuest?: Guest | null;
  onSelectGuest: (guest: Guest | null) => void;
  label?: string;
  error?: string;
}

export const GuestSearchInput: React.FC<GuestSearchInputProps> = ({
  businessId,
  selectedGuest,
  onSelectGuest,
  label,
  error,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Guest[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New guest modal state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newIdType, setNewIdType] = useState<'aadhaar' | 'passport' | 'driving_license' | 'voter_id' | 'other'>('aadhaar');
  const [newIdNumber, setNewIdNumber] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await guestRepository.search(businessId, query);
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, businessId]);

  const handleSelect = (guest: Guest) => {
    onSelectGuest(guest);
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onSelectGuest(null);
    setQuery('');
  };

  const handleOpenCreateModal = () => {
    if (/^\d+$/.test(query.trim())) {
      setNewPhone(query.trim());
      setNewName('');
    } else {
      setNewName(query.trim());
      setNewPhone('');
    }
    setNewEmail('');
    setNewIdNumber('');
    setCreateError('');
    setIsCreateOpen(true);
    setIsOpen(false);
  };

  const handleCreateGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      setCreateError(t('Guest Name') + ' & ' + t('Phone') + ' ' + t('are required'));
      return;
    }

    setIsCreating(true);
    setCreateError('');
    try {
      const now = new Date().toISOString();
      const guestRecord: Guest = {
        id: crypto.randomUUID(),
        business_id: businessId,
        name: newName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || undefined,
        id_type: newIdType,
        id_number: newIdNumber.trim() || undefined,
        created_at: now,
        updated_at: now,
        sync_status: 'pending',
      };
      await guestRepository.create(guestRecord);
      onSelectGuest(guestRecord);
      setIsCreateOpen(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create guest');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-1 text-left relative" ref={wrapperRef}>
      {label && <label className="text-xs font-bold text-slate-900">{label}</label>}

      {selectedGuest ? (
        <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-300 rounded-lg min-h-[44px]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs shrink-0">
              {selectedGuest.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{selectedGuest.name}</p>
              <p className="text-[11px] text-slate-500 font-medium truncate flex items-center gap-2">
                <span>{selectedGuest.phone}</span>
                {selectedGuest.id_number && (
                  <span className="text-slate-400">· {selectedGuest.id_type?.toUpperCase()}: {selectedGuest.id_number}</span>
                )}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-700 p-1 h-auto"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={t('Guest Name') + ' / ' + t('Phone') + '...'}
            leftIcon={<Search className="w-4 h-4" />}
            error={error}
          />

          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-60 overflow-y-auto">
              {isSearching ? (
                <div className="p-3 text-xs text-slate-500 text-center font-medium">
                  {t('Searching...')}
                </div>
              ) : results.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {results.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleSelect(g)}
                      className="w-full p-2.5 hover:bg-slate-50 text-left flex items-center justify-between transition cursor-pointer"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900">{g.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {g.phone}
                          </span>
                          {g.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {g.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <Check className="w-4 h-4 text-emerald-600 opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="w-full p-2.5 bg-slate-50 hover:bg-violet-50 text-violet-700 text-xs font-bold flex items-center gap-2 cursor-pointer transition"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ {t('Create new guest')} {query ? `"${query}"` : ''}</span>
                  </button>
                </div>
              ) : (
                <div className="p-3">
                  <p className="text-xs text-slate-500 text-center mb-2">{t('No guests found')}</p>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleOpenCreateModal}
                    className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ {t('Create new guest')}</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Add Guest Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={t('Create new guest')}
        description={t('Register a new guest in the system')}
        size="md"
      >
        <form onSubmit={handleCreateGuest} className="space-y-3.5">
          {createError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
              {createError}
            </div>
          )}
          <Input
            label={t('Guest Name') + ' *'}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Ramesh Patil"
            required
          />
          <Input
            label={t('Phone') + ' *'}
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="10-digit mobile number"
            required
          />
          <Input
            label="Email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="guest@example.com (optional)"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-900 block mb-1">ID Type</label>
              <select
                className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-slate-900 min-h-[38px]"
                value={newIdType}
                onChange={(e) => setNewIdType(e.target.value as any)}
              >
                <option value="aadhaar">Aadhaar</option>
                <option value="driving_license">Driving License</option>
                <option value="passport">Passport</option>
                <option value="voter_id">Voter ID</option>
                <option value="other">Other</option>
              </select>
            </div>
            <Input
              label="ID Number"
              value={newIdNumber}
              onChange={(e) => setNewIdNumber(e.target.value)}
              placeholder="e.g. 1234 5678 9012"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsCreateOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isCreating}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {t('Save Guest')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
