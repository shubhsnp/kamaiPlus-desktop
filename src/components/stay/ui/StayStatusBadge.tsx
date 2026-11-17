'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';
import type { RoomStatus, BookingStatus } from '@/lib/stay/types';

interface StayStatusBadgeProps {
  status: RoomStatus | BookingStatus | string;
  type?: 'room' | 'booking' | 'payment';
  className?: string;
  size?: 'sm' | 'md';
}

export const StayStatusBadge: React.FC<StayStatusBadgeProps> = ({
  status,
  type = 'booking',
  className = '',
  size = 'md',
}) => {
  const { language } = useTranslation();
  const isMarathi = language === 'mr';

  const sizeClasses = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5';

  if (type === 'room') {
    switch (status as RoomStatus) {
      case 'available':
        return (
          <span className={`font-black uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 ${sizeClasses} ${className}`}>
            {isMarathi ? 'उपलब्ध (Available)' : 'Available'}
          </span>
        );
      case 'occupied':
        return (
          <span className={`font-black uppercase tracking-wider rounded-full bg-rose-100 text-rose-800 border border-rose-300 ${sizeClasses} ${className}`}>
            {isMarathi ? 'व्यापलेले (Occupied)' : 'Occupied'}
          </span>
        );
      case 'reserved':
        return (
          <span className={`font-black uppercase tracking-wider rounded-full bg-amber-100 text-amber-800 border border-amber-300 ${sizeClasses} ${className}`}>
            {isMarathi ? 'राखीव (Reserved)' : 'Reserved'}
          </span>
        );
      case 'cleaning':
        return (
          <span className={`font-black uppercase tracking-wider rounded-full bg-sky-100 text-sky-800 border border-sky-300 ${sizeClasses} ${className}`}>
            {isMarathi ? 'स्वच्छता (Cleaning)' : 'Cleaning'}
          </span>
        );
      case 'maintenance':
        return (
          <span className={`font-black uppercase tracking-wider rounded-full bg-slate-100 text-slate-800 border border-slate-300 ${sizeClasses} ${className}`}>
            {isMarathi ? 'दुरुस्ती (Maintenance)' : 'Maintenance'}
          </span>
        );
      case 'out_of_service':
        return (
          <span className={`font-black uppercase tracking-wider rounded-full bg-red-100 text-red-900 border border-red-300 ${sizeClasses} ${className}`}>
            {isMarathi ? 'बंद (Out of Service)' : 'Out of Service'}
          </span>
        );
      default:
        return (
          <span className={`font-bold rounded-full bg-slate-100 text-slate-700 ${sizeClasses} ${className}`}>
            {status}
          </span>
        );
    }
  }

  // Booking status badges
  switch (status as BookingStatus) {
    case 'confirmed':
      return (
        <span className={`font-black uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 ${sizeClasses} ${className}`}>
          {isMarathi ? 'निश्चित (Confirmed)' : 'Confirmed'}
        </span>
      );
    case 'checked_in':
      return (
        <span className={`font-black uppercase tracking-wider rounded-full bg-blue-100 text-blue-800 border border-blue-300 ${sizeClasses} ${className}`}>
          {isMarathi ? 'चेक-इन (Checked-in)' : 'Checked-in'}
        </span>
      );
    case 'checked_out':
      return (
        <span className={`font-black uppercase tracking-wider rounded-full bg-slate-100 text-slate-700 border border-slate-300 ${sizeClasses} ${className}`}>
          {isMarathi ? 'चेक-आउट (Checked-out)' : 'Checked-out'}
        </span>
      );
    case 'tentative':
      return (
        <span className={`font-black uppercase tracking-wider rounded-full bg-amber-100 text-amber-800 border border-amber-300 ${sizeClasses} ${className}`}>
          {isMarathi ? 'तात्पुरते (Tentative)' : 'Tentative'}
        </span>
      );
    case 'enquiry':
      return (
        <span className={`font-black uppercase tracking-wider rounded-full bg-purple-100 text-purple-800 border border-purple-300 ${sizeClasses} ${className}`}>
          {isMarathi ? 'चौकशी (Enquiry)' : 'Enquiry'}
        </span>
      );
    case 'cancelled':
      return (
        <span className={`font-black uppercase tracking-wider rounded-full bg-rose-100 text-rose-800 border border-rose-300 ${sizeClasses} ${className}`}>
          {isMarathi ? 'रद्द (Cancelled)' : 'Cancelled'}
        </span>
      );
    default:
      return (
        <span className={`font-bold rounded-full bg-slate-100 text-slate-700 ${sizeClasses} ${className}`}>
          {status}
        </span>
      );
  }
};
