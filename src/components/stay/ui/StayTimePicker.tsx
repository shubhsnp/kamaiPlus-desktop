'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface StayTimePickerProps {
  label?: string;
  value: string; // "HH:mm" 24-hr format e.g. "12:00", "14:30"
  onChange: (timeStr: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  helperText?: string;
  error?: string;
  defaultType?: 'checkin' | 'checkout';
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = ['00', '15', '30', '45'];

export const StayTimePicker: React.FC<StayTimePickerProps> = ({
  label,
  value = '12:00',
  onChange,
  required = false,
  disabled = false,
  className = '',
  placeholder = 'Select time',
  helperText,
  error,
  defaultType = 'checkin',
}) => {
  const { language } = useTranslation();
  const isMarathi = language === 'mr';

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse 24-hour "HH:mm" into 12-hour components
  const { hour12, minute, period } = useMemo(() => {
    if (!value || !value.includes(':')) {
      return { hour12: 12, minute: '00', period: 'PM' };
    }
    const [hStr, mStr] = value.split(':');
    let h = parseInt(hStr, 10) || 12;
    const m = mStr ? mStr.padStart(2, '0').slice(0, 2) : '00';
    let p = 'AM';

    if (h >= 12) {
      p = 'PM';
      if (h > 12) h -= 12;
    } else if (h === 0) {
      h = 12;
    }

    return { hour12: h, minute: m, period: p };
  }, [value]);

  // Convert 12-hour components back to 24-hour "HH:mm"
  const updateTime = (h12: number, minStr: string, p: string) => {
    let h24 = h12;
    if (p === 'PM' && h12 < 12) {
      h24 += 12;
    } else if (p === 'AM' && h12 === 12) {
      h24 = 0;
    }
    const finalStr = `${String(h24).padStart(2, '0')}:${minStr}`;
    onChange(finalStr);
  };

  // Close popup on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Formatted display text
  const displayValue = useMemo(() => {
    return `${hour12}:${minute} ${period}`;
  }, [hour12, minute, period]);

  // Preset handlers
  const handlePreset = (presetTime: string) => {
    onChange(presetTime);
    setIsOpen(false);
  };

  const handleSetNow = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    onChange(`${h}:${m}`);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Input trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-left text-xs font-semibold min-h-[38px] transition cursor-pointer ${
          error
            ? 'border-rose-400 bg-rose-50/30'
            : isOpen
            ? 'border-violet-600 ring-2 ring-violet-500/20'
            : 'border-slate-300 hover:border-slate-400'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
      >
        <div className="flex items-center gap-2 truncate">
          <Clock className="w-4 h-4 text-violet-600 flex-shrink-0" />
          <span className="text-slate-900 dark:text-slate-100 font-bold font-mono">
            {displayValue || placeholder}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">
          {value || '12:00'} (24h)
        </span>
      </button>

      {error && <p className="text-[11px] font-semibold text-rose-600 mt-1">{error}</p>}
      {helperText && !error && <p className="text-[11px] text-slate-500 mt-1">{helperText}</p>}

      {/* Time Picker Popup */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-3 w-[270px] animate-in fade-in zoom-in-95 duration-100">
          {/* Quick presets */}
          <div className="flex flex-wrap gap-1 mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => handlePreset('12:00')}
              className={`px-2 py-0.5 rounded transition ${
                value === '12:00' ? 'bg-violet-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              12:00 PM ({isMarathi ? 'चेक-इन' : 'Check-in'})
            </button>
            <button
              type="button"
              onClick={() => handlePreset('11:00')}
              className={`px-2 py-0.5 rounded transition ${
                value === '11:00' ? 'bg-violet-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              11:00 AM ({isMarathi ? 'चेक-आउट' : 'Check-out'})
            </button>
            <button
              type="button"
              onClick={handleSetNow}
              className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 transition"
            >
              {isMarathi ? 'सध्याची वेळ' : 'Now'}
            </button>
          </div>

          {/* AM / PM Toggle */}
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 mb-2.5">
            <button
              type="button"
              onClick={() => updateTime(hour12, minute, 'AM')}
              className={`flex-1 py-1 rounded-md text-xs font-black transition cursor-pointer ${
                period === 'AM'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              AM ({isMarathi ? 'सकाळ' : 'Morning'})
            </button>
            <button
              type="button"
              onClick={() => updateTime(hour12, minute, 'PM')}
              className={`flex-1 py-1 rounded-md text-xs font-black transition cursor-pointer ${
                period === 'PM'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              PM ({isMarathi ? 'दुपार/रात्र' : 'Afternoon/Eve'})
            </button>
          </div>

          {/* Hour Grid */}
          <div className="mb-2">
            <span className="text-[10px] font-bold text-slate-400 block mb-1">
              {isMarathi ? 'तास निवडा (Hour)' : 'Select Hour'}:
            </span>
            <div className="grid grid-cols-6 gap-1">
              {HOURS.map((h) => (
                <button
                  type="button"
                  key={`h-${h}`}
                  onClick={() => updateTime(h, minute, period)}
                  className={`h-7 rounded-md text-xs font-bold transition cursor-pointer ${
                    hour12 === h
                      ? 'bg-violet-600 text-white font-black shadow-sm'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-violet-50 hover:text-violet-900'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Minute Grid */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 block mb-1">
              {isMarathi ? 'मिनिट निवडा (Minute)' : 'Select Minute'}:
            </span>
            <div className="grid grid-cols-4 gap-1">
              {MINUTES.map((m) => (
                <button
                  type="button"
                  key={`m-${m}`}
                  onClick={() => updateTime(hour12, m, period)}
                  className={`h-7 rounded-md text-xs font-bold transition cursor-pointer ${
                    minute === m
                      ? 'bg-violet-600 text-white font-black shadow-sm'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-violet-50 hover:text-violet-900'
                  }`}
                >
                  :{m}
                </button>
              ))}
            </div>
          </div>

          {/* Close button */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-violet-600 hover:text-violet-800 px-3 py-1 rounded-md hover:bg-violet-50 transition cursor-pointer"
            >
              {isMarathi ? 'पूर्ण झाले' : 'Done'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
