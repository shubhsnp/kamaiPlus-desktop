'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { db } from '@/lib/db';
import { roomRepository } from '@/lib/stay/repositories/roomRepository';
import type { Room, RoomType, HousekeepingTask } from '@/lib/stay/types';
import { HousekeepingTaskCard } from './HousekeepingTaskCard';
import { Sparkles, RefreshCw, CheckCircle2, Clock, Play } from 'lucide-react';
import { showAlert } from '@/lib/ui/dialogs';

export const HousekeepingBoard: React.FC = () => {
  const { t, language } = useTranslation();
  const isMarathi = language === 'mr';
  const business = useBusiness();
  const businessId = business?.id || 'default';

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<Map<string, RoomType>>(new Map());
  const [tasks, setTasks] = useState<Map<string, HousekeepingTask>>(new Map());
  const [lastCheckouts, setLastCheckouts] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<'all' | 'needs_cleaning' | 'in_progress' | 'ready'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const loadHousekeepingData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [allRooms, allTypes, allTasks, checkouts] = await Promise.all([
        roomRepository.findAll(businessId, true),
        db.room_types.where('business_id').equals(businessId).toArray(),
        db.stay_housekeeping.where('business_id').equals(businessId).toArray(),
        db.stay_records
          .where('business_id')
          .equals(businessId)
          .and((r) => r.status === 'checked_out' && Boolean(r.actual_check_out))
          .toArray(),
      ]);

      setRooms(allRooms);

      // Types map
      const typeMap = new Map<string, RoomType>();
      allTypes.forEach((rt) => typeMap.set(rt.id, rt));
      setRoomTypes(typeMap);

      // Tasks map by room_id (latest task)
      const taskMap = new Map<string, HousekeepingTask>();
      allTasks.forEach((tsk) => {
        const existing = taskMap.get(tsk.room_id);
        if (!existing || new Date(tsk.created_at) > new Date(existing.created_at)) {
          taskMap.set(tsk.room_id, tsk);
        }
      });
      setTasks(taskMap);

      // Checkout timestamps map
      const coMap = new Map<string, string>();
      checkouts.forEach((sr) => {
        if (sr.actual_check_out) {
          coMap.set(sr.room_id, sr.actual_check_out);
        }
      });
      setLastCheckouts(coMap);
    } catch (err) {
      console.error('Failed to load housekeeping data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadHousekeepingData();
  }, [loadHousekeepingData]);

  // Start cleaning handler
  const handleStartCleaning = async (roomId: string, taskId?: string) => {
    try {
      const now = new Date().toISOString();
      await roomRepository.updateStatus(roomId, 'cleaning');

      if (taskId) {
        await db.stay_housekeeping.update(taskId, {
          status: 'in_progress',
          started_at: now,
          updated_at: now,
        });
      } else {
        const newTask: HousekeepingTask = {
          id: crypto.randomUUID(),
          business_id: businessId,
          room_id: roomId,
          task_type: 'checkout_clean',
          status: 'in_progress',
          scheduled_date: now.slice(0, 10),
          started_at: now,
          created_at: now,
          updated_at: now,
          sync_status: 'pending',
        };
        await db.stay_housekeeping.add(newTask);
      }

      await loadHousekeepingData();
    } catch (err: unknown) {
      console.error('Error starting cleaning:', err);
      await showAlert(err instanceof Error ? err.message : t('Failed to update cleaning status.'));
    }
  };

  // Complete cleaning handler - marks room available
  const handleCompleteCleaning = async (roomId: string, taskId?: string) => {
    try {
      const now = new Date().toISOString();
      await roomRepository.updateStatus(roomId, 'available');

      if (taskId) {
        await db.stay_housekeeping.update(taskId, {
          status: 'done',
          completed_at: now,
          updated_at: now,
        });
      }

      await loadHousekeepingData();
    } catch (err: unknown) {
      console.error('Error completing cleaning:', err);
      await showAlert(err instanceof Error ? err.message : t('Failed to complete cleaning.'));
    }
  };

  // Filter rooms
  const filteredRooms = rooms.filter((r) => {
    const task = tasks.get(r.id);
    const isBeingCleaned = task?.status === 'in_progress';
    const isNeedsCleaning = r.status === 'cleaning' && !isBeingCleaned;
    const isReady = r.status === 'available';

    if (filter === 'needs_cleaning') return isNeedsCleaning;
    if (filter === 'in_progress') return isBeingCleaned;
    if (filter === 'ready') return isReady;
    return true;
  });

  // Count summaries
  const needsCleaningCount = rooms.filter(
    (r) => r.status === 'cleaning' && tasks.get(r.id)?.status !== 'in_progress'
  ).length;
  const inProgressCount = rooms.filter(
    (r) => tasks.get(r.id)?.status === 'in_progress'
  ).length;
  const readyCount = rooms.filter((r) => r.status === 'available').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-sky-600" />
            <span>{isMarathi ? 'हाउसकीपिंग आणि स्वच्छता बोर्ड (Housekeeping)' : 'Housekeeping Operations Board'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isMarathi
              ? 'खोल्यांची स्वच्छता स्थिती तपासा, काम सुरू करा आणि पूर्ण झाल्यावर खोली उपलब्ध करा'
              : 'Track room cleanliness, assign tasks, and mark rooms ready for arrival'}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadHousekeepingData}
          isLoading={isLoading}
          className="flex items-center gap-1.5 min-h-[38px]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isMarathi ? 'रिफ्रेश' : 'Refresh'}</span>
        </Button>
      </div>

      {/* Summary Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`p-3 rounded-xl border text-left transition cursor-pointer ${
            filter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
            {isMarathi ? 'सर्व खोल्या' : 'All Rooms'}
          </div>
          <div className="text-2xl font-black font-mono mt-1">{rooms.length}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilter('needs_cleaning')}
          className={`p-3 rounded-xl border text-left transition cursor-pointer ${
            filter === 'needs_cleaning'
              ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
              : 'bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-100'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-90 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{isMarathi ? 'स्वच्छता आवश्यक' : 'Needs Cleaning'}</span>
          </div>
          <div className="text-2xl font-black font-mono mt-1">{needsCleaningCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilter('in_progress')}
          className={`p-3 rounded-xl border text-left transition cursor-pointer ${
            filter === 'in_progress'
              ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
              : 'bg-sky-50/70 border-sky-200 text-sky-900 hover:bg-sky-100'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-90 flex items-center gap-1">
            <Play className="w-3.5 h-3.5" />
            <span>{isMarathi ? 'स्वच्छता चालू आहे' : 'Cleaning In Progress'}</span>
          </div>
          <div className="text-2xl font-black font-mono mt-1">{inProgressCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilter('ready')}
          className={`p-3 rounded-xl border text-left transition cursor-pointer ${
            filter === 'ready'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-90 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isMarathi ? 'तयार खोल्या (Ready)' : 'Ready for Guests'}</span>
          </div>
          <div className="text-2xl font-black font-mono mt-1">{readyCount}</div>
        </button>
      </div>

      {/* Task Cards Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-sm font-semibold text-slate-500">
          {isMarathi ? 'हाउसकीपिंग डेटा लोड करत आहे...' : 'Loading housekeeping tasks...'}
        </div>
      ) : filteredRooms.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700">
            {isMarathi ? 'या फिल्टरमध्ये कोणतीही खोली नाही' : 'No rooms in this view'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {isMarathi ? 'सर्व खोल्या स्वच्छ आणि पाहुण्यांसाठी सज्ज आहेत!' : 'All rooms are inspected and clean!'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredRooms.map((room) => {
            const rt = roomTypes.get(room.room_type_id);
            const task = tasks.get(room.id);
            const coTime = lastCheckouts.get(room.id);

            return (
              <HousekeepingTaskCard
                key={room.id}
                room={room}
                roomType={rt}
                task={task}
                lastCheckoutTime={coTime}
                onStartCleaning={handleStartCleaning}
                onCompleteCleaning={handleCompleteCleaning}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
