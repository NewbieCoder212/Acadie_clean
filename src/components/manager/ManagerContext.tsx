import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore, WashroomLocation } from '@/lib/store';
import {
  getLogs6Months as getSupabase6MonthLogs,
  getLogs1Month as getSupabase1MonthLogs,
  getLogs14Days,
  deleteLogsForLocation as supabaseDeleteLogsForLocation,
  deleteWashroom as supabaseDeleteWashroom,
  getLogsForDateRange,
  getLogsForBusinessByName,
  getIssuesForBusinessByName,
  resolveReportedIssue,
  getWashroomsForBusiness,
  updateWashroomAlertEmail,
  toggleWashroomActive,
  updateBusinessAddress,
  updateBusinessGlobalAlertSettings,
  updateBusinessAlertSchedule,
  updateWashroomPin,
  getBusinessManagers,
  inviteUserToBusiness,
  removeUserFromBusiness,
  logoutBusiness,
  validateManagerSession,
  validateBusinessSession,
  CleaningLogRow,
  WashroomRow,
  ReportedIssueRow,
  SafeBusinessRow,
  SafeManagerRow,
  ManagerBusinessAccess,
  ManagerPermissions,
  ManagerRole,
  SubscriptionTier,
  AlertSchedule,
  DEFAULT_ALERT_SCHEDULE,
  ResolutionAction,
  RESOLUTION_ACTIONS,
} from '@/lib/supabase';
import { generatePDFHTML, getCheckIcon, getStatusBadge, truncateText, openPDFInNewWindow, generateIncidentReportsPDF } from '@/lib/pdf-template';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// ============================
// Types
// ============================
export type { WashroomLocation } from '@/lib/store';
export type {
  CleaningLogRow,
  WashroomRow,
  ReportedIssueRow,
  SafeBusinessRow,
  SafeManagerRow,
  ManagerBusinessAccess,
  ManagerPermissions,
  ManagerRole,
  SubscriptionTier,
  AlertSchedule,
  ResolutionAction,
};
export { RESOLUTION_ACTIONS };

export interface ManagerContextType {
  // Auth state
  currentBusiness: SafeBusinessRow | null;
  currentManager: SafeManagerRow | null;
  currentPermissions: ManagerPermissions | null;
  managerBusinesses: ManagerBusinessAccess[];
  isCheckingAuth: boolean;

  // Data
  businessLocations: WashroomRow[];
  displayLocations: WashroomLocation[];
  allLogs: CleaningLogRow[];
  recentLogs: CleaningLogRow[];
  reportedIssues: ReportedIssueRow[];
  openIssues: ReportedIssueRow[];
  isLoadingLogs: boolean;

  // Business info
  businessName: string;
  businessAddress: string;
  subscriptionTier: SubscriptionTier;
  isPremium: boolean;

  // Global alert state
  globalAlertEmails: string[];
  useGlobalAlerts: boolean;

  // Per-day alert schedule
  alertSchedule: AlertSchedule;

  // Helpers
  canPerformAction: (action: keyof ManagerPermissions) => boolean;
  getLocationStatus: (locationId: string) => 'clean' | 'attention' | 'issue' | 'unknown';
  getLocationUrl: (locationId: string) => string;
  formatDateTime: (timestamp: string) => string;
  formatTimeAgo: (timestamp: string) => string;

  // Actions
  handleRefreshData: () => void;
  handleLogout: () => Promise<void>;
  handleSwitchBusiness: (businessAccess: ManagerBusinessAccess) => Promise<void>;
  handleResolveIssue: (issueId: string, action?: ResolutionAction, issue?: ReportedIssueRow) => Promise<void>;
  handleSaveAlertEmail: (locationId: string, email: string) => Promise<void>;
  handleToggleLocationActive: (location: WashroomLocation) => void;
  handleDeleteLocation: (location: WashroomLocation) => void;
  handleSaveBusinessAddress: (address: string) => Promise<void>;
  handleSaveGlobalAlertSettings: (emails: string[], useGlobal: boolean) => Promise<void>;
  handleSaveAlertSchedule: (schedule: AlertSchedule) => Promise<void>;
  handleSaveStaffPin: (locationId: string, pin: string) => Promise<void>;
  handleExport: (locationId: string) => Promise<void>;
  handlePremiumExport: (locationId: string, locationName: string, startDate: Date, endDate: Date) => Promise<void>;
  handleExportIncidentReports: (startDate: Date, endDate: Date, includeOpen: boolean) => Promise<void>;
  generateAuditReportPDF: (businessNameInput: string, startDate: Date, endDate: Date) => Promise<void>;
  handleView14Days: (locationId: string) => Promise<{ logs: CleaningLogRow[]; locationName: string }>;
  handleViewPublicPage: (locationId: string) => void;
  handleCopyUrl: (url: string) => Promise<void>;
  handleInviteUser: (email: string, name: string, role: ManagerRole) => Promise<boolean>;
  handleRemoveUser: (targetManagerId: string, targetName: string | null) => void;
  loadTeamMembers: () => Promise<(SafeManagerRow & { role: ManagerRole; permissions: ManagerPermissions })[]>;

  // Setters needed by children
  setCurrentBusiness: (business: SafeBusinessRow | null) => void;
  setBusinessLocations: React.Dispatch<React.SetStateAction<WashroomRow[]>>;
  setBusinessName: (name: string) => void;
  setBusinessAddress: (addr: string) => void;
  setGlobalAlertEmails: React.Dispatch<React.SetStateAction<string[]>>;
  setUseGlobalAlerts: React.Dispatch<React.SetStateAction<boolean>>;

  // Loading states
  resolvingIssueId: string | null;
  exportingId: string | null;
}

const ManagerContext = createContext<ManagerContextType | null>(null);

export function useManagerContext() {
  const ctx = useContext(ManagerContext);
  if (!ctx) throw new Error('useManagerContext must be used within ManagerProvider');
  return ctx;
}

// ============================
// Provider
// ============================
export function ManagerProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  // Business authentication state
  const [currentBusiness, setCurrentBusiness] = useState<SafeBusinessRow | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [businessLocations, setBusinessLocations] = useState<WashroomRow[]>([]);
  const [allLogs, setAllLogs] = useState<CleaningLogRow[]>([]);
  const [reportedIssues, setReportedIssues] = useState<ReportedIssueRow[]>([]);
  const [resolvingIssueId, setResolvingIssueId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Manager multi-tenant state
  const [currentManager, setCurrentManager] = useState<SafeManagerRow | null>(null);
  const [managerBusinesses, setManagerBusinesses] = useState<ManagerBusinessAccess[]>([]);
  const [currentPermissions, setCurrentPermissions] = useState<ManagerPermissions | null>(null);

  // Global Alert Settings state
  const [globalAlertEmails, setGlobalAlertEmails] = useState<string[]>([]);
  const [useGlobalAlerts, setUseGlobalAlerts] = useState(false);
  const [alertSchedule, setAlertSchedule] = useState<AlertSchedule>(DEFAULT_ALERT_SCHEDULE);

  // Business info
  const [businessName, setBusinessName] = useState('Acadia Facilities');
  const [businessAddress, setBusinessAddress] = useState('');

  // Zustand store
  const isAuthenticated = useStore((s) => s.isManagerAuthenticated);
  const locations = useStore((s) => s.locations);
  const deleteLocation = useStore((s) => s.deleteLocation);
  const logoutManager = useStore((s) => s.logoutManager);

  const subscriptionTier: SubscriptionTier = currentBusiness?.subscription_tier || 'standard';
  const isPremium = subscriptionTier === 'premium';

  // Determine which locations to display
  const displayLocations: WashroomLocation[] = currentBusiness
    ? businessLocations.map(loc => ({
        id: loc.id,
        name: loc.room_name,
        businessName: loc.business_name,
        pinCode: loc.pin_display || loc.pin_code,
        supervisorEmail: loc.alert_email ?? undefined,
        isActive: loc.is_active,
        createdAt: new Date(loc.created_at).getTime(),
      }))
    : locations;

  const getLocationStatus = useCallback((locationId: string): 'clean' | 'attention' | 'issue' | 'unknown' => {
    // Check for open issues reported after the last cleaning (same logic as public page)
    const locationIssues = reportedIssues.filter(
      issue => issue.location_id === locationId && issue.status === 'open'
    );
    const locationLogs = allLogs.filter(log => log.location_id === locationId);
    const lastLog = locationLogs[0];

    if (locationIssues.length > 0) {
      const mostRecentIssue = locationIssues[0];
      const issueAfterCleaning = !lastLog ||
        new Date(mostRecentIssue.created_at).getTime() > new Date(lastLog.timestamp).getTime();
      if (issueAfterCleaning) return 'issue';
    }

    if (locationLogs.length === 0) return 'unknown';
    if (lastLog.status === 'attention_required' && !lastLog.resolved) return 'attention';
    return 'clean';
  }, [allLogs, reportedIssues]);

  const openIssues = useMemo(() => {
    return reportedIssues.filter(issue => issue.status === 'open');
  }, [reportedIssues]);

  const recentLogs = useMemo(() => {
    return allLogs.slice(0, 10);
  }, [allLogs]);

  const canPerformAction = useCallback((action: keyof ManagerPermissions): boolean => {
    if (!currentPermissions) return true;
    return currentPermissions[action] === true;
  }, [currentPermissions]);

  const getLocationUrl = useCallback((locationId: string) => {
    const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://app.acadiacleaniq.ca';
    return `${baseUrl}/washroom/${locationId}?scan=true`;
  }, []);

  const formatDateTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }, []);

  const formatTimeAgo = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }, []);

  // ============================
  // Auth
  // ============================
  useEffect(() => {
    checkBusinessAuth();
  }, []);

  const checkBusinessAuth = async () => {
    setIsCheckingAuth(true);
    try {
      const managerStored = await AsyncStorage.getItem('currentManager');
      const businessAccessStored = await AsyncStorage.getItem('selectedBusinessAccess');
      const businessesStored = await AsyncStorage.getItem('managerBusinesses');

      if (managerStored) {
        try {
          const manager = JSON.parse(managerStored) as SafeManagerRow;
          const validation = await validateManagerSession(manager.id);
          if (!validation.valid) {
            await AsyncStorage.multiRemove(['currentManager', 'selectedBusinessAccess', 'managerBusinesses', 'currentBusiness', 'sessionTimestamp']);
            Alert.alert('Session Expired', validation.error || 'Please log in again.');
            router.replace('/login');
            return;
          }
          setCurrentManager(validation.manager || manager);
          if (businessesStored) {
            setManagerBusinesses(JSON.parse(businessesStored) as ManagerBusinessAccess[]);
          }
          if (businessAccessStored) {
            const businessAccess = JSON.parse(businessAccessStored) as ManagerBusinessAccess;
            setCurrentPermissions(businessAccess.permissions);
          }
        } catch (parseError) {
          await AsyncStorage.multiRemove(['currentManager', 'selectedBusinessAccess', 'managerBusinesses']);
        }
      }

      const stored = await AsyncStorage.getItem('currentBusiness');
      if (stored) {
        try {
          const business = JSON.parse(stored) as SafeBusinessRow;
          if (business?.id && business?.name) {
            const businessValidation = await validateBusinessSession(business.id);
            if (!businessValidation.valid) {
              await AsyncStorage.multiRemove(['currentBusiness', 'currentManager', 'selectedBusinessAccess', 'managerBusinesses', 'sessionTimestamp']);
              Alert.alert('Account Deactivated', businessValidation.error || 'Please contact support.');
              router.replace('/login');
              return;
            }
            const refreshedBusiness = businessValidation.business!;
            await AsyncStorage.setItem('currentBusiness', JSON.stringify(refreshedBusiness));
            setCurrentBusiness(refreshedBusiness);
            setBusinessName(refreshedBusiness.name);
            setBusinessAddress(refreshedBusiness.address || '');
            setGlobalAlertEmails(refreshedBusiness.global_alert_emails || []);
            setUseGlobalAlerts(refreshedBusiness.use_global_alerts || false);
            setAlertSchedule(refreshedBusiness.alert_schedule || DEFAULT_ALERT_SCHEDULE);
            const washroomsResult = await getWashroomsForBusiness(refreshedBusiness.name);
            if (washroomsResult.success && washroomsResult.data) {
              setBusinessLocations(washroomsResult.data);
            }
          }
        } catch (parseError) {
          await AsyncStorage.removeItem('currentBusiness');
        }
      }
    } catch (error) {
      // Storage error
    }
    setIsCheckingAuth(false);
  };

  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated || currentBusiness) {
      fetchAllData();
    }
  }, [isAuthenticated, currentBusiness]);

  const fetchAllData = async () => {
    setIsLoadingLogs(true);
    try {
      if (currentBusiness && !currentBusiness.is_admin) {
        const [logsResult, issuesResult] = await Promise.all([
          getLogsForBusinessByName(currentBusiness.name),
          getIssuesForBusinessByName(currentBusiness.name),
        ]);
        if (logsResult.success && logsResult.data) setAllLogs(logsResult.data);
        if (issuesResult.success && issuesResult.data) setReportedIssues(issuesResult.data);
      } else {
        const logsResult = await getSupabase6MonthLogs('');
        if (logsResult.success && logsResult.data) setAllLogs(logsResult.data);
      }
    } catch (error) {
      console.error('[Manager] Error fetching data:', error);
    }
    setIsLoadingLogs(false);
  };

  // ============================
  // Actions
  // ============================
  const handleRefreshData = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      if (currentBusiness && !currentBusiness.is_admin) {
        const [logsResult, issuesResult, washroomsResult] = await Promise.all([
          getLogsForBusinessByName(currentBusiness.name),
          getIssuesForBusinessByName(currentBusiness.name),
          getWashroomsForBusiness(currentBusiness.name),
        ]);
        if (logsResult.success && logsResult.data) setAllLogs(logsResult.data);
        if (issuesResult.success && issuesResult.data) setReportedIssues(issuesResult.data);
        if (washroomsResult.success && washroomsResult.data) setBusinessLocations(washroomsResult.data);
      } else {
        const logsResult = await getSupabase6MonthLogs('');
        if (logsResult.success && logsResult.data) setAllLogs(logsResult.data);
      }
    } catch (error) {
      console.error('[Manager] Error refreshing data:', error);
    }
    setIsLoadingLogs(false);
  }, [currentBusiness]);

  const handleLogout = useCallback(async () => {
    await logoutBusiness();
    await AsyncStorage.multiRemove([
      'currentBusiness', 'currentManager', 'selectedBusinessAccess',
      'managerBusinesses', 'sessionTimestamp',
    ]);
    setCurrentBusiness(null);
    setCurrentManager(null);
    setManagerBusinesses([]);
    setCurrentPermissions(null);
    logoutManager();
    router.replace('/');
  }, [logoutManager, router]);

  const handleSwitchBusiness = useCallback(async (businessAccess: ManagerBusinessAccess) => {
    try {
      await AsyncStorage.setItem('currentBusiness', JSON.stringify(businessAccess.business));
      await AsyncStorage.setItem('selectedBusinessAccess', JSON.stringify(businessAccess));
      setCurrentBusiness(businessAccess.business);
      setCurrentPermissions(businessAccess.permissions);
      setBusinessName(businessAccess.business.name);
      setBusinessAddress(businessAccess.business.address || '');
      setGlobalAlertEmails(businessAccess.business.global_alert_emails || []);
      setUseGlobalAlerts(businessAccess.business.use_global_alerts || false);
      setAlertSchedule(businessAccess.business.alert_schedule || DEFAULT_ALERT_SCHEDULE);
      const washroomsResult = await getWashroomsForBusiness(businessAccess.business.name);
      if (washroomsResult.success && washroomsResult.data) {
        setBusinessLocations(washroomsResult.data);
      }
      fetchAllData();
    } catch (error) {
      console.error('[Manager] Error switching business:', error);
    }
  }, []);

  const handleResolveIssue = useCallback(async (
    issueId: string,
    action?: ResolutionAction,
    issue?: ReportedIssueRow
  ) => {
    setResolvingIssueId(issueId);
    try {
      // Get the manager/business name for the log
      const resolvedBy = currentManager?.name || currentBusiness?.name || 'Manager';

      const result = await resolveReportedIssue(issueId, {
        action,
        locationId: issue?.location_id,
        locationName: issue?.location_name,
        resolvedBy,
      });

      if (result.success) {
        setReportedIssues(prev =>
          prev.map(i =>
            i.id === issueId
              ? { ...i, status: 'resolved' as const, resolved_at: new Date().toISOString() }
              : i
          )
        );

        // If a cleaning log was created, refresh the logs to show in dashboard
        if (action?.createsLog && currentBusiness?.name) {
          // Refresh logs to show the new entry
          const logsResult = await getLogsForBusinessByName(currentBusiness.name);
          if (logsResult.success && logsResult.data) {
            setAllLogs(logsResult.data);
          }
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to resolve issue');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setResolvingIssueId(null);
    }
  }, [currentManager, currentBusiness, businessName]);

  const handleSaveAlertEmail = useCallback(async (locationId: string, email: string) => {
    const result = await updateWashroomAlertEmail(locationId, email);
    if (result.success) {
      setBusinessLocations(prev => prev.map(w =>
        w.id === locationId ? { ...w, alert_email: email } : w
      ));
      Alert.alert('Success', 'Alert email updated successfully');
    } else {
      Alert.alert('Error', result.error || 'Failed to update alert email');
    }
  }, []);

  const handleToggleLocationActive = useCallback((location: WashroomLocation) => {
    const newStatus = !location.isActive;
    const actionText = newStatus ? 'activate' : 'deactivate';
    Alert.alert(
      `${newStatus ? 'Activate' : 'Deactivate'} Location`,
      `Are you sure you want to ${actionText} "${location.name}"?\n\n${!newStatus ? 'This location will no longer appear in the cleaning app.' : 'This location will appear in the cleaning app again.'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newStatus ? 'Activate' : 'Deactivate',
          style: newStatus ? 'default' : 'destructive',
          onPress: async () => {
            const result = await toggleWashroomActive(location.id, newStatus);
            if (result.success) {
              setBusinessLocations(prev => prev.map(w =>
                w.id === location.id ? { ...w, is_active: newStatus } : w
              ));
            } else {
              Alert.alert('Error', result.error || 'Failed to update location status');
            }
          },
        },
      ]
    );
  }, []);

  const handleDeleteLocation = useCallback((location: WashroomLocation) => {
    Alert.alert(
      'Delete Location',
      `Are you sure you want to delete "${location.name}"?\n\nThis will permanently delete all cleaning logs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await supabaseDeleteLogsForLocation(location.id);
              await supabaseDeleteWashroom(location.id);
              deleteLocation(location.id);
              setBusinessLocations(prev => prev.filter(w => w.id !== location.id));
              setAllLogs(prev => prev.filter(log => log.location_id !== location.id));
              Alert.alert('Success', `"${location.name}" has been deleted.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete location.');
            }
          },
        },
      ]
    );
  }, [deleteLocation]);

  const handleSaveBusinessAddress = useCallback(async (address: string) => {
    if (!currentBusiness?.id) return;
    const result = await updateBusinessAddress(currentBusiness.id, address);
    if (result.success) {
      const updatedBusiness = { ...currentBusiness, address };
      await AsyncStorage.setItem('currentBusiness', JSON.stringify(updatedBusiness));
      setCurrentBusiness(updatedBusiness);
      setBusinessAddress(address);
      Alert.alert('Success', 'Business address saved!\nAdresse enregistrée!');
    } else {
      Alert.alert('Error', result.error || 'Failed to save address');
    }
  }, [currentBusiness]);

  const handleSaveGlobalAlertSettings = useCallback(async (emails: string[], useGlobal: boolean) => {
    if (!currentBusiness?.id) return;
    const result = await updateBusinessGlobalAlertSettings(currentBusiness.id, {
      global_alert_emails: emails,
      use_global_alerts: useGlobal,
    });
    if (result.success) {
      const updatedBusiness = {
        ...currentBusiness,
        global_alert_emails: emails,
        use_global_alerts: useGlobal,
      };
      await AsyncStorage.setItem('currentBusiness', JSON.stringify(updatedBusiness));
      setCurrentBusiness(updatedBusiness);
      setGlobalAlertEmails(emails);
      setUseGlobalAlerts(useGlobal);
      Alert.alert('Success', 'Alert settings saved!\nParamètres d\'alerte enregistrés!');
    } else {
      Alert.alert('Error', result.error || 'Failed to save alert settings');
    }
  }, [currentBusiness]);

  const handleSaveAlertSchedule = useCallback(async (schedule: AlertSchedule) => {
    if (!currentBusiness?.id) return;
    const result = await updateBusinessAlertSchedule(currentBusiness.id, schedule);
    if (result.success) {
      const updatedBusiness = { ...currentBusiness, alert_schedule: schedule };
      await AsyncStorage.setItem('currentBusiness', JSON.stringify(updatedBusiness));
      setCurrentBusiness(updatedBusiness);
      setAlertSchedule(schedule);
      Alert.alert('Success', 'Business hours schedule saved!\nHoraire enregistré!');
    } else {
      Alert.alert('Error', result.error || 'Failed to save schedule');
    }
  }, [currentBusiness]);

  const handleSaveStaffPin = useCallback(async (locationId: string, pin: string) => {
    const result = await updateWashroomPin(locationId, pin);
    if (result.success) {
      if (currentBusiness) {
        const washroomsResult = await getWashroomsForBusiness(currentBusiness.name);
        if (washroomsResult.success && washroomsResult.data) {
          setBusinessLocations(washroomsResult.data);
        }
      }
      Alert.alert('Success', 'PIN updated for this location!\nNIP mis à jour pour cet emplacement!');
    } else {
      Alert.alert('Error', result.error || 'Failed to update PIN');
    }
  }, [currentBusiness]);

  const handleExport = useCallback(async (locationId: string) => {
    try {
      setExportingId(locationId);
      const location = displayLocations.find(l => l.id === locationId);
      if (!location) return;
      const result = await getSupabase1MonthLogs(locationId);
      if (!result.success || !result.data || result.data.length === 0) {
        Alert.alert('No Data', 'No cleaning logs found for the past 30 days');
        setExportingId(null);
        return;
      }
      const businessDisplayName = currentBusiness?.name || 'Acadia Clean';
      const logs = result.data;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const tableRows = logs.map(log => `
        <tr>
          <td>${formatDateTime(log.timestamp)}</td>
          <td>${truncateText(log.staff_name, 15)}</td>
          <td style="text-align: center;">${getCheckIcon(log.checklist_supplies)}</td>
          <td style="text-align: center;">${getCheckIcon(log.checklist_trash)}</td>
          <td style="text-align: center;">${getCheckIcon(log.checklist_surfaces)}</td>
          <td style="text-align: center;">${getCheckIcon(log.checklist_fixtures)}</td>
          <td style="text-align: center;">${getCheckIcon(log.checklist_floor)}</td>
          <td style="text-align: center;">${getStatusBadge(log.status === 'complete' ? 'Complete' : 'Incomplete')}</td>
        </tr>
      `).join('');
      const html = generatePDFHTML({
        documentTitle: '1 Month Cleaning History', documentType: 'history',
        businessName: businessDisplayName,
        location: `${location.name} - ${businessDisplayName}`,
        dateRange: { start: startDate, end: endDate },
        tableHeaders: ['Date/Time', 'Staff', 'SP', 'BN', 'SD', 'FX', 'FL', 'Status'],
        tableRows, showLegend: true,
      });
      if (Platform.OS === 'web') {
        const success = openPDFInNewWindow(html);
        if (!success) Alert.alert('Error', 'Failed to open PDF. Please try again.');
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: '1 Month Cleaning History', UTI: 'com.adobe.pdf' });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setExportingId(null);
    }
  }, [displayLocations, currentBusiness, formatDateTime]);

  const handlePremiumExport = useCallback(async (locationId: string, locationName: string, startDate: Date, endDate: Date) => {
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);
    const result = await getLogsForDateRange(start, end);
    if (!result.success || !result.data) { Alert.alert('Error', 'Failed to load cleaning logs'); return; }
    const locationLogs = result.data.filter(log => log.location_id === locationId);
    if (locationLogs.length === 0) { Alert.alert('No Data', 'No cleaning logs found for the selected date range'); return; }
    const businessDisplayName = currentBusiness?.name || 'Acadia Clean';
    const tableRows = locationLogs.map(log => `
      <tr>
        <td>${formatDateTime(log.timestamp)}</td>
        <td>${truncateText(log.staff_name, 15)}</td>
        <td style="text-align: center;">${getCheckIcon(log.checklist_supplies)}</td>
        <td style="text-align: center;">${getCheckIcon(log.checklist_trash)}</td>
        <td style="text-align: center;">${getCheckIcon(log.checklist_surfaces)}</td>
        <td style="text-align: center;">${getCheckIcon(log.checklist_fixtures)}</td>
        <td style="text-align: center;">${getCheckIcon(log.checklist_floor)}</td>
        <td style="text-align: center;">${getStatusBadge(log.status === 'complete' ? 'Complete' : 'Incomplete')}</td>
      </tr>
    `).join('');
    const html = generatePDFHTML({
      documentTitle: 'Cleaning History Report', documentType: 'history',
      businessName: businessDisplayName,
      location: `${locationName} - ${businessDisplayName}`,
      dateRange: { start, end },
      tableHeaders: ['Date/Time', 'Staff', 'SP', 'BN', 'SD', 'FX', 'FL', 'Status'],
      tableRows, showLegend: true,
    });
    if (Platform.OS === 'web') {
      if (!openPDFInNewWindow(html)) Alert.alert('Error', 'Failed to open PDF.');
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Cleaning History Report', UTI: 'com.adobe.pdf' });
      }
    }
  }, [currentBusiness, formatDateTime]);

  const generateAuditReportPDF = useCallback(async (businessNameInput: string, startDate: Date, endDate: Date) => {
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);
    const result = await getLogsForDateRange(start, end);
    if (!result.success || !result.data || result.data.length === 0) {
      Alert.alert(result.data ? 'No Data' : 'Error', result.data ? 'No cleaning logs found for the selected date range' : (result.error || 'Failed to load cleaning logs'));
      return;
    }
    const logs = [...result.data];
    const tableRows = logs.map(log => `
      <tr>
        <td>${formatDateTime(log.timestamp)}</td>
        <td>${truncateText(log.location_name, 20)}</td>
        <td>${truncateText(log.staff_name, 15)}</td>
        <td style="text-align: center;">${getCheckIcon(log.checklist_supplies)}</td>
        <td style="text-align: center;">${getCheckIcon(log.checklist_supplies)}</td>
        <td style="text-align: center;">${getCheckIcon(log.checklist_trash)}</td>
        <td style="text-align: center;">${getCheckIcon(log.checklist_surfaces)}</td>
        <td style="text-align: center;">${getCheckIcon(log.checklist_fixtures)}</td>
        <td style="text-align: center;">${getCheckIcon(log.checklist_fixtures)}</td>
        <td style="text-align: center;">${getCheckIcon(log.checklist_floor)}</td>
        <td style="text-align: center;">${getCheckIcon(log.checklist_fixtures)}</td>
        <td style="text-align: center;">${getStatusBadge(log.status === 'complete' ? 'Complete' : 'Attention Required')}</td>
      </tr>
    `).join('');
    const html = generatePDFHTML({
      documentTitle: 'Official Compliance Audit', documentType: 'audit',
      businessName: businessNameInput,
      location: `${businessNameInput} - All Units`,
      dateRange: { start, end },
      tableHeaders: ['Date/Time', 'Location', 'Staff', 'HS', 'TP', 'BN', 'SD', 'FX', 'WT', 'FL', 'VL', 'Status'],
      tableRows, showLegend: true,
    });
    if (Platform.OS === 'web') {
      if (!openPDFInNewWindow(html)) Alert.alert('Error', 'Failed to open PDF.');
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Official Compliance Audit', UTI: 'com.adobe.pdf' });
      }
    }
  }, [formatDateTime]);

  const handleExportIncidentReports = useCallback(async (startDate: Date, endDate: Date, includeOpen: boolean) => {
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);
    const issues = reportedIssues.map(issue => ({
      id: issue.id, location_name: issue.location_name, issue_type: issue.issue_type,
      description: issue.description, status: issue.status,
      created_at: issue.created_at, resolved_at: issue.resolved_at,
      resolution_action: issue.resolution_action,
      resolution_action_label: issue.resolution_action_label,
      resolved_by: issue.resolved_by,
    }));
    if (issues.length === 0) {
      Alert.alert('No Data', 'No incident reports found for this business.');
      return;
    }
    const businessDisplayName = currentBusiness?.name || businessName || 'Business';
    const html = generateIncidentReportsPDF(businessDisplayName, issues, { start, end }, includeOpen);
    if (Platform.OS === 'web') {
      if (!openPDFInNewWindow(html)) Alert.alert('Error', 'Failed to open PDF.');
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Incident Reports', UTI: 'com.adobe.pdf' });
      }
    }
  }, [reportedIssues, currentBusiness, businessName]);

  const handleView14Days = useCallback(async (locationId: string) => {
    const location = displayLocations.find(l => l.id === locationId);
    const result = await getLogs14Days(locationId);
    return {
      logs: (result.success && result.data) ? result.data : [],
      locationName: location?.name || '',
    };
  }, [displayLocations]);

  const handleViewPublicPage = useCallback((locationId: string) => {
    router.push(`/washroom/${locationId}?admin=true`);
  }, [router]);

  const handleCopyUrl = useCallback(async (url: string) => {
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(url);
    Alert.alert('Copied', 'URL copied to clipboard');
  }, []);

  const handleInviteUser = useCallback(async (email: string, name: string, role: ManagerRole): Promise<boolean> => {
    if (!currentBusiness?.id || !currentManager?.id) return false;
    const result = await inviteUserToBusiness(currentBusiness.id, currentManager.id, email, role, name || undefined);
    if (result.success) {
      Alert.alert('Success', result.data?.isNewUser
        ? 'Invitation sent! The user will need to set up their password.'
        : 'User has been added to this business.');
      return true;
    } else {
      Alert.alert('Error', result.error || 'Failed to invite user');
      return false;
    }
  }, [currentBusiness, currentManager]);

  const handleRemoveUser = useCallback((targetManagerId: string, targetName: string | null) => {
    if (!currentBusiness?.id || !currentManager?.id) return;
    Alert.alert(
      'Remove User',
      `Are you sure you want to remove ${targetName || 'this user'} from this business?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            const result = await removeUserFromBusiness(currentBusiness.id, currentManager.id, targetManagerId);
            if (result.success) {
              Alert.alert('Success', 'User has been removed');
            } else {
              Alert.alert('Error', result.error || 'Failed to remove user');
            }
          },
        },
      ]
    );
  }, [currentBusiness, currentManager]);

  const loadTeamMembers = useCallback(async () => {
    if (!currentBusiness?.id || !currentManager?.id) return [];
    const result = await getBusinessManagers(currentBusiness.id);
    if (result.success && result.data) return result.data;
    return [];
  }, [currentBusiness, currentManager]);

  const value: ManagerContextType = {
    currentBusiness, currentManager, currentPermissions, managerBusinesses, isCheckingAuth,
    businessLocations, displayLocations, allLogs, recentLogs, reportedIssues, openIssues, isLoadingLogs,
    businessName, businessAddress, subscriptionTier, isPremium,
    globalAlertEmails, useGlobalAlerts,
    alertSchedule,
    canPerformAction, getLocationStatus, getLocationUrl, formatDateTime, formatTimeAgo,
    handleRefreshData, handleLogout, handleSwitchBusiness, handleResolveIssue,
    handleSaveAlertEmail, handleToggleLocationActive, handleDeleteLocation,
    handleSaveBusinessAddress, handleSaveGlobalAlertSettings, handleSaveAlertSchedule, handleSaveStaffPin,
    handleExport, handlePremiumExport, handleExportIncidentReports, generateAuditReportPDF,
    handleView14Days, handleViewPublicPage, handleCopyUrl,
    handleInviteUser, handleRemoveUser, loadTeamMembers,
    setCurrentBusiness, setBusinessLocations, setBusinessName, setBusinessAddress,
    setGlobalAlertEmails, setUseGlobalAlerts,
    resolvingIssueId, exportingId,
  };

  return <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>;
}
