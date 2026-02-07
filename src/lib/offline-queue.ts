import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { insertCleaningLog, InsertCleaningLog } from './supabase';

export interface PendingLog extends InsertCleaningLog {
  _offlineId: string;
  _createdAt: number;
  _syncAttempts: number;
  _lastAttempt?: number;
}

interface OfflineQueueState {
  pendingLogs: PendingLog[];
  isSyncing: boolean;
  lastSyncAttempt: number | null;

  // Actions
  addPendingLog: (log: InsertCleaningLog) => string;
  removePendingLog: (offlineId: string) => void;
  markSyncing: (syncing: boolean) => void;
  incrementAttempt: (offlineId: string) => void;
  getPendingCount: () => number;
  getPendingForLocation: (locationId: string) => PendingLog[];
  syncPendingLogs: () => Promise<{ synced: number; failed: number }>;
}

const generateOfflineId = () => `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export const useOfflineQueue = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      pendingLogs: [],
      isSyncing: false,
      lastSyncAttempt: null,

      addPendingLog: (log: InsertCleaningLog) => {
        const offlineId = generateOfflineId();
        const pendingLog: PendingLog = {
          ...log,
          _offlineId: offlineId,
          _createdAt: Date.now(),
          _syncAttempts: 0,
        };

        set((state) => ({
          pendingLogs: [...state.pendingLogs, pendingLog],
        }));

        console.log('[Offline] Log queued for sync:', offlineId);
        return offlineId;
      },

      removePendingLog: (offlineId: string) => {
        set((state) => ({
          pendingLogs: state.pendingLogs.filter((log) => log._offlineId !== offlineId),
        }));
        console.log('[Offline] Log removed from queue:', offlineId);
      },

      markSyncing: (syncing: boolean) => {
        set({ isSyncing: syncing, lastSyncAttempt: syncing ? Date.now() : get().lastSyncAttempt });
      },

      incrementAttempt: (offlineId: string) => {
        set((state) => ({
          pendingLogs: state.pendingLogs.map((log) =>
            log._offlineId === offlineId
              ? { ...log, _syncAttempts: log._syncAttempts + 1, _lastAttempt: Date.now() }
              : log
          ),
        }));
      },

      getPendingCount: () => {
        return get().pendingLogs.length;
      },

      getPendingForLocation: (locationId: string) => {
        return get().pendingLogs.filter((log) => log.location_id === locationId);
      },

      syncPendingLogs: async () => {
        const state = get();

        if (state.isSyncing || state.pendingLogs.length === 0) {
          return { synced: 0, failed: 0 };
        }

        // Check connectivity first
        const netState = await NetInfo.fetch();
        if (!netState.isConnected) {
          console.log('[Offline] No connectivity, skipping sync');
          return { synced: 0, failed: 0 };
        }

        set({ isSyncing: true, lastSyncAttempt: Date.now() });

        let synced = 0;
        let failed = 0;

        // Process logs in order (oldest first)
        const logsToSync = [...state.pendingLogs].sort((a, b) => a._createdAt - b._createdAt);

        for (const pendingLog of logsToSync) {
          try {
            // Extract only the fields needed for Supabase (remove offline metadata)
            const logData: InsertCleaningLog = {
              location_id: pendingLog.location_id,
              location_name: pendingLog.location_name,
              staff_name: pendingLog.staff_name,
              timestamp: pendingLog.timestamp,
              status: pendingLog.status,
              notes: pendingLog.notes,
              checklist_supplies: pendingLog.checklist_supplies,
              checklist_surfaces: pendingLog.checklist_surfaces,
              checklist_fixtures: pendingLog.checklist_fixtures,
              checklist_trash: pendingLog.checklist_trash,
              checklist_floor: pendingLog.checklist_floor,
              resolved: pendingLog.resolved,
            };

            const result = await insertCleaningLog(logData);

            if (result.success) {
              get().removePendingLog(pendingLog._offlineId);
              synced++;
              console.log('[Offline] Successfully synced:', pendingLog._offlineId);
            } else {
              get().incrementAttempt(pendingLog._offlineId);
              failed++;
              console.log('[Offline] Failed to sync:', pendingLog._offlineId, result.error);
            }
          } catch (error) {
            get().incrementAttempt(pendingLog._offlineId);
            failed++;
            console.error('[Offline] Sync error:', pendingLog._offlineId, error);
          }
        }

        set({ isSyncing: false });
        console.log(`[Offline] Sync complete: ${synced} synced, ${failed} failed`);

        return { synced, failed };
      },
    }),
    {
      name: 'acadia-offline-queue',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Auto-sync when connectivity is restored
let unsubscribeNetInfo: (() => void) | null = null;

export function startOfflineSync() {
  // Skip on web - NetInfo causes constant re-renders and page refreshes on PWA
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    console.log('[Offline] Skipping auto-sync on web (PWA)');
    return;
  }

  if (unsubscribeNetInfo) return; // Already started

  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      console.log('[Offline] Connectivity restored, attempting sync...');
      // Small delay to ensure connection is stable
      setTimeout(() => {
        useOfflineQueue.getState().syncPendingLogs();
      }, 2000);
    }
  });

  // Also try to sync on startup
  setTimeout(() => {
    useOfflineQueue.getState().syncPendingLogs();
  }, 3000);

  console.log('[Offline] Auto-sync listener started');
}

export function stopOfflineSync() {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
    console.log('[Offline] Auto-sync listener stopped');
  }
}
