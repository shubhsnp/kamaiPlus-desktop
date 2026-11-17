'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import type { Room, RoomType, HousekeepingTask } from '@/lib/stay/types';
import { Sparkles, Play, CheckCircle2, Clock, User, AlertTriangle } from 'lucide-react';

interface HousekeepingTaskCardProps {
  room: Room;
  roomType?: RoomType;
  task?: HousekeepingTask;
  lastCheckoutTime?: string;
  onStartCleaning: (roomId: string, taskId?: string) => void;
  onCompleteCleaning: (roomId: string, taskId?: string) => void;
  onAssignStaff?: (roomId: string) => void;
}

export const HousekeepingTaskCard: React.FC<HousekeepingTaskCardProps> = ({
  room,
  roomType,
  task,
  lastCheckoutTime,
  onStartCleaning,
  onCompleteCleaning,
}) => {
  const { t, language } = useTranslation();
  const isMarathi = language === 'mr';

  const isBeingCleaned = task?.status === 'in_progress';
  const isNeedsCleaning = room.status === 'cleaning' && !isBeingCleaned;
  const isReady = room.status === 'available';
  const isMaintenance = room.status === 'maintenance' || room.status === 'out_of_service';

  let statusBg = 'bg-amber-50 border-amber-300';
  let badgeBg = 'bg-amber-100 text-amber-800';
  let statusText = isMarathi ? 'स्वच्छता आवश्यक' : 'Needs Cleaning';

  if (isBeingCleaned) {
    statusBg = 'bg-sky-50 border-sky-300';
    badgeBg = 'bg-sky-100 text-sky-800';
    statusText = isMarathi ? 'स्वच्छता चालू आहे' : 'In Progress';
  } else if (isReady) {
    statusBg = 'bg-emerald-50 border-emerald-300';
    badgeBg = 'bg-emerald-100 text-emerald-800';
    statusText = isMarathi ? 'तयार (Ready)' : 'Ready';
  } else if (isMaintenance) {
    statusBg = 'bg-slate-100 border-slate-300';
    badgeBg = 'bg-slate-200 text-slate-800';
    statusText = isMarathi ? 'दुरुस्ती' : 'Maintenance';
  }

  return (
    <div
      className={`border rounded-xl p-4 transition-all shadow-sm flex flex-col justify-between ${statusBg}`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-slate-900">
              {isMarathi ? 'खोली' : 'Room'} {room.number}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {roomType?.name || 'Standard'}
            </span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeBg}`}
          >
            {statusText}
          </span>
        </div>

        {/* Room & Cleaning Metadata */}
        <div className="space-y-1.5 text-xs text-slate-600 mt-2 mb-4">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {lastCheckoutTime
                ? `${isMarathi ? 'चेक-आउट वेळ' : 'Checked out'}: ${lastCheckoutTime.slice(11, 16)}`
                : `${isMarathi ? 'मजला' : 'Floor'}: ${room.floor}`}
            </span>
          </div>

          {task?.assigned_to && (
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>{isMarathi ? 'कर्मचारी' : 'Assigned to'}: <strong>{task.assigned_to}</strong></span>
            </div>
          )}

          {task?.started_at && isBeingCleaned && (
            <div className="flex items-center gap-1.5 text-sky-700">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isMarathi ? 'सुरू झाले' : 'Started'}: {task.started_at.slice(11, 16)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
        {isNeedsCleaning && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => onStartCleaning(room.id, task?.id)}
            className="w-full bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center gap-1 text-xs min-h-[34px] font-bold"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isMarathi ? 'स्वच्छता सुरू करा' : 'Start Cleaning'}</span>
          </Button>
        )}

        {isBeingCleaned && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => onCompleteCleaning(room.id, task?.id)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1 text-xs min-h-[34px] font-bold"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isMarathi ? 'स्वच्छ झाली ✓ खोली उपलब्ध करा' : 'Mark Ready'}</span>
          </Button>
        )}

        {isReady && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onStartCleaning(room.id, task?.id)}
            className="w-full text-xs text-slate-600 border-slate-300 hover:bg-white min-h-[34px]"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
            <span>{isMarathi ? 'पुन्हा स्वच्छ करा' : 'Clean Again'}</span>
          </Button>
        )}

        {isMaintenance && (
          <div className="w-full py-1 text-center text-xs font-semibold text-slate-500 flex items-center justify-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>{isMarathi ? 'दुरुस्तीचे काम चालू आहे' : 'Under Maintenance'}</span>
          </div>
        )}
      </div>
    </div>
  );
};
