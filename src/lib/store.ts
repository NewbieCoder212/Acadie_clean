import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChecklistItem {
  key: string;
  labelEn: string;
  labelFr: string;
  checked: boolean;
  section?: string;
}

export type CleaningStatus = 'complete' | 'attention_required';

export interface CleaningLog {
  id: string;
  locationId: string;
  timestamp: number;
  staffName: string;
  checklist: {
    handwashingStation: boolean;
    toiletPaper: boolean;
    bins: boolean;
    surfacesDisinfected: boolean;
    fixtures: boolean;
    waterTemperature: boolean;
    floors: boolean;
    ventilationLighting: boolean;
  };
  maintenanceNotes: string;
  status: CleaningStatus;
  resolved?: boolean;
  resolvedAt?: number;
}

export interface WashroomLocation {
  id: string;
  name: string;
  createdAt: number;
  supervisorEmail?: string;
  pinHash?: string; // Hashed 4-digit PIN for staff access (legacy)
  pinCode?: string; // Plain 4-digit PIN for display in manager dashboard
  businessName?: string;
  isActive?: boolean;
}

// Section headers for grouping checklist items
export interface ChecklistSection {
  id: string;
  titleEn: string;
  titleFr: string;
}

export const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    id: 'supplies',
    titleEn: '1. Supplies & Restocking (Hygiene & Handwashing)',
    titleFr: 'Approvisionnement et réapprovisionnement (hygiène et lavage des mains)',
  },
  {
    id: 'sanitization',
    titleEn: '2. Sanitization (Infection Control)',
    titleFr: 'Désinfection (contrôle des infections)',
  },
  {
    id: 'facility',
    titleEn: '3. Facility & Safety (Compliance)',
    titleFr: 'Installations et sécurité (conformité)',
  },
];

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  // Section 1: Supplies & Restocking
  {
    key: 'handwashingStation',
    labelEn: 'Handwashing Station: Liquid/Powder soap is full; paper towels or air dryer are functional.',
    labelFr: 'Poste de lavage des mains : Le savon liquide ou en poudre est plein ; les essuie-tout ou le sèche-mains sont fonctionnels.',
    checked: false,
    section: 'supplies',
  },
  {
    key: 'toiletPaper',
    labelEn: 'Toilet Paper: All dispensers are stocked with at least one backup roll.',
    labelFr: 'Papier hygiénique : Tous les distributeurs sont approvisionnés avec au moins un rouleau de secours.',
    checked: false,
    section: 'supplies',
  },
  {
    key: 'bins',
    labelEn: 'Bins: Covered disposal bin in stalls is emptied and sanitized.',
    labelFr: 'Poubelles : Le bac d\'élimination couvert dans les cabines est vidé et désinfecté.',
    checked: false,
    section: 'supplies',
  },
  // Section 2: Sanitization
  {
    key: 'surfacesDisinfected',
    labelEn: 'Surfaces Disinfected: All high-touch points (faucets, flush handles, stall locks, grab bars) have been cleaned with a DIN-registered disinfectant.',
    labelFr: 'Surfaces désinfectées : Tous les points de contact fréquents (robinets, poignées de chasse d\'eau, verrous de cabine, barres d\'appui) ont été nettoyés avec un désinfectant homologué (DIN).',
    checked: false,
    section: 'sanitization',
  },
  {
    key: 'fixtures',
    labelEn: 'Fixtures: Sinks, toilets, and urinals are scrubbed and free of visible scale/waste.',
    labelFr: 'Installations : Les éviers, les toilettes et les urinoirs sont récurés et exempts de tartre ou de déchets visibles.',
    checked: false,
    section: 'sanitization',
  },
  // Section 3: Facility & Safety
  {
    key: 'waterTemperature',
    labelEn: 'Water Temperature: Confirmed hot water is functional (must be between 35°C and 43°C).',
    labelFr: 'Température de l\'eau : Confirmation que l\'eau chaude est fonctionnelle (doit être entre 35 °C et 43 °C)',
    checked: false,
    section: 'facility',
  },
  {
    key: 'floors',
    labelEn: 'Floors: Swept and mopped; confirmed dry and free of trip hazards.',
    labelFr: 'Planchers : Balayés et lavés ; confirmés secs et sans risque de trébuchement.',
    checked: false,
    section: 'facility',
  },
  {
    key: 'ventilationLighting',
    labelEn: 'Ventilation & Lighting: Exhaust fan is running and all light bulbs are functional.',
    labelFr: 'Ventilation et éclairage : Le ventilateur d\'extraction fonctionne et toutes les ampoules sont fonctionnelles.',
    checked: false,
    section: 'facility',
  },
];

interface AddCleaningLogParams {
  locationId: string;
  staffName: string;
  checklist: CleaningLog['checklist'];
  maintenanceNotes: string;
  status: CleaningStatus;
}

interface StoreState {
  locations: WashroomLocation[];
  cleaningLogs: CleaningLog[];
  managerPasswordHash: string | null;
  isManagerAuthenticated: boolean;
  addLocation: (name: string, supervisorEmail?: string, pinHash?: string, pinCode?: string) => string;
  addTestLocation: () => void;
  updateLocationEmail: (id: string, supervisorEmail: string) => void;
  updateLocationPin: (id: string, pinHash: string) => void;
  deleteLocation: (id: string) => void;
  addCleaningLog: (params: AddCleaningLogParams) => void;
  resolveLog: (logId: string) => void;
  getLogsForLocation: (locationId: string) => CleaningLog[];
  getLocationById: (id: string) => WashroomLocation | undefined;
  setManagerPasswordHash: (hash: string) => void;
  getManagerPasswordHash: () => string | null;
  setManagerAuthenticated: (authenticated: boolean) => void;
  logoutManager: () => void;
  getLogs6Months: (locationId: string) => CleaningLog[];
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      locations: [],
      cleaningLogs: [],
      managerPasswordHash: null,
      isManagerAuthenticated: false,

      addLocation: (name: string, supervisorEmail?: string, pinHash?: string, pinCode?: string) => {
        const id = generateId();
        const newLocation: WashroomLocation = {
          id,
          name,
          createdAt: Date.now(),
          supervisorEmail,
          pinHash,
          pinCode,
        };
        set((state) => ({
          locations: [...state.locations, newLocation],
        }));
        return id;
      },

      addTestLocation: () => {
        const testLocation: WashroomLocation = {
          id: '999',
          name: 'TEST - Lab Location',
          createdAt: Date.now(),
          supervisorEmail: 'sportsfansummer@hotmail.com',
        };
        set((state) => {
          // Remove existing test location if exists, then add fresh one
          const filteredLocations = state.locations.filter((loc) => loc.id !== '999');
          return {
            locations: [...filteredLocations, testLocation],
          };
        });
      },

      updateLocationEmail: (id: string, supervisorEmail: string) => {
        set((state) => ({
          locations: state.locations.map((loc) =>
            loc.id === id ? { ...loc, supervisorEmail } : loc
          ),
        }));
      },

      updateLocationPin: (id: string, pinHash: string) => {
        set((state) => ({
          locations: state.locations.map((loc) =>
            loc.id === id ? { ...loc, pinHash } : loc
          ),
        }));
      },

      deleteLocation: (id: string) => {
        set((state) => ({
          locations: state.locations.filter((loc) => loc.id !== id),
          cleaningLogs: state.cleaningLogs.filter((log) => log.locationId !== id),
        }));
      },

      addCleaningLog: (params: AddCleaningLogParams) => {
        const newLog: CleaningLog = {
          id: generateId(),
          locationId: params.locationId,
          timestamp: Date.now(),
          staffName: params.staffName,
          checklist: params.checklist,
          maintenanceNotes: params.maintenanceNotes,
          status: params.status,
        };
        set((state) => ({
          cleaningLogs: [...state.cleaningLogs, newLog],
        }));
      },

      resolveLog: (logId: string) => {
        set((state) => ({
          cleaningLogs: state.cleaningLogs.map((log) =>
            log.id === logId
              ? { ...log, resolved: true, resolvedAt: Date.now() }
              : log
          ),
        }));
      },

      getLogsForLocation: (locationId: string) => {
        return get()
          .cleaningLogs.filter((log) => log.locationId === locationId)
          .sort((a, b) => b.timestamp - a.timestamp);
      },

      getLocationById: (id: string) => {
        return get().locations.find((loc) => loc.id === id);
      },

      setManagerPasswordHash: (hash: string) => {
        set({ managerPasswordHash: hash });
      },

      getManagerPasswordHash: () => {
        return get().managerPasswordHash;
      },

      setManagerAuthenticated: (authenticated: boolean) => {
        set({ isManagerAuthenticated: authenticated });
      },

      logoutManager: () => {
        set({ isManagerAuthenticated: false });
      },

      getLogs6Months: (locationId: string) => {
        const sixMonthsAgo = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;
        return get()
          .cleaningLogs.filter(
            (log) => log.locationId === locationId && log.timestamp >= sixMonthsAgo
          )
          .sort((a, b) => b.timestamp - a.timestamp);
      },
    }),
    {
      name: 'acadia-clean-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
