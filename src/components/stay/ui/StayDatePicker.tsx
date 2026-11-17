'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface StayDatePickerProps {
  label?: string;
  value: string; // ISO date format "YYYY-MM-DD"
  onChange: (dateStr: string) => void;
  minDate?: string; // "YYYY-MM-DD"
  maxDate?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  helperText?: string;
  error?: string;
  showPresets?: boolean;
}

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTHS_MR = [
  'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
  'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'
];

const DAYS_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_SHORT_MR = ['रवि', 'सोम', 'मंगळ', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

export const StayDatePicker: React.FC<StayDatePickerProps> = ({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  required = false,
  disabled = false,
  className = '',
  placeholder = 'Select date',
  helperText,
  error,
  showPresets = true,
}) => {
  const { language } = useTranslation();
  const isMarathi = language === 'mr';

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial selected date or default to today
  const selectedDate = useMemo(() => {
    if (!value) return null;
    const parts = value.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return null;
  }, [value]);

  // Current calendar view (month and year)
  const [viewDate, setViewDate] = useState<Date>(() => {
    return selectedDate ? new Date(selectedDate) : new Date();
  });

  // Sync viewDate when value changes
  useEffect(() => {
    if (selectedDate) {
      setViewDate(new Date(selectedDate));
    }
  }, [value]);

  // Close calendar popup on click outside
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

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const y = viewYear;
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  // Days in month calculation
  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  const startDayOfWeek = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).getDay();
  }, [viewYear, viewMonth]);

  // Format display text
  const displayValue = useMemo(() => {
    if (!selectedDate) return '';
    const day = selectedDate.getDate();
    const mIdx = selectedDate.getMonth();
    const year = selectedDate.getFullYear();
    const dayOfWeek = selectedDate.getDay();

    if (isMarathi) {
      return `${day} ${MONTHS_MR[mIdx]} ${year} (${DAYS_SHORT_MR[dayOfWeek]})`;
    }
    return `${day} ${MONTHS_EN[mIdx]} ${year} (${DAYS_SHORT_EN[dayOfWeek]})`;
  }, [selectedDate, isMarathi]);

  const isDayDisabled = (day: number) => {
    const y = viewYear;
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const currentStr = `${y}-${m}-${d}`;

    if (minDate && currentStr < minDate) return true;
    if (maxDate && currentStr > maxDate) return true;
    return false;
  };

  const isToday = (day: number) => {
    const now = new Date();
    return (
      now.getFullYear() === viewYear &&
      now.getMonth() === viewMonth &&
      now.getDate() === day
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day
    );
  };

  // Presets handlers
  const setPresetDate = (daysFromToday: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromToday);
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    const d = String(target.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
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
          <Calendar className="w-4 h-4 text-violet-600 flex-shrink-0" />
          <span className={displayValue ? 'text-slate-900 dark:text-slate-100 font-bold' : 'text-slate-400 font-normal'}>
            {displayValue || placeholder}
          </span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono">
          {value || ''}
        </div>
      </button>

      {error && <p className="text-[11px] font-semibold text-rose-600 mt-1">{error}</p>}
      {helperText && !error && <p className="text-[11px] text-slate-500 mt-1">{helperText}</p>}

      {/* Calendar Popup Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-3 w-[290px] animate-in fade-in zoom-in-95 duration-100">
          {/* Quick Presets Bar */}
          {showPresets && (
            <div className="flex items-center gap-1 mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold overflow-x-auto">
              <button
                type="button"
                onClick={() => setPresetDate(0)}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-violet-100 hover:text-violet-800 transition text-slate-700"
              >
                {isMarathi ? 'आज' : 'Today'}
              </button>
              <button
                type="button"
                onClick={() => setPresetDate(1)}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-violet-100 hover:text-violet-800 transition text-slate-700"
              >
                {isMarathi ? 'उद्या (+१)' : 'Tomorrow'}
              </button>
              <button
                type="button"
                onClick={() => setPresetDate(2)}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-violet-100 hover:text-violet-800 transition text-slate-700"
              >
                +2 {isMarathi ? 'रात्री' : 'Nights'}
              </button>
              <button
                type="button"
                onClick={() => setPresetDate(3)}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-violet-100 hover:text-violet-800 transition text-slate-700"
              >
                +3 {isMarathi ? 'रात्री' : 'Nights'}
              </button>
            </div>
          )}

          {/* Month & Year Navigation Header */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 transition"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-xs font-black text-slate-900 dark:text-slate-100">
              {isMarathi ? MONTHS_MR[viewMonth] : MONTHS_EN[viewMonth]} {viewYear}
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 transition"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {(isMarathi ? DAYS_SHORT_MR : DAYS_SHORT_EN).map((dayName, idx) => (
              <span
                key={dayName}
                className={`text-[10px] font-bold ${
                  idx === 0 ? 'text-rose-500' : 'text-slate-400'
                }`}
              >
                {dayName}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDayOfWeek }).map((_, idx) => (
              <div key={`blank-${idx}`} className="h-7 w-7" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const disabledDay = isDayDisabled(day);
              const selected = isSelected(day);
              const today = isToday(day);

              return (
                <button
                  type="button"
                  key={`day-${day}`}
                  disabled={disabledDay}
                  onClick={() => handleSelectDay(day)}
                  className={`h-7 w-7 rounded-md text-xs font-bold flex items-center justify-center transition cursor-pointer ${
                    selected
                      ? 'bg-violet-600 text-white shadow-sm font-black'
                      : today
                      ? 'bg-violet-50 text-violet-700 border border-violet-300 font-black'
                      : disabledDay
                      ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-violet-100/70 hover:text-violet-900'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer date info */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>{isMarathi ? 'निवडलेली तारीख' : 'Selected'}:</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
              {value || (isMarathi ? 'कोणतीही नाही' : 'None')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
