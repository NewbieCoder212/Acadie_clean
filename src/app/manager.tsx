import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
  Share,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Shield, Lock, Eye, EyeOff, Download, MapPin, AlertTriangle, CheckCircle2, Mail, ExternalLink, Plus, Link, Copy, LogOut, Trash2, Key, FileText, Calendar, ClipboardList, RefreshCw, Sparkles, ChevronRight, Save, Power, AlertOctagon, Crown, X } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useStore, WashroomLocation } from '@/lib/store';
import {
  getLogs6Months as getSupabase6MonthLogs,
  getLogs1Month as getSupabase1MonthLogs,
  getLogs14Days,
  deleteLogsForLocation as supabaseDeleteLogsForLocation,
  insertWashroom as supabaseInsertWashroom,
  deleteWashroom as supabaseDeleteWashroom,
  getLogsForDateRange,
  CleaningLogRow,
  BusinessRow,
  getLogsForBusinessByName,
  WashroomRow,
  getAllWashrooms,
  getWashroomsForBusiness,
  updateWashroomAlertEmail,
  toggleWashroomActive,
  updateBusinessAddress,
  updateBusinessStaffPin,
  ReportedIssueRow,
  getIssuesForBusinessByName,
  resolveReportedIssue,
  SubscriptionTier,
  logoutBusiness,
  getBusinessById,
} from '@/lib/supabase';
import { hashPassword, verifyPassword } from '@/lib/password';
import { sendNewWashroomNotification } from '@/lib/email';
import { AcadiaLogo } from '@/components/AcadiaLogo';
import { generatePDFHTML, getCheckIcon, getStatusBadge, truncateText, openPDFInNewWindow, generateIncidentReportsPDF } from '@/lib/pdf-template';
import { InstallAppBanner } from '@/components/InstallAppBanner';
import { BRAND_COLORS as C, DESIGN as D } from '@/lib/colors';

// Legacy color mapping for backward compatibility
const COLORS = {
  primary: C.actionGreen,
  primaryLight: C.emeraldLight,
  primaryDark: C.emeraldDark,
  background: C.mintBackground,
  white: C.white,
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: C.textPrimary,
  slate900: '#0f172a',
  red: C.error,
  redLight: C.errorBg,
  amber: C.warning,
  amberLight: C.warningBg,
  indigo: '#4f46e5',
  indigoLight: '#e0e7ff',
  indigoDark: C.emeraldDark,
};

export default function ManagerDashboard() {
  const router = useRouter();

  // Business authentication state
  const [currentBusiness, setCurrentBusiness] = useState<BusinessRow | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [businessLocations, setBusinessLocations] = useState<WashroomRow[]>([]);
  const [allLogs, setAllLogs] = useState<CleaningLogRow[]>([]);
  const [reportedIssues, setReportedIssues] = useState<ReportedIssueRow[]>([]);
  const [resolvingIssueId, setResolvingIssueId] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Newly created location success modal (kept for when admin creates via admin page)
  const [newlyCreatedLocation, setNewlyCreatedLocation] = useState<{ id: string; name: string } | null>(null);

  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);

  // Inspector Mode state
  const [showInspectorMode, setShowInspectorMode] = useState(false);
  const [auditStartDate, setAuditStartDate] = useState<Date>(new Date());
  const [auditEndDate, setAuditEndDate] = useState<Date>(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [businessName, setBusinessName] = useState('Acadia Facilities');
  const [businessAddress, setBusinessAddress] = useState('');
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Location settings modal
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [editAlertEmail, setEditAlertEmail] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);

  // View 14 Days modal state
  const [show14DaysModal, setShow14DaysModal] = useState(false);
  const [viewing14DaysLocationId, setViewing14DaysLocationId] = useState<string | null>(null);
  const [viewing14DaysLocationName, setViewing14DaysLocationName] = useState<string>('');
  const [fourteenDaysLogs, setFourteenDaysLogs] = useState<CleaningLogRow[]>([]);
  const [isLoading14DaysLogs, setIsLoading14DaysLogs] = useState(false);

  // Upgrade prompt modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Premium Export modal state (date range export per location)
  const [showPremiumExportModal, setShowPremiumExportModal] = useState(false);
  const [premiumExportLocationId, setPremiumExportLocationId] = useState<string | null>(null);
  const [premiumExportLocationName, setPremiumExportLocationName] = useState<string>('');
  const [premiumExportStartDate, setPremiumExportStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [premiumExportEndDate, setPremiumExportEndDate] = useState<Date>(new Date());
  const [showPremiumStartPicker, setShowPremiumStartPicker] = useState(false);
  const [showPremiumEndPicker, setShowPremiumEndPicker] = useState(false);
  const [isPremiumExporting, setIsPremiumExporting] = useState(false);

  // Incident Reports Export modal state
  const [showIncidentExportModal, setShowIncidentExportModal] = useState(false);
  const [incidentExportStartDate, setIncidentExportStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [incidentExportEndDate, setIncidentExportEndDate] = useState<Date>(new Date());
  const [showIncidentStartPicker, setShowIncidentStartPicker] = useState(false);
  const [showIncidentEndPicker, setShowIncidentEndPicker] = useState(false);
  const [isExportingIncidents, setIsExportingIncidents] = useState(false);
  const [includeOpenIncidents, setIncludeOpenIncidents] = useState(true);

  // Universal Staff PIN management
  const [showPinManagement, setShowPinManagement] = useState(false);
  const [newStaffPin, setNewStaffPin] = useState('');
  const [confirmStaffPin, setConfirmStaffPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);

  const managerPasswordHash = useStore((s) => s.managerPasswordHash);
  const setManagerPasswordHash = useStore((s) => s.setManagerPasswordHash);
  const isAuthenticated = useStore((s) => s.isManagerAuthenticated);
  const setManagerAuthenticated = useStore((s) => s.setManagerAuthenticated);
  const logoutManager = useStore((s) => s.logoutManager);
  const locations = useStore((s) => s.locations);
  const getLocationById = useStore((s) => s.getLocationById);
  const updateLocationEmail = useStore((s) => s.updateLocationEmail);
  const addLocation = useStore((s) => s.addLocation);
  const deleteLocation = useStore((s) => s.deleteLocation);

  const needsSetup = !managerPasswordHash;

  // Check subscription tier - default to 'standard' if not set
  const subscriptionTier: SubscriptionTier = currentBusiness?.subscription_tier || 'standard';
  const isPremium = subscriptionTier === 'premium';

  // Determine which locations to display
  const displayLocations: WashroomLocation[] = currentBusiness
    ? businessLocations.map(loc => ({
        id: loc.id,
        name: loc.room_name,
        businessName: loc.business_name,
        pinCode: loc.pin_display || loc.pin_code, // Use pin_display if available, fallback to pin_code
        supervisorEmail: loc.alert_email ?? undefined,
        isActive: loc.is_active,
        createdAt: new Date(loc.created_at).getTime(),
      }))
    : locations;

  // Get location status (last log status)
  const getLocationStatus = (locationId: string): 'clean' | 'attention' | 'unknown' => {
    const locationLogs = allLogs.filter(log => log.location_id === locationId);
    console.log('[Manager] getLocationStatus for', locationId, '- found', locationLogs.length, 'logs');
    if (locationLogs.length === 0) return 'unknown';
    const lastLog = locationLogs[0]; // Already sorted by timestamp desc
    console.log('[Manager] Last log status:', lastLog.status, 'resolved:', lastLog.resolved);
    if (lastLog.status === 'attention_required' && !lastLog.resolved) return 'attention';
    return 'clean';
  };

  // Refresh data manually
  const handleRefreshData = () => {
    fetchAllData();
  };

  // Handle resolving a reported issue
  const handleResolveIssue = async (issueId: string) => {
    setResolvingIssueId(issueId);
    try {
      const result = await resolveReportedIssue(issueId);
      if (result.success) {
        // Update local state to remove the resolved issue from open list
        setReportedIssues(prev =>
          prev.map(issue =>
            issue.id === issueId
              ? { ...issue, status: 'resolved' as const, resolved_at: new Date().toISOString() }
              : issue
          )
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to resolve issue');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setResolvingIssueId(null);
    }
  };

  // Get open issues
  const openIssues = useMemo(() => {
    return reportedIssues.filter(issue => issue.status === 'open');
  }, [reportedIssues]);

  // Recent logs (last 10)
  const recentLogs = useMemo(() => {
    return allLogs.slice(0, 10);
  }, [allLogs]);

  // Check for business authentication on mount
  useEffect(() => {
    checkBusinessAuth();
  }, []);

  const checkBusinessAuth = async () => {
    setIsCheckingAuth(true);
    try {
      const stored = await AsyncStorage.getItem('currentBusiness');
      if (stored) {
        try {
          const business = JSON.parse(stored) as BusinessRow;
          if (business?.id && business?.name) {
            // Refresh business data from database to get latest staff_pin_display
            const refreshedResult = await getBusinessById(business.id);
            if (refreshedResult.success && refreshedResult.data) {
              const refreshedBusiness = refreshedResult.data as BusinessRow;
              // Update AsyncStorage with fresh data
              await AsyncStorage.setItem('currentBusiness', JSON.stringify(refreshedBusiness));
              setCurrentBusiness(refreshedBusiness);
              setBusinessName(refreshedBusiness.name);
              setBusinessAddress(refreshedBusiness.address || '');
            } else {
              // Fallback to stored data if refresh fails
              setCurrentBusiness(business);
              setBusinessName(business.name);
              setBusinessAddress(business.address || '');
            }
            // Fetch business-specific washrooms
            const washroomsResult = await getWashroomsForBusiness(business.name);
            if (washroomsResult.success && washroomsResult.data) {
              setBusinessLocations(washroomsResult.data);
            }
          }
        } catch (parseError) {
          // Invalid JSON in storage, clear it
          await AsyncStorage.removeItem('currentBusiness');
        }
      }
    } catch (error) {
      // Storage error
    }
    setIsCheckingAuth(false);
  };

  // Generate QR code URL - uses environment variable for production URL
  // Includes ?scan=true to track actual QR scans (not page refreshes)
  const getLocationUrl = (locationId: string) => {
    const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://app.acadiacleaniq.ca';
    return `${baseUrl}/washroom/${locationId}?scan=true`;
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
        // Fetch business-specific data
        console.log('[Manager] Fetching data for business:', currentBusiness.name);
        const [logsResult, issuesResult] = await Promise.all([
          getLogsForBusinessByName(currentBusiness.name),
          getIssuesForBusinessByName(currentBusiness.name),
        ]);

        console.log('[Manager] Logs result:', logsResult.success, 'count:', logsResult.data?.length);

        if (logsResult.success && logsResult.data) {
          console.log('[Manager] Setting allLogs with', logsResult.data.length, 'logs');
          setAllLogs(logsResult.data);
        }

        if (issuesResult.success && issuesResult.data) {
          console.log('[Manager] Setting reportedIssues with', issuesResult.data.length, 'issues');
          setReportedIssues(issuesResult.data);
        }
      } else {
        // Admin or legacy mode - fetch all
        const logsResult = await getSupabase6MonthLogs('');

        if (logsResult.success && logsResult.data) {
          setAllLogs(logsResult.data);
        }
      }
    } catch (error) {
      console.error('[Manager] Error fetching data:', error);
    }

    setIsLoadingLogs(false);
  };

  const handleSetupPassword = async () => {
    if (passwordInput.length < 4) {
      Alert.alert('Error', 'Password must be at least 4 characters');
      return;
    }
    if (passwordInput !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setIsSettingUp(true);
    const hash = await hashPassword(passwordInput);
    setManagerPasswordHash(hash);
    setIsSettingUp(false);
    setManagerAuthenticated(true);
    setPasswordInput('');
    setConfirmPassword('');
  };

  const handleLogin = async () => {
    if (!managerPasswordHash) return;

    setIsVerifying(true);
    const isValid = await verifyPassword(passwordInput, managerPasswordHash);
    setIsVerifying(false);

    if (isValid) {
      setManagerAuthenticated(true);
      setPasswordInput('');
    } else {
      Alert.alert('Error', 'Incorrect password');
    }
  };

  const handleLogout = async () => {
    await logoutBusiness();
    await AsyncStorage.removeItem('currentBusiness');
    setCurrentBusiness(null);
    logoutManager();
    router.replace('/');
  };

  const handleEditEmail = (location: WashroomLocation) => {
    setEditingEmailId(location.id);
    setEmailInput(location.supervisorEmail ?? '');
  };

  const handleSaveEmail = (locationId: string) => {
    updateLocationEmail(locationId, emailInput.trim());
    setEditingEmailId(null);
    setEmailInput('');
  };

  const handleCopyUrl = async (url: string) => {
    await Clipboard.setStringAsync(url);
    Alert.alert('Copied', 'URL copied to clipboard');
  };

  const handleShareUrl = async (locationName: string, url: string) => {
    try {
      await Share.share({
        message: `Scan this QR code to log cleaning for ${locationName}:\n${url}`,
        title: `Acadia Clean - ${locationName}`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const handleViewPublicPage = (locationId: string) => {
    setSelectedLocationId(null); // Close modal first
    setTimeout(() => {
      router.push(`/washroom/${locationId}?admin=true`);
    }, 100);
  };

  const handleSaveAlertEmail = async (locationId: string) => {
    setIsSavingEmail(true);
    try {
      const result = await updateWashroomAlertEmail(locationId, editAlertEmail.trim());
      if (result.success) {
        // Update local state
        setBusinessLocations(prev => prev.map(w =>
          w.id === locationId ? { ...w, alert_email: editAlertEmail.trim() } : w
        ));
        Alert.alert('Success', 'Alert email updated successfully');
      } else {
        Alert.alert('Error', result.error || 'Failed to update alert email');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleSaveBusinessAddress = async () => {
    if (!currentBusiness?.id) return;
    setIsSavingAddress(true);
    try {
      const result = await updateBusinessAddress(currentBusiness.id, businessAddress.trim());
      if (result.success) {
        // Update local storage with new address
        const updatedBusiness = { ...currentBusiness, address: businessAddress.trim() };
        await AsyncStorage.setItem('currentBusiness', JSON.stringify(updatedBusiness));
        setCurrentBusiness(updatedBusiness);
        Alert.alert('Success', 'Business address saved!\nAdresse enregistrée!');
      } else {
        Alert.alert('Error', result.error || 'Failed to save address');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleSaveStaffPin = async () => {
    if (!currentBusiness?.id) return;

    // Validate PIN
    if (!newStaffPin || newStaffPin.length < 4 || newStaffPin.length > 5 || !/^\d{4,5}$/.test(newStaffPin)) {
      Alert.alert('Error', 'Please enter a valid 4 or 5-digit PIN\nVeuillez entrer un NIP de 4 ou 5 chiffres');
      return;
    }

    if (newStaffPin !== confirmStaffPin) {
      Alert.alert('Error', 'PINs do not match\nLes NIP ne correspondent pas');
      return;
    }

    setIsSavingPin(true);
    try {
      const result = await updateBusinessStaffPin(currentBusiness.id, newStaffPin);
      if (result.success) {
        // Update local storage with new PIN display
        const updatedBusiness = { ...currentBusiness, staff_pin_display: newStaffPin };
        await AsyncStorage.setItem('currentBusiness', JSON.stringify(updatedBusiness));
        setCurrentBusiness(updatedBusiness);
        setNewStaffPin('');
        setConfirmStaffPin('');
        setShowPinManagement(false);
        Alert.alert('Success', 'Staff PIN updated!\nNIP du personnel mis à jour!');
      } else {
        Alert.alert('Error', result.error || 'Failed to update PIN');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleToggleLocationActive = async (location: WashroomLocation) => {
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
            setIsTogglingActive(true);
            try {
              const result = await toggleWashroomActive(location.id, newStatus);
              if (result.success) {
                // Update local state
                setBusinessLocations(prev => prev.map(w =>
                  w.id === location.id ? { ...w, is_active: newStatus } : w
                ));
                // Close the modal after toggling
                setSelectedLocationId(null);
              } else {
                Alert.alert('Error', result.error || 'Failed to update location status');
              }
            } catch (error) {
              Alert.alert('Error', 'Network error. Please try again.');
            } finally {
              setIsTogglingActive(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteLocation = (location: WashroomLocation) => {
    Alert.alert(
      'Delete Location',
      `Are you sure you want to delete "${location.name}"?\n\nThis will permanently delete all cleaning logs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingLocationId(location.id);
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
            setDeletingLocationId(null);
          },
        },
      ]
    );
  };

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const generateCSV = (logs: CleaningLogRow[], locationName: string, businessDisplayName: string): string => {
    const headers = [
      'Date/Time',
      'Staff Name',
      // Section 1: Supplies & Restocking
      'Handwashing Station',
      'Toilet Paper',
      'Bins',
      // Section 2: Sanitization
      'Surfaces Disinfected',
      'Fixtures',
      // Section 3: Facility & Safety
      'Water Temperature',
      'Floors',
      'Ventilation & Lighting',
      'Maintenance Notes',
    ].join(',');

    const rows = logs.map((log) => {
      const dateTime = formatDateTime(log.timestamp);
      const staffName = `"${log.staff_name.replace(/"/g, '""')}"`;
      const notes = `"${(log.notes || '').replace(/"/g, '""')}"`;
      // Map legacy DB fields to new checklist items for display
      // Since DB still uses old fields, we map them appropriately
      return [
        dateTime,
        staffName,
        // Section 1: Supplies & Restocking (mapped from checklist_supplies and checklist_trash)
        log.checklist_supplies ? 'Yes' : 'No', // Handwashing Station
        log.checklist_supplies ? 'Yes' : 'No', // Toilet Paper
        log.checklist_trash ? 'Yes' : 'No',    // Bins
        // Section 2: Sanitization
        log.checklist_surfaces ? 'Yes' : 'No', // Surfaces Disinfected
        log.checklist_fixtures ? 'Yes' : 'No', // Fixtures
        // Section 3: Facility & Safety
        log.checklist_fixtures ? 'Yes' : 'No', // Water Temperature
        log.checklist_floor ? 'Yes' : 'No',    // Floors
        log.checklist_fixtures ? 'Yes' : 'No', // Ventilation & Lighting
        notes
      ].join(',');
    });

    return `${businessDisplayName}\nLocation / Emplacement: ${locationName}\n1 Month History / Historique de 1 mois (30 jours)\n\n${headers}\n${rows.join('\n')}`;
  };

  // Handle viewing 14 days history (for standard tier)
  const handleView14Days = async (locationId: string) => {
    const location = displayLocations.find(l => l.id === locationId);
    if (!location) return;

    setViewing14DaysLocationId(locationId);
    setViewing14DaysLocationName(location.name);
    setShow14DaysModal(true);
    setIsLoading14DaysLogs(true);

    try {
      const result = await getLogs14Days(locationId);
      if (result.success && result.data) {
        setFourteenDaysLogs(result.data);
      } else {
        setFourteenDaysLogs([]);
      }
    } catch (error) {
      setFourteenDaysLogs([]);
    } finally {
      setIsLoading14DaysLogs(false);
    }
  };

  // Open premium export modal (for premium tier)
  const openPremiumExportModal = (locationId: string) => {
    const location = displayLocations.find(l => l.id === locationId);
    if (!location) return;

    setPremiumExportLocationId(locationId);
    setPremiumExportLocationName(location.name);
    setPremiumExportStartDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    setPremiumExportEndDate(new Date());
    setShowPremiumExportModal(true);
  };

  // Handle premium export with date range
  const handlePremiumExport = async () => {
    if (!premiumExportLocationId) return;

    setIsPremiumExporting(true);

    try {
      const startDate = new Date(premiumExportStartDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(premiumExportEndDate);
      endDate.setHours(23, 59, 59, 999);

      const result = await getLogsForDateRange(startDate, endDate);

      if (!result.success || !result.data) {
        Alert.alert('Error', 'Failed to load cleaning logs');
        setIsPremiumExporting(false);
        return;
      }

      // Filter logs for this specific location
      const locationLogs = result.data.filter(log => log.location_id === premiumExportLocationId);

      if (locationLogs.length === 0) {
        Alert.alert('No Data', 'No cleaning logs found for the selected date range');
        setIsPremiumExporting(false);
        return;
      }

      const businessDisplayName = currentBusiness?.name || 'Acadia Clean';

      // Build table rows with standardized status labels
      // Columns match actual database structure: supplies, trash, surfaces, fixtures, floor
      const tableRows = locationLogs.map((log, index) => `
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
        documentTitle: 'Cleaning History Report',
        documentType: 'history',
        businessName: businessDisplayName,
        location: `${premiumExportLocationName} - ${businessDisplayName}`,
        dateRange: { start: startDate, end: endDate },
        tableHeaders: ['Date/Time', 'Staff', 'SP', 'BN', 'SD', 'FX', 'FL', 'Status'],
        tableRows,
        showLegend: true,
      });

      if (Platform.OS === 'web') {
        const success = openPDFInNewWindow(html);
        if (!success) {
          Alert.alert('Error', 'Failed to open PDF. Please try again.');
        }
      } else {
        // Mobile: use expo-print with sharing
        try {
          const { uri } = await Print.printToFileAsync({ html });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Cleaning History Report',
              UTI: 'com.adobe.pdf',
            });
          }
        } catch (printError) {
          console.error('[Manager] Print error:', printError);
          Alert.alert('Error', 'Failed to generate PDF. Please try again.');
          return;
        }
      }

      setShowPremiumExportModal(false);
    } catch (error) {
      console.error('[Manager] PDF export error:', error);
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setIsPremiumExporting(false);
    }
  };

  const handleExport = async (locationId: string) => {
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

      // Calculate date range (past 30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      // Build table rows with standardized status labels
      // Columns match actual database structure: supplies, trash, surfaces, fixtures, floor
      const tableRows = logs.map((log, index) => `
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
        documentTitle: '1 Month Cleaning History',
        documentType: 'history',
        businessName: businessDisplayName,
        location: `${location.name} - ${businessDisplayName}`,
        dateRange: { start: startDate, end: endDate },
        tableHeaders: ['Date/Time', 'Staff', 'SP', 'BN', 'SD', 'FX', 'FL', 'Status'],
        tableRows,
        showLegend: true,
      });

      if (Platform.OS === 'web') {
        const success = openPDFInNewWindow(html);
        if (!success) {
          Alert.alert('Error', 'Failed to open PDF. Please try again.');
        }
      } else {
        // Mobile: use expo-print with sharing
        try {
          const { uri } = await Print.printToFileAsync({ html });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: '1 Month Cleaning History',
              UTI: 'com.adobe.pdf',
            });
          }
        } catch (printError) {
          console.error('[Manager] Print error:', printError);
          Alert.alert('Error', 'Failed to generate PDF. Please try again.');
          return;
        }
      }
    } catch (error) {
      console.error('[Manager] PDF export error:', error);
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setExportingId(null);
    }
  };

  const generateAuditReportPDF = async () => {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);

    try {
      // Ensure dates have proper time boundaries
      const startDate = new Date(auditStartDate);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(auditEndDate);
      endDate.setHours(23, 59, 59, 999);

      console.log('[Manager] Generating report for date range:', startDate.toISOString(), 'to', endDate.toISOString());

      // Fetch data and wait for it to complete
      const result = await getLogsForDateRange(startDate, endDate);

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to load cleaning logs');
        setIsGeneratingReport(false);
        return;
      }

      if (!result.data || result.data.length === 0) {
        Alert.alert('No Data', 'No cleaning logs found for the selected date range');
        setIsGeneratingReport(false);
        return;
      }

      // Ensure all data is loaded before rendering
      const logs = [...result.data];

      // Build table rows with standardized status labels
      const tableRows = logs.map((log, index) => `
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
        documentTitle: 'Official Compliance Audit',
        documentType: 'audit',
        businessName: businessName,
        location: `${businessName} - All Units`,
        dateRange: { start: startDate, end: endDate },
        tableHeaders: ['Date/Time', 'Location', 'Staff', 'HS', 'TP', 'BN', 'SD', 'FX', 'WT', 'FL', 'VL', 'Status'],
        tableRows,
        showLegend: true,
      });

      // Handle web platform differently
      if (Platform.OS === 'web') {
        const success = openPDFInNewWindow(html);
        if (!success) {
          Alert.alert('Error', 'Failed to open PDF. Please try again.');
        }
      } else {
        // Native platforms use expo-print with sharing
        try {
          const { uri } = await Print.printToFileAsync({ html });
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Official Compliance Audit',
              UTI: 'com.adobe.pdf',
            });
          }
        } catch (printError) {
          console.error('[Manager] Print error:', printError);
          Alert.alert('Error', 'Failed to generate PDF. Please try again.');
          return;
        }
      }
    } catch (error) {
      console.error('[Manager] PDF generation error:', error);
      // Only show error if PDF truly failed to generate
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('cancel') && !errorMessage.includes('dismissed')) {
        Alert.alert('Error / Erreur', 'Failed to generate PDF report. Please try again. / Échec de la génération du rapport PDF. Veuillez réessayer.');
      }
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Generate Incident Reports PDF
  const handleExportIncidentReports = async () => {
    if (isExportingIncidents) return;
    setIsExportingIncidents(true);

    try {
      // Ensure dates have proper time boundaries
      const startDate = new Date(incidentExportStartDate);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(incidentExportEndDate);
      endDate.setHours(23, 59, 59, 999);

      console.log('[Manager] Generating incident reports for date range:', startDate.toISOString(), 'to', endDate.toISOString());

      // Use reportedIssues from state (already fetched)
      const issues = reportedIssues.map(issue => ({
        id: issue.id,
        location_name: issue.location_name,
        issue_type: issue.issue_type,
        description: issue.description,
        status: issue.status,
        created_at: issue.created_at,
        resolved_at: issue.resolved_at,
      }));

      if (issues.length === 0) {
        Alert.alert('No Data / Aucune donnée', 'No incident reports found for this business. / Aucun rapport d\'incident trouvé pour cette entreprise.');
        setIsExportingIncidents(false);
        return;
      }

      const businessDisplayName = currentBusiness?.name || businessName || 'Business';
      const html = generateIncidentReportsPDF(
        businessDisplayName,
        issues,
        { start: startDate, end: endDate },
        includeOpenIncidents
      );

      // Handle web platform differently
      if (Platform.OS === 'web') {
        const success = openPDFInNewWindow(html);
        if (!success) {
          Alert.alert('Error', 'Failed to open PDF. Please try again.');
        }
      } else {
        // Native platforms use expo-print with sharing
        try {
          const { uri } = await Print.printToFileAsync({ html });
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Incident Reports / Rapports d\'incidents',
              UTI: 'com.adobe.pdf',
            });
          }
        } catch (printError) {
          console.error('[Manager] Print error:', printError);
          Alert.alert('Error', 'Failed to generate PDF. Please try again.');
          return;
        }
      }

      setShowIncidentExportModal(false);
    } catch (error) {
      console.error('[Manager] Incident reports PDF error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('cancel') && !errorMessage.includes('dismissed')) {
        Alert.alert('Error / Erreur', 'Failed to generate incident report. Please try again. / Échec de la génération du rapport. Veuillez réessayer.');
      }
    } finally {
      setIsExportingIncidents(false);
    }
  };

  // Loading state
  if (isCheckingAuth) {
    return (
      <SafeAreaView className="flex-1 bg-slate-100 items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text className="mt-4 text-slate-600">Loading...</Text>
      </SafeAreaView>
    );
  }

  const isBusinessAuthenticated = !!currentBusiness;
  const showDashboard = isAuthenticated || isBusinessAuthenticated;

  // Password Setup Screen
  if (needsSetup && !showDashboard) {
    return (
      <SafeAreaView className="flex-1 bg-slate-100" edges={['bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
            <View className="items-center mb-8">
              <View className="w-20 h-20 rounded-full bg-emerald-600 items-center justify-center mb-4">
                <Shield size={40} color="#ffffff" />
              </View>
              <Text className="text-2xl font-bold text-slate-900 text-center">Set Up Manager Password</Text>
            </View>
            <View className="mb-4">
              <Text className="text-sm font-semibold text-slate-700 mb-2">Create Password</Text>
              <View className="flex-row items-center bg-white border border-slate-300 rounded-xl">
                <TextInput
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                  placeholder="Enter password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  className="flex-1 px-4 py-3 text-base text-slate-900"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} className="px-4 py-3">
                  {showPassword ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}
                </Pressable>
              </View>
            </View>
            <View className="mb-6">
              <Text className="text-sm font-semibold text-slate-700 mb-2">Confirm Password</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                className="bg-white border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900"
              />
            </View>
            <Pressable
              onPress={handleSetupPassword}
              disabled={isSettingUp}
              className={`py-4 rounded-xl items-center ${isSettingUp ? 'bg-slate-400' : 'bg-emerald-600'}`}
            >
              <Text className="text-white text-lg font-bold">{isSettingUp ? 'Setting up...' : 'Set Password'}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Login Screen
  if (!showDashboard) {
    return (
      <SafeAreaView className="flex-1 bg-slate-100" edges={['bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
            <View className="items-center mb-8">
              <View className="w-20 h-20 rounded-full bg-slate-800 items-center justify-center mb-4">
                <Lock size={40} color="#ffffff" />
              </View>
              <Text className="text-2xl font-bold text-slate-900 text-center">Manager Dashboard</Text>
            </View>
            <View className="mb-6">
              <Text className="text-sm font-semibold text-slate-700 mb-2">Password</Text>
              <View className="flex-row items-center bg-white border border-slate-300 rounded-xl">
                <TextInput
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                  placeholder="Enter password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  className="flex-1 px-4 py-3 text-base text-slate-900"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} className="px-4 py-3">
                  {showPassword ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}
                </Pressable>
              </View>
            </View>
            <Pressable
              onPress={handleLogin}
              disabled={isVerifying}
              className={`py-4 rounded-xl items-center ${isVerifying ? 'bg-slate-500' : 'bg-slate-900'}`}
            >
              <Text className="text-white text-lg font-bold">{isVerifying ? 'Verifying...' : 'Unlock'}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Main Dashboard
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: C.mintBackground }} edges={['top', 'bottom']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* HERO HEADER - Business Name with new colors */}
        <Animated.View
          entering={FadeInDown.duration(500)}
          className="px-5 pt-6 pb-4"
          style={{ backgroundColor: C.emeraldDark }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Pressable
              onPress={handleLogout}
              className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <LogOut size={16} color="#ffffff" />
              <View>
                <Text className="text-white font-medium text-xs ml-1">Logout</Text>
                <Text className="text-white/80 text-[10px] ml-1">Déconnexion</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={handleRefreshData}
              className="p-2 rounded-lg active:opacity-70"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <RefreshCw size={18} color="#ffffff" />
            </Pressable>
          </View>

          <View className="items-center py-4">
            <View
              className="rounded-2xl p-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <AcadiaLogo size={80} showText={false} />
            </View>
            <Text
              className="text-2xl font-black text-center mt-3"
              style={{ color: C.white, letterSpacing: 0.5 }}
            >
              {currentBusiness?.name || 'Acadia Clean IQ'}
            </Text>
            <Text
              className="text-sm font-medium mt-1"
              style={{ color: 'rgba(255,255,255,0.8)' }}
            >
              Business Portal / Portail d'entreprise
            </Text>
          </View>
        </Animated.View>

        {/* Install App Banner for PWA */}
        <InstallAppBanner />

        {/* CURRENT STATUS GRID */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(500)}
          className="px-5 py-4"
        >
          {displayLocations.length === 0 ? (
            <View
              className="rounded-2xl p-6 items-center"
              style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate200 }}
            >
              <MapPin size={40} color={COLORS.slate400} />
              <Text className="text-base text-center mt-3" style={{ color: COLORS.slate500 }}>
                No washroom locations yet. Contact your administrator to add locations.
              </Text>
              <Text className="text-sm text-center mt-1" style={{ color: COLORS.slate400 }}>
                Aucun emplacement. Contactez votre administrateur pour ajouter des emplacements.
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
              {displayLocations.map((location) => {
                const isInactive = location.isActive === false;
                const status = getLocationStatus(location.id);
                const isNew = status === 'unknown' && !isInactive; // New washroom = no logs yet
                const statusColor = isInactive ? COLORS.slate400 : status === 'clean' ? COLORS.primary : status === 'attention' ? COLORS.amber : COLORS.slate400;
                const statusBg = isInactive ? COLORS.slate100 : status === 'clean' ? COLORS.primaryLight : status === 'attention' ? COLORS.amberLight : COLORS.slate100;
                const statusText = isInactive ? 'INACTIVE' : status === 'clean' ? 'CLEAN' : status === 'attention' ? 'ATTENTION REQUIRED' : 'NO DATA';

                return (
                  <Pressable
                    key={location.id}
                    onPress={() => {
                      setSelectedLocationId(location.id);
                      setEditAlertEmail(location.supervisorEmail || '');
                    }}
                    className="active:opacity-80"
                    style={{ width: '50%', padding: 4, opacity: isInactive ? 0.6 : 1 }}
                  >
                    <View
                      className="rounded-xl p-4"
                      style={{
                        backgroundColor: COLORS.white,
                        borderWidth: 2,
                        borderColor: isNew ? '#2563eb' : statusColor,
                      }}
                    >
                      {/* NEW Badge for washrooms without logs */}
                      {isNew && (
                        <View
                          className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: '#2563eb' }}
                        >
                          <Text className="text-[10px] font-bold text-white">NEW</Text>
                        </View>
                      )}
                      <View className="flex-row items-start justify-between mb-2">
                        <View
                          className="w-10 h-10 rounded-full items-center justify-center"
                          style={{ backgroundColor: isNew ? '#dbeafe' : statusBg }}
                        >
                          {isInactive ? (
                            <Power size={22} color={statusColor} />
                          ) : isNew ? (
                            <Sparkles size={22} color="#2563eb" />
                          ) : status === 'clean' ? (
                            <CheckCircle2 size={22} color={statusColor} />
                          ) : status === 'attention' ? (
                            <AlertTriangle size={22} color={statusColor} />
                          ) : (
                            <MapPin size={22} color={statusColor} />
                          )}
                        </View>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            handleViewPublicPage(location.id);
                          }}
                          className="p-1.5 rounded-md active:opacity-70"
                          style={{ backgroundColor: COLORS.slate100 }}
                        >
                          <ExternalLink size={14} color={COLORS.slate500} />
                        </Pressable>
                      </View>
                      <Text
                        className="text-sm font-bold mb-1"
                        style={{ color: COLORS.slate800 }}
                        numberOfLines={1}
                      >
                        {location.name}
                      </Text>
                      <Text
                        className="text-xs font-bold"
                        style={{ color: isNew ? '#2563eb' : statusColor }}
                      >
                        {isNew ? 'NEW' : statusText}
                      </Text>
                      <Text
                        className="text-[10px]"
                        style={{ color: isNew ? '#2563eb' : statusColor }}
                      >
                        {isInactive ? 'Inactif' : isNew ? 'Nouveau' : status === 'clean' ? 'Propre' : status === 'attention' ? 'Attention requise' : 'Pas de données'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* RECENT CLEANING LOGS - Redesigned Table */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(500)}
          className="px-5 py-4"
        >
          <View className="mb-3">
            <Text className="text-lg font-bold" style={{ color: C.textPrimary }}>
              Recent Cleaning Logs
            </Text>
            <Text className="text-xs" style={{ color: C.textMuted }}>
              Journaux de nettoyage récents
            </Text>
          </View>

          {isLoadingLogs ? (
            <View className="items-center py-6">
              <ActivityIndicator size="small" color={C.actionGreen} />
              <Text className="text-sm mt-2" style={{ color: C.textMuted }}>Loading logs... / Chargement...</Text>
            </View>
          ) : recentLogs.length === 0 ? (
            <View
              className="rounded-xl p-6 items-center"
              style={{ backgroundColor: C.emptyBg, borderWidth: 1, borderColor: C.borderLight }}
            >
              <Text className="text-sm font-medium" style={{ color: C.textMuted }}>Empty / Vide</Text>
              <Text className="text-xs mt-1" style={{ color: C.textMuted }}>No cleaning logs yet</Text>
            </View>
          ) : (
            <View
              className="rounded-xl overflow-hidden"
              style={{
                backgroundColor: C.white,
                borderWidth: 1,
                borderColor: C.borderMedium,
                ...D.shadow.sm,
              }}
            >
              {/* Table Header */}
              <View
                className="flex-row items-center px-4 py-3"
                style={{ backgroundColor: C.emeraldDark }}
              >
                <View className="flex-1">
                  <Text className="text-xs font-bold" style={{ color: C.white }}>
                    Location
                  </Text>
                </View>
                <View className="flex-1 items-center">
                  <Text className="text-xs font-bold" style={{ color: C.white }}>
                    Staff
                  </Text>
                </View>
                <View style={{ width: 80 }} className="items-end">
                  <Text className="text-xs font-bold" style={{ color: C.white }}>
                    Status
                  </Text>
                </View>
              </View>

              {/* Table Rows */}
              {recentLogs.map((log, index) => {
                const isCompliant = log.status === 'complete';
                const needsAttention = log.status === 'attention_required';
                const rowBg = isCompliant ? C.successBg : needsAttention ? C.warningBg : C.emptyBg;

                return (
                  <View
                    key={log.id}
                    className="flex-row items-center px-4 py-3"
                    style={{
                      borderBottomWidth: index < recentLogs.length - 1 ? 1 : 0,
                      borderBottomColor: C.borderLight,
                      backgroundColor: rowBg,
                    }}
                  >
                    {/* Location */}
                    <View className="flex-1">
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: C.textPrimary }}
                        numberOfLines={1}
                      >
                        {log.location_name}
                      </Text>
                      <Text className="text-[10px]" style={{ color: C.textMuted }}>
                        {formatTimeAgo(log.timestamp)}
                      </Text>
                    </View>

                    {/* Staff */}
                    <View className="flex-1 items-center">
                      <Text
                        className="text-xs font-medium"
                        style={{ color: C.textPrimary }}
                        numberOfLines={1}
                      >
                        {log.staff_name}
                      </Text>
                    </View>

                    {/* Status Badge */}
                    <View style={{ width: 80 }} className="items-end">
                      <View
                        className="px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: isCompliant ? C.actionGreen : C.warning,
                        }}
                      >
                        <Text className="text-[10px] font-bold" style={{ color: C.white }}>
                          {isCompliant ? 'COMPLIANT' : 'ATTENTION'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* OPEN ISSUES - Reported by Public */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(500)}
          className="px-5 py-4"
        >
          <View className="mb-3">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-lg font-bold" style={{ color: C.textPrimary }}>
                  Open Issues
                </Text>
                <Text className="text-xs" style={{ color: C.textMuted }}>
                  Problèmes signalés par le public
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                {/* Export Incident Reports Button */}
                <Pressable
                  onPress={() => setShowIncidentExportModal(true)}
                  className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-80"
                  style={{ backgroundColor: C.emeraldLight }}
                >
                  <Download size={14} color={C.emeraldDark} />
                  <Text className="text-xs font-semibold ml-1" style={{ color: C.emeraldDark }}>
                    Export
                  </Text>
                </Pressable>
                {openIssues.length > 0 && (
                  <View
                    className="px-3 py-1 rounded-full"
                    style={{ backgroundColor: C.error }}
                  >
                    <Text className="text-xs font-bold" style={{ color: C.white }}>
                      {openIssues.length}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {openIssues.length === 0 ? (
            <View
              className="rounded-xl p-6 items-center"
              style={{ backgroundColor: C.successBg, borderWidth: 1, borderColor: C.borderLight }}
            >
              <CheckCircle2 size={24} color={C.actionGreen} />
              <Text className="text-sm font-medium mt-2" style={{ color: C.actionGreen }}>
                No Open Issues
              </Text>
              <Text className="text-xs mt-1" style={{ color: C.textMuted }}>
                Aucun problème signalé
              </Text>
            </View>
          ) : (
            <View
              className="rounded-xl overflow-hidden"
              style={{
                backgroundColor: C.white,
                borderWidth: 1,
                borderColor: C.error,
                ...D.shadow.sm,
              }}
            >
              {openIssues.map((issue, index) => {
                const issueTypeLabels: Record<string, string> = {
                  out_of_supplies: 'Out of Supplies',
                  needs_cleaning: 'Needs Cleaning',
                  maintenance_required: 'Maintenance Required',
                  safety_concern: 'Safety Concern',
                  other: 'Other',
                };
                const issueLabel = issueTypeLabels[issue.issue_type] || issue.issue_type;

                return (
                  <View
                    key={issue.id}
                    className="p-4"
                    style={{
                      borderBottomWidth: index < openIssues.length - 1 ? 1 : 0,
                      borderBottomColor: C.borderLight,
                      backgroundColor: C.errorBg,
                    }}
                  >
                    {/* Issue Header */}
                    <View className="flex-row items-start justify-between mb-2">
                      <View className="flex-row items-center flex-1">
                        <AlertOctagon size={18} color={C.error} />
                        <Text
                          className="text-sm font-bold ml-2"
                          style={{ color: C.error }}
                          numberOfLines={1}
                        >
                          {issueLabel}
                        </Text>
                      </View>
                      <Text className="text-[10px]" style={{ color: C.textMuted }}>
                        {formatTimeAgo(issue.created_at)}
                      </Text>
                    </View>

                    {/* Location */}
                    <View className="flex-row items-center mb-2">
                      <MapPin size={14} color={C.textMuted} />
                      <Text className="text-xs ml-1" style={{ color: C.textPrimary }}>
                        {issue.location_name}
                      </Text>
                    </View>

                    {/* Description */}
                    {issue.description && (
                      <Text
                        className="text-xs mb-3 p-2 rounded-lg"
                        style={{ backgroundColor: C.white, color: C.textPrimary }}
                      >
                        "{issue.description}"
                      </Text>
                    )}

                    {/* Resolve Button */}
                    <Pressable
                      onPress={() => handleResolveIssue(issue.id)}
                      disabled={resolvingIssueId === issue.id}
                      className="flex-row items-center justify-center py-2 rounded-lg active:opacity-80"
                      style={{ backgroundColor: C.actionGreen }}
                    >
                      {resolvingIssueId === issue.id ? (
                        <ActivityIndicator size="small" color={C.white} />
                      ) : (
                        <>
                          <CheckCircle2 size={16} color={C.white} />
                          <Text className="text-sm font-bold ml-2" style={{ color: C.white }}>
                            Mark Resolved
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* INSPECTOR MODE - Available to all users */}
        <Animated.View
          entering={FadeIn.delay(400).duration(500)}
          className="px-5 py-4 mb-4"
        >
          <Pressable
            onPress={() => setShowInspectorMode(!showInspectorMode)}
            className="rounded-xl p-4"
            style={{ backgroundColor: C.emeraldDark }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <ClipboardList size={20} color={C.emeraldLight} />
                <View className="ml-2">
                  <Text className="text-base font-semibold text-white">
                    Send to Inspector
                  </Text>
                  <Text className="text-xs" style={{ color: C.emeraldLight }}>
                    Envoyer à l'inspecteur
                  </Text>
                </View>
              </View>
              <ChevronRight
                size={20}
                color={C.emeraldLight}
                style={{ transform: [{ rotate: showInspectorMode ? '90deg' : '0deg' }] }}
              />
            </View>

            {showInspectorMode && (
              <Pressable onPress={(e) => e.stopPropagation()}>
                <View className="mt-4">
                <Text className="text-sm mb-4" style={{ color: C.emeraldLight }}>
                  Generate audit reports for NB Department of Health compliance.
                </Text>

                <View className="mb-3">
                  <Text className="text-xs font-medium mb-2" style={{ color: C.emeraldLight }}>
                    Business Name / Nom de l'entreprise
                  </Text>
                  <TextInput
                    value={businessName}
                    onChangeText={setBusinessName}
                    placeholder="Enter business name"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    className="rounded-lg px-4 py-3 text-base text-white"
                    style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
                  />
                </View>

                <View className="mb-3">
                  <Text className="text-xs font-medium mb-2" style={{ color: C.emeraldLight }}>
                    Business Address / Adresse de l'entreprise
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      value={businessAddress}
                      onChangeText={setBusinessAddress}
                      placeholder="Enter business address"
                      placeholderTextColor="rgba(255,255,255,0.5)"
                      className="flex-1 rounded-lg px-4 py-3 text-base text-white"
                      style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
                    />
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleSaveBusinessAddress();
                      }}
                      disabled={isSavingAddress}
                      className="rounded-lg px-3 py-3"
                      style={{ backgroundColor: C.actionGreen }}
                    >
                      {isSavingAddress ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Save size={18} color="#fff" />
                      )}
                    </Pressable>
                  </View>
                </View>

                <View className="flex-row gap-3 mb-4">
                  <View className="flex-1">
                    <Text className="text-xs font-medium mb-2" style={{ color: C.emeraldLight }}>Start Date</Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={auditStartDate.toISOString().split('T')[0]}
                        onChange={(e) => setAuditStartDate(new Date(e.target.value))}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8,
                          padding: 12, color: '#fff', fontSize: 14, width: '100%',
                        }}
                      />
                    ) : (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          setShowStartPicker(true);
                        }}
                        className="flex-row items-center rounded-lg px-4 py-3"
                        style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
                      >
                        <Calendar size={16} color={C.emeraldLight} />
                        <Text className="text-white ml-2">
                          {auditStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-medium mb-2" style={{ color: C.emeraldLight }}>End Date</Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={auditEndDate.toISOString().split('T')[0]}
                        onChange={(e) => setAuditEndDate(new Date(e.target.value))}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8,
                          padding: 12, color: '#fff', fontSize: 14, width: '100%',
                        }}
                      />
                    ) : (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          setShowEndPicker(true);
                        }}
                        className="flex-row items-center rounded-lg px-4 py-3"
                        style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
                      >
                        <Calendar size={16} color={C.emeraldLight} />
                        <Text className="text-white ml-2">
                          {auditEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                <Pressable
                  onPress={generateAuditReportPDF}
                  disabled={isGeneratingReport}
                  className="flex-row items-center justify-center py-4 rounded-lg"
                  style={{ backgroundColor: C.actionGreen }}
                >
                  {isGeneratingReport ? (
                    <><ActivityIndicator size="small" color="#fff" /><Text className="text-white font-bold ml-2">Generating...</Text></>
                  ) : (
                    <><FileText size={20} color="#fff" /><Text className="text-white font-bold ml-2">Generate Audit Report (PDF)</Text></>
                  )}
                </Pressable>
              </View>
              </Pressable>
            )}
          </Pressable>
        </Animated.View>

        {/* Compliance Footer */}
        <Animated.View
          entering={FadeIn.delay(500).duration(500)}
          className="px-5 pb-4"
        >
          <View
            className="rounded-xl p-4 items-center"
            style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.borderMedium }}
          >
            <View className="flex-row items-center">
              <CheckCircle2 size={14} color={C.actionGreen} />
              <Text className="text-sm font-semibold ml-1.5" style={{ color: C.actionGreen }}>
                Compliance Verified
              </Text>
            </View>
            <Text className="text-xs mt-0.5" style={{ color: C.textMuted }}>
              Conformité vérifiée
            </Text>
          </View>
        </Animated.View>

        {/* Powered by Acadia Clean IQ Footer */}
        <View className="items-center pb-8">
          <Text className="text-xs" style={{ color: C.textMuted }}>
            Powered by <Text className="font-semibold" style={{ color: C.emeraldDark }}>Acadia Clean IQ</Text>
          </Text>
        </View>
      </ScrollView>

      {/* Location Settings Modal */}
      <Modal
        visible={!!selectedLocationId}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedLocationId(null)}
      >
        <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.background }}>
          {(() => {
            const location = displayLocations.find(l => l.id === selectedLocationId);
            if (!location) return null;

            return (
              <>
                <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderColor: COLORS.slate200 }}>
                  <Pressable onPress={() => setSelectedLocationId(null)}>
                    <Text className="text-base font-medium" style={{ color: COLORS.slate500 }}>Close</Text>
                  </Pressable>
                  <Text className="text-lg font-bold" style={{ color: COLORS.slate800 }} numberOfLines={1}>{location.name}</Text>
                  <View style={{ width: 50 }} />
                </View>
                <ScrollView className="flex-1 px-5 py-6">
                  {/* QR Code URL Actions */}
                  <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: '#dbeafe', borderWidth: 1, borderColor: '#93c5fd' }}>
                    <View className="mb-2">
                      <View className="flex-row items-center">
                        <Link size={16} color="#2563eb" />
                        <Text className="text-sm font-semibold ml-2" style={{ color: '#1e40af' }}>QR Code URL</Text>
                      </View>
                      <Text className="text-xs ml-6" style={{ color: '#3b82f6' }}>URL du code QR</Text>
                    </View>
                    <Text className="text-xs font-mono mb-3" style={{ color: '#1e3a8a' }} selectable>
                      {getLocationUrl(location.id)}
                    </Text>
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => handleCopyUrl(getLocationUrl(location.id))}
                        className="flex-1 items-center justify-center py-3 rounded-lg"
                        style={{ backgroundColor: '#2563eb' }}
                      >
                        <View className="flex-row items-center">
                          <Copy size={16} color="#fff" />
                          <Text className="text-white font-semibold ml-2">Copy</Text>
                        </View>
                        <Text className="text-white/80 text-[10px]">Copier</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleShareUrl(location.name, getLocationUrl(location.id))}
                        className="flex-1 items-center justify-center py-3 rounded-lg"
                        style={{ backgroundColor: COLORS.slate600 }}
                      >
                        <View className="flex-row items-center">
                          <ExternalLink size={16} color="#fff" />
                          <Text className="text-white font-semibold ml-2">Share</Text>
                        </View>
                        <Text className="text-white/80 text-[10px]">Partager</Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Universal Staff PIN - Managed here */}
                  <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: COLORS.amberLight, borderWidth: 1, borderColor: '#fcd34d' }}>
                    <Pressable
                      onPress={() => setShowPinManagement(!showPinManagement)}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <Key size={16} color="#92400e" />
                          <Text className="text-sm font-semibold ml-2" style={{ color: '#92400e' }}>Universal Staff PIN</Text>
                        </View>
                        <ChevronRight
                          size={18}
                          color="#92400e"
                          style={{ transform: [{ rotate: showPinManagement ? '90deg' : '0deg' }] }}
                        />
                      </View>
                      <Text className="text-xs mt-1" style={{ color: '#b45309' }}>NIP universel du personnel</Text>
                      {currentBusiness?.staff_pin_display ? (
                        <Text className="text-3xl font-black tracking-widest mt-2" style={{ color: '#92400e' }}>
                          {currentBusiness.staff_pin_display}
                        </Text>
                      ) : (
                        <Text className="text-sm italic mt-2" style={{ color: '#b45309' }}>
                          No PIN set - Tap to configure
                        </Text>
                      )}
                      <Text className="text-xs mt-1" style={{ color: '#b45309' }}>Share with staff only / Partager avec le personnel seulement</Text>
                    </Pressable>

                    {showPinManagement && (
                      <Pressable onPress={(e) => e.stopPropagation()}>
                        <View className="mt-4 pt-4" style={{ borderTopWidth: 1, borderTopColor: '#fcd34d' }}>
                          <Text className="text-xs mb-3" style={{ color: '#92400e' }}>
                            This PIN works for all your washroom locations. When changed, the old PIN is immediately invalidated.
                          </Text>
                          <Text className="text-xs mb-3 italic" style={{ color: '#b45309' }}>
                            Ce NIP fonctionne pour tous vos emplacements. Lorsqu'il est modifié, l'ancien NIP est immédiatement invalidé.
                          </Text>

                          <View className="mb-3">
                            <Text className="text-xs font-medium mb-2" style={{ color: '#92400e' }}>
                              New PIN (4-5 digits) / Nouveau NIP (4-5 chiffres)
                            </Text>
                            <TextInput
                              value={newStaffPin}
                              onChangeText={setNewStaffPin}
                              placeholder="Enter new PIN"
                              placeholderTextColor="#d97706"
                              keyboardType="numeric"
                              maxLength={5}
                              secureTextEntry
                              className="rounded-lg px-4 py-3 text-base"
                              style={{
                                backgroundColor: '#fef3c7',
                                borderWidth: 1,
                                borderColor: '#fcd34d',
                                color: '#92400e',
                              }}
                            />
                          </View>

                          <View className="mb-4">
                            <Text className="text-xs font-medium mb-2" style={{ color: '#92400e' }}>
                              Confirm PIN / Confirmer le NIP
                            </Text>
                            <TextInput
                              value={confirmStaffPin}
                              onChangeText={setConfirmStaffPin}
                              placeholder="Confirm new PIN"
                              placeholderTextColor="#d97706"
                              keyboardType="numeric"
                              maxLength={5}
                              secureTextEntry
                              className="rounded-lg px-4 py-3 text-base"
                              style={{
                                backgroundColor: '#fef3c7',
                                borderWidth: 1,
                                borderColor: '#fcd34d',
                                color: '#92400e',
                              }}
                            />
                          </View>

                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              handleSaveStaffPin();
                            }}
                            disabled={isSavingPin}
                            className="flex-row items-center justify-center py-3 rounded-lg"
                            style={{ backgroundColor: isSavingPin ? '#d97706' : '#92400e' }}
                          >
                            {isSavingPin ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Save size={18} color="#fff" />
                                <Text className="text-white font-bold ml-2">Save PIN</Text>
                                <Text className="text-white/80 text-xs ml-1">/ Enregistrer</Text>
                              </>
                            )}
                          </Pressable>
                        </View>
                      </Pressable>
                    )}
                  </View>

                  {/* View Public Page */}
                  <Pressable
                    onPress={() => handleViewPublicPage(location.id)}
                    className="items-center justify-center py-4 rounded-xl mb-4"
                    style={{ backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary }}
                  >
                    <View className="flex-row items-center">
                      <ExternalLink size={20} color={COLORS.primary} />
                      <Text className="font-bold ml-2" style={{ color: COLORS.primary }}>View Public Page</Text>
                    </View>
                    <Text className="text-xs" style={{ color: COLORS.primaryDark }}>Voir la page publique</Text>
                  </Pressable>

                  {/* Supervisor Email - Editable */}
                  <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate200 }}>
                    <View className="mb-2">
                      <View className="flex-row items-center">
                        <Mail size={16} color={COLORS.slate500} />
                        <Text className="text-sm font-semibold ml-2" style={{ color: COLORS.slate700 }}>Alert Email</Text>
                      </View>
                      <Text className="text-xs ml-6" style={{ color: COLORS.slate400 }}>Courriel d'alerte</Text>
                    </View>
                    <TextInput
                      value={editAlertEmail}
                      onChangeText={setEditAlertEmail}
                      placeholder="supervisor@example.com"
                      placeholderTextColor={COLORS.slate400}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      className="rounded-lg px-4 py-3 mb-3"
                      style={{
                        backgroundColor: COLORS.slate100,
                        borderWidth: 1,
                        borderColor: COLORS.slate200,
                        fontSize: 15,
                        color: COLORS.slate800,
                      }}
                    />
                    <Pressable
                      onPress={() => handleSaveAlertEmail(location.id)}
                      disabled={isSavingEmail}
                      className="flex-row items-center justify-center py-3 rounded-lg"
                      style={{ backgroundColor: isSavingEmail ? COLORS.slate400 : COLORS.primary }}
                    >
                      {isSavingEmail ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Save size={16} color="#fff" />
                          <Text className="text-white font-semibold ml-2">Save Email</Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  {/* Export History - Available to all users */}
                  <Pressable
                    onPress={() => openPremiumExportModal(location.id)}
                    className="items-center justify-center py-4 rounded-xl mb-4"
                    style={{ backgroundColor: '#2563eb' }}
                  >
                    <View className="flex-row items-center">
                      <Download size={20} color="#fff" />
                      <Text className="text-white font-bold ml-2">
                        Export History (PDF)
                      </Text>
                    </View>
                    <Text className="text-white/80 text-xs">
                      Exporter l'historique (PDF)
                    </Text>
                  </Pressable>

                  {/* Active Toggle */}
                  <View className="rounded-xl p-4 mb-4" style={{
                    backgroundColor: location.isActive !== false ? COLORS.primaryLight : COLORS.redLight,
                    borderWidth: 1,
                    borderColor: location.isActive !== false ? '#86efac' : '#fecaca'
                  }}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        <Power size={20} color={location.isActive !== false ? COLORS.primary : COLORS.red} />
                        <View className="ml-3">
                          <Text className="text-sm font-semibold" style={{ color: location.isActive !== false ? COLORS.primaryDark : COLORS.red }}>
                            {location.isActive !== false ? 'Location Active' : 'Location Inactive'}
                          </Text>
                          <Text className="text-xs" style={{ color: location.isActive !== false ? COLORS.slate500 : COLORS.red }}>
                            {location.isActive !== false ? 'Emplacement actif' : 'Emplacement inactif'}
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={location.isActive !== false}
                        onValueChange={() => handleToggleLocationActive(location)}
                        disabled={isTogglingActive}
                        trackColor={{ false: '#fca5a5', true: '#86efac' }}
                        thumbColor={location.isActive !== false ? COLORS.primary : COLORS.red}
                        ios_backgroundColor="#fca5a5"
                      />
                    </View>
                    <Text className="text-xs mt-2" style={{ color: COLORS.slate500 }}>
                      {location.isActive !== false
                        ? 'Turn off to hide this location from the cleaning app'
                        : 'Turn on to show this location in the cleaning app'}
                    </Text>
                  </View>
                </ScrollView>
              </>
            );
          })()}
        </SafeAreaView>
      </Modal>

      {/* Newly Created Location Success Modal */}
      <Modal
        visible={!!newlyCreatedLocation}
        animationType="fade"
        transparent
        onRequestClose={() => setNewlyCreatedLocation(null)}
      >
        <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: COLORS.white }}>
            <View className="items-center mb-4">
              <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: COLORS.primaryLight }}>
                <CheckCircle2 size={32} color={COLORS.primary} />
              </View>
            </View>
            <Text className="text-xl font-bold text-center mb-2" style={{ color: COLORS.slate800 }}>
              Location Created!
            </Text>
            <Text className="text-base font-semibold text-center mb-4" style={{ color: COLORS.primary }}>
              {newlyCreatedLocation?.name}
            </Text>
            <View className="rounded-lg p-3 mb-4" style={{ backgroundColor: COLORS.slate100 }}>
              <Text className="text-xs text-center font-mono" style={{ color: COLORS.slate700 }} selectable>
                {newlyCreatedLocation ? getLocationUrl(newlyCreatedLocation.id) : ''}
              </Text>
            </View>
            <View className="flex-row gap-2 mb-3">
              <Pressable
                onPress={() => newlyCreatedLocation && handleCopyUrl(getLocationUrl(newlyCreatedLocation.id))}
                className="flex-1 flex-row items-center justify-center py-3 rounded-lg"
                style={{ backgroundColor: COLORS.primary }}
              >
                <Copy size={16} color="#fff" />
                <Text className="text-white font-semibold ml-2">Copy URL</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => setNewlyCreatedLocation(null)}
              className="py-3 items-center"
            >
              <Text className="font-medium" style={{ color: COLORS.slate500 }}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      {showStartPicker && Platform.OS !== 'web' && (
        <Modal transparent animationType="slide" visible={showStartPicker} onRequestClose={() => setShowStartPicker(false)}>
          <View className="flex-1 bg-black/50 justify-end">
            <Pressable className="flex-1" onPress={() => setShowStartPicker(false)} />
            <View className="bg-white rounded-t-3xl p-4 pb-8">
              <View className="flex-row justify-between items-center mb-4 px-2">
                <Text className="text-lg font-bold" style={{ color: COLORS.slate800 }}>Select Start Date</Text>
                <Pressable onPress={() => setShowStartPicker(false)} className="px-4 py-2 rounded-lg" style={{ backgroundColor: COLORS.indigo }}>
                  <Text className="text-white font-semibold">Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={auditStartDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                onChange={(event, date) => {
                  if (Platform.OS === 'android') {
                    setShowStartPicker(false);
                  }
                  if (date && event.type !== 'dismissed') {
                    setAuditStartDate(date);
                  }
                }}
                maximumDate={auditEndDate}
                style={{ height: 200, width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}

      {showEndPicker && Platform.OS !== 'web' && (
        <Modal transparent animationType="slide" visible={showEndPicker} onRequestClose={() => setShowEndPicker(false)}>
          <View className="flex-1 bg-black/50 justify-end">
            <Pressable className="flex-1" onPress={() => setShowEndPicker(false)} />
            <View className="bg-white rounded-t-3xl p-4 pb-8">
              <View className="flex-row justify-between items-center mb-4 px-2">
                <Text className="text-lg font-bold" style={{ color: COLORS.slate800 }}>Select End Date</Text>
                <Pressable onPress={() => setShowEndPicker(false)} className="px-4 py-2 rounded-lg" style={{ backgroundColor: COLORS.indigo }}>
                  <Text className="text-white font-semibold">Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={auditEndDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                onChange={(event, date) => {
                  if (Platform.OS === 'android') {
                    setShowEndPicker(false);
                  }
                  if (date && event.type !== 'dismissed') {
                    setAuditEndDate(date);
                  }
                }}
                minimumDate={auditStartDate}
                maximumDate={new Date()}
                style={{ height: 200, width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* View 14 Days Modal */}
      <Modal
        visible={show14DaysModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShow14DaysModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: C.mintBackground }}>
          <View className="flex-1">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: C.borderLight }}>
              <View className="flex-1">
                <Text className="text-lg font-bold" style={{ color: C.emeraldDark }}>
                  {viewing14DaysLocationName}
                </Text>
                <Text className="text-sm" style={{ color: C.textSecondary }}>
                  Last 14 Days / 14 derniers jours
                </Text>
              </View>
              <Pressable
                onPress={() => setShow14DaysModal(false)}
                className="p-2 rounded-full"
                style={{ backgroundColor: C.borderLight }}
              >
                <X size={20} color={C.textSecondary} />
              </Pressable>
            </View>

            {/* Content */}
            {isLoading14DaysLogs ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color={C.actionGreen} />
                <Text className="mt-3 text-sm" style={{ color: C.textSecondary }}>Loading logs...</Text>
              </View>
            ) : fourteenDaysLogs.length === 0 ? (
              <View className="flex-1 items-center justify-center px-8">
                <ClipboardList size={48} color={C.textMuted} />
                <Text className="text-base font-medium mt-4 text-center" style={{ color: C.textSecondary }}>
                  No cleaning logs found
                </Text>
                <Text className="text-sm mt-2 text-center" style={{ color: C.textMuted }}>
                  Aucun journal de nettoyage trouvé
                </Text>
              </View>
            ) : (
              <ScrollView className="flex-1 px-5 py-4">
                {fourteenDaysLogs.map((log, index) => (
                  <View
                    key={log.id}
                    className="rounded-xl p-4 mb-3"
                    style={{
                      backgroundColor: C.white,
                      borderWidth: 1,
                      borderColor: log.status === 'complete' ? '#86efac' : '#fcd34d',
                    }}
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-sm font-semibold" style={{ color: C.emeraldDark }}>
                        {new Date(log.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {' '}
                        {new Date(log.timestamp).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </Text>
                      <View
                        className="px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: log.status === 'complete' ? '#dcfce7' : '#fef3c7',
                        }}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{
                            color: log.status === 'complete' ? '#166534' : '#92400e',
                          }}
                        >
                          {log.status === 'complete' ? '✓ Complete' : '⚠ Attention'}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-sm" style={{ color: C.textSecondary }}>
                      Staff: {log.staff_name}
                    </Text>
                    {log.status !== 'complete' && log.notes && (
                      <Text className="text-xs mt-2 italic" style={{ color: C.warning }}>
                        Note: {log.notes}
                      </Text>
                    )}
                  </View>
                ))}

                {/* Upgrade Prompt at Bottom */}
                <View className="rounded-xl p-4 mt-2 mb-6" style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <View className="flex-row items-center mb-2">
                    <Crown size={16} color="#d97706" />
                    <Text className="text-sm font-semibold ml-2" style={{ color: '#1e293b' }}>
                      Need to export?
                    </Text>
                  </View>
                  <Text className="text-xs" style={{ color: '#64748b' }}>
                    Upgrade to Premium for PDF exports, custom date ranges, and audit reports for inspectors.
                  </Text>
                  <Pressable
                    onPress={() => {
                      setShow14DaysModal(false);
                      setShowUpgradeModal(true);
                    }}
                    className="mt-3 py-2 rounded-lg items-center"
                    style={{ backgroundColor: '#fbbf24' }}
                  >
                    <Text className="text-sm font-bold" style={{ color: '#78350f' }}>
                      Upgrade to Premium
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Upgrade to Premium Modal */}
      <Modal
        visible={showUpgradeModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <View className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="mx-6 rounded-2xl p-6" style={{ backgroundColor: C.white, maxWidth: 340, width: '100%' }}>
            <View className="items-center mb-4">
              <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: '#fef3c7' }}>
                <Crown size={32} color="#d97706" />
              </View>
              <Text className="text-xl font-bold text-center" style={{ color: C.emeraldDark }}>
                Upgrade to Premium
              </Text>
              <Text className="text-sm text-center mt-2" style={{ color: C.textSecondary }}>
                Passez à Premium
              </Text>
            </View>

            <View className="mb-4">
              <View className="flex-row items-center mb-2">
                <CheckCircle2 size={16} color={C.actionGreen} />
                <Text className="text-sm ml-2" style={{ color: C.textPrimary }}>
                  Export 1-month history (PDF)
                </Text>
              </View>
              <View className="flex-row items-center mb-2">
                <CheckCircle2 size={16} color={C.actionGreen} />
                <Text className="text-sm ml-2" style={{ color: C.textPrimary }}>
                  Send to Inspector audit reports
                </Text>
              </View>
              <View className="flex-row items-center mb-2">
                <CheckCircle2 size={16} color={C.actionGreen} />
                <Text className="text-sm ml-2" style={{ color: C.textPrimary }}>
                  Custom date range selection
                </Text>
              </View>
              <View className="flex-row items-center">
                <CheckCircle2 size={16} color={C.actionGreen} />
                <Text className="text-sm ml-2" style={{ color: C.textPrimary }}>
                  Professional compliance reports
                </Text>
              </View>
            </View>

            <View className="rounded-xl p-3 mb-4" style={{ backgroundColor: '#f0fdf4' }}>
              <Text className="text-xs text-center" style={{ color: C.textSecondary }}>
                Contact us to upgrade your account
              </Text>
              <Text className="text-sm font-semibold text-center mt-1" style={{ color: C.emeraldDark }}>
                jay@acadiacleaniq.ca
              </Text>
            </View>

            <Pressable
              onPress={() => setShowUpgradeModal(false)}
              className="py-3 rounded-xl items-center"
              style={{ backgroundColor: C.borderLight }}
            >
              <Text className="font-semibold" style={{ color: C.textSecondary }}>
                Close / Fermer
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Premium Export Modal - Date Range Selection */}
      <Modal
        visible={showPremiumExportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPremiumExportModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: C.mintBackground }}>
          <View className="flex-1">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: C.borderLight }}>
              <View className="flex-1">
                <Text className="text-lg font-bold" style={{ color: C.emeraldDark }}>
                  Export History
                </Text>
                <Text className="text-sm" style={{ color: C.textSecondary }}>
                  {premiumExportLocationName}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowPremiumExportModal(false)}
                className="p-2 rounded-full"
                style={{ backgroundColor: C.borderLight }}
              >
                <X size={20} color={C.textSecondary} />
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 py-4">
              {/* Date Range Selection */}
              <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.borderMedium }}>
                <Text className="text-sm font-semibold mb-3" style={{ color: C.emeraldDark }}>
                  Select Date Range / Sélectionner la période
                </Text>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-xs font-medium mb-2" style={{ color: C.textSecondary }}>Start Date</Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={premiumExportStartDate.toISOString().split('T')[0]}
                        onChange={(e) => setPremiumExportStartDate(new Date(e.target.value))}
                        style={{
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: 12,
                          color: '#1e293b',
                          fontSize: 14,
                          width: '100%',
                        }}
                      />
                    ) : (
                      <Pressable
                        onPress={() => setShowPremiumStartPicker(true)}
                        className="flex-row items-center rounded-lg px-4 py-3"
                        style={{ backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' }}
                      >
                        <Calendar size={16} color={C.textSecondary} />
                        <Text className="ml-2" style={{ color: C.textPrimary }}>
                          {premiumExportStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-medium mb-2" style={{ color: C.textSecondary }}>End Date</Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={premiumExportEndDate.toISOString().split('T')[0]}
                        onChange={(e) => setPremiumExportEndDate(new Date(e.target.value))}
                        style={{
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: 12,
                          color: '#1e293b',
                          fontSize: 14,
                          width: '100%',
                        }}
                      />
                    ) : (
                      <Pressable
                        onPress={() => setShowPremiumEndPicker(true)}
                        className="flex-row items-center rounded-lg px-4 py-3"
                        style={{ backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' }}
                      >
                        <Calendar size={16} color={C.textSecondary} />
                        <Text className="ml-2" style={{ color: C.textPrimary }}>
                          {premiumExportEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>

              {/* Quick Select Buttons */}
              <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.borderMedium }}>
                <Text className="text-xs font-medium mb-3" style={{ color: C.textSecondary }}>
                  Quick Select / Sélection rapide
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(start.getDate() - 7);
                      setPremiumExportStartDate(start);
                      setPremiumExportEndDate(end);
                    }}
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#f1f5f9' }}
                  >
                    <Text className="text-xs font-medium" style={{ color: C.textPrimary }}>Last 7 Days</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(start.getDate() - 14);
                      setPremiumExportStartDate(start);
                      setPremiumExportEndDate(end);
                    }}
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#f1f5f9' }}
                  >
                    <Text className="text-xs font-medium" style={{ color: C.textPrimary }}>Last 14 Days</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(start.getDate() - 30);
                      setPremiumExportStartDate(start);
                      setPremiumExportEndDate(end);
                    }}
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#f1f5f9' }}
                  >
                    <Text className="text-xs font-medium" style={{ color: C.textPrimary }}>Last 30 Days</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(start.getDate() - 90);
                      setPremiumExportStartDate(start);
                      setPremiumExportEndDate(end);
                    }}
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#f1f5f9' }}
                  >
                    <Text className="text-xs font-medium" style={{ color: C.textPrimary }}>Last 90 Days</Text>
                  </Pressable>
                </View>
              </View>

              {/* Export Button */}
              <Pressable
                onPress={handlePremiumExport}
                disabled={isPremiumExporting}
                className="flex-row items-center justify-center py-4 rounded-xl mb-4"
                style={{ backgroundColor: isPremiumExporting ? '#94a3b8' : C.actionGreen }}
              >
                {isPremiumExporting ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text className="text-white font-bold ml-2">Generating PDF...</Text>
                  </>
                ) : (
                  <>
                    <Download size={20} color="#fff" />
                    <Text className="text-white font-bold ml-2">Export to PDF</Text>
                  </>
                )}
              </Pressable>

              <Text className="text-xs text-center mb-6" style={{ color: C.textMuted }}>
                PDF will include all cleaning logs for the selected location within the date range.
              </Text>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Premium Export Date Pickers (Mobile) */}
      {Platform.OS !== 'web' && showPremiumStartPicker && (
        <Modal transparent animationType="slide" visible={showPremiumStartPicker} onRequestClose={() => setShowPremiumStartPicker(false)}>
          <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <View className="bg-white rounded-t-3xl p-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-lg font-semibold" style={{ color: C.emeraldDark }}>Start Date</Text>
                <Pressable onPress={() => setShowPremiumStartPicker(false)} className="px-4 py-2">
                  <Text className="font-semibold" style={{ color: C.actionGreen }}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={premiumExportStartDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => {
                  if (date) {
                    setPremiumExportStartDate(date);
                  }
                }}
                maximumDate={premiumExportEndDate}
                style={{ height: 200, width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS !== 'web' && showPremiumEndPicker && (
        <Modal transparent animationType="slide" visible={showPremiumEndPicker} onRequestClose={() => setShowPremiumEndPicker(false)}>
          <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <View className="bg-white rounded-t-3xl p-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-lg font-semibold" style={{ color: C.emeraldDark }}>End Date</Text>
                <Pressable onPress={() => setShowPremiumEndPicker(false)} className="px-4 py-2">
                  <Text className="font-semibold" style={{ color: C.actionGreen }}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={premiumExportEndDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => {
                  if (date) {
                    setPremiumExportEndDate(date);
                  }
                }}
                minimumDate={premiumExportStartDate}
                maximumDate={new Date()}
                style={{ height: 200, width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Incident Reports Export Modal */}
      <Modal
        visible={showIncidentExportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowIncidentExportModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: C.mintBackground }}>
          <View className="flex-1">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: C.borderLight }}>
              <View className="flex-1">
                <Text className="text-lg font-bold" style={{ color: C.emeraldDark }}>
                  Incident Reports
                </Text>
                <Text className="text-sm" style={{ color: C.textSecondary }}>
                  Rapports d'incidents
                </Text>
              </View>
              <Pressable
                onPress={() => setShowIncidentExportModal(false)}
                className="p-2 rounded-full"
                style={{ backgroundColor: C.borderLight }}
              >
                <X size={20} color={C.textSecondary} />
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 py-4">
              {/* Date Range Selection */}
              <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.borderMedium }}>
                <Text className="text-sm font-semibold mb-3" style={{ color: C.emeraldDark }}>
                  Select Date Range / Sélectionner la période
                </Text>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-xs font-medium mb-2" style={{ color: C.textSecondary }}>Start Date</Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={incidentExportStartDate.toISOString().split('T')[0]}
                        onChange={(e) => setIncidentExportStartDate(new Date(e.target.value))}
                        style={{
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: 12,
                          color: '#1e293b',
                          fontSize: 14,
                          width: '100%',
                        }}
                      />
                    ) : (
                      <Pressable
                        onPress={() => setShowIncidentStartPicker(true)}
                        className="flex-row items-center rounded-lg px-4 py-3"
                        style={{ backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' }}
                      >
                        <Calendar size={16} color={C.textSecondary} />
                        <Text className="ml-2" style={{ color: C.textPrimary }}>
                          {incidentExportStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-medium mb-2" style={{ color: C.textSecondary }}>End Date</Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={incidentExportEndDate.toISOString().split('T')[0]}
                        onChange={(e) => setIncidentExportEndDate(new Date(e.target.value))}
                        style={{
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: 12,
                          color: '#1e293b',
                          fontSize: 14,
                          width: '100%',
                        }}
                      />
                    ) : (
                      <Pressable
                        onPress={() => setShowIncidentEndPicker(true)}
                        className="flex-row items-center rounded-lg px-4 py-3"
                        style={{ backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' }}
                      >
                        <Calendar size={16} color={C.textSecondary} />
                        <Text className="ml-2" style={{ color: C.textPrimary }}>
                          {incidentExportEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>

              {/* Quick Select Buttons */}
              <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.borderMedium }}>
                <Text className="text-xs font-medium mb-3" style={{ color: C.textSecondary }}>
                  Quick Select / Sélection rapide
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(start.getDate() - 7);
                      setIncidentExportStartDate(start);
                      setIncidentExportEndDate(end);
                    }}
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#f1f5f9' }}
                  >
                    <Text className="text-xs font-medium" style={{ color: C.textPrimary }}>Last 7 Days</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(start.getDate() - 30);
                      setIncidentExportStartDate(start);
                      setIncidentExportEndDate(end);
                    }}
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#f1f5f9' }}
                  >
                    <Text className="text-xs font-medium" style={{ color: C.textPrimary }}>Last 30 Days</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(start.getDate() - 90);
                      setIncidentExportStartDate(start);
                      setIncidentExportEndDate(end);
                    }}
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#f1f5f9' }}
                  >
                    <Text className="text-xs font-medium" style={{ color: C.textPrimary }}>Last 90 Days</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setMonth(start.getMonth() - 6);
                      setIncidentExportStartDate(start);
                      setIncidentExportEndDate(end);
                    }}
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#f1f5f9' }}
                  >
                    <Text className="text-xs font-medium" style={{ color: C.textPrimary }}>Last 6 Months</Text>
                  </Pressable>
                </View>
              </View>

              {/* Include Open Issues Toggle */}
              <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.borderMedium }}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold" style={{ color: C.textPrimary }}>
                      Include Open Issues
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: C.textMuted }}>
                      Inclure les problèmes en cours
                    </Text>
                  </View>
                  <Switch
                    value={includeOpenIncidents}
                    onValueChange={setIncludeOpenIncidents}
                    trackColor={{ false: '#d1d5db', true: C.emeraldLight }}
                    thumbColor={includeOpenIncidents ? C.actionGreen : '#f4f3f4'}
                  />
                </View>
              </View>

              {/* Summary Preview */}
              <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: C.emeraldLight, borderWidth: 1, borderColor: C.borderMedium }}>
                <Text className="text-xs font-medium mb-2" style={{ color: C.emeraldDark }}>
                  Report Preview / Aperçu du rapport
                </Text>
                <View className="flex-row gap-4">
                  <View className="items-center">
                    <Text className="text-2xl font-bold" style={{ color: C.emeraldDark }}>
                      {reportedIssues.length}
                    </Text>
                    <Text className="text-xs" style={{ color: C.textSecondary }}>Total Issues</Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-2xl font-bold" style={{ color: C.actionGreen }}>
                      {reportedIssues.filter(i => i.status === 'resolved').length}
                    </Text>
                    <Text className="text-xs" style={{ color: C.textSecondary }}>Resolved</Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-2xl font-bold" style={{ color: C.warning }}>
                      {reportedIssues.filter(i => i.status === 'open').length}
                    </Text>
                    <Text className="text-xs" style={{ color: C.textSecondary }}>Open</Text>
                  </View>
                </View>
              </View>

              {/* Export Button */}
              <Pressable
                onPress={handleExportIncidentReports}
                disabled={isExportingIncidents}
                className="flex-row items-center justify-center py-4 rounded-xl mb-4"
                style={{ backgroundColor: isExportingIncidents ? '#94a3b8' : C.actionGreen }}
              >
                {isExportingIncidents ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text className="text-white font-bold ml-2">Generating PDF...</Text>
                  </>
                ) : (
                  <>
                    <Download size={20} color="#fff" />
                    <Text className="text-white font-bold ml-2">Export Incident Reports</Text>
                  </>
                )}
              </Pressable>

              <Text className="text-xs text-center mb-6" style={{ color: C.textMuted }}>
                PDF will include all incident reports within the date range with resolution metrics.
              </Text>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Incident Reports Date Pickers (Mobile) */}
      {Platform.OS !== 'web' && showIncidentStartPicker && (
        <Modal transparent animationType="slide" visible={showIncidentStartPicker} onRequestClose={() => setShowIncidentStartPicker(false)}>
          <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <View className="bg-white rounded-t-3xl p-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-lg font-semibold" style={{ color: C.emeraldDark }}>Start Date</Text>
                <Pressable onPress={() => setShowIncidentStartPicker(false)} className="px-4 py-2">
                  <Text className="font-semibold" style={{ color: C.actionGreen }}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={incidentExportStartDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => {
                  if (date) {
                    setIncidentExportStartDate(date);
                  }
                }}
                maximumDate={incidentExportEndDate}
                style={{ height: 200, width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS !== 'web' && showIncidentEndPicker && (
        <Modal transparent animationType="slide" visible={showIncidentEndPicker} onRequestClose={() => setShowIncidentEndPicker(false)}>
          <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <View className="bg-white rounded-t-3xl p-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-lg font-semibold" style={{ color: C.emeraldDark }}>End Date</Text>
                <Pressable onPress={() => setShowIncidentEndPicker(false)} className="px-4 py-2">
                  <Text className="font-semibold" style={{ color: C.actionGreen }}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={incidentExportEndDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => {
                  if (date) {
                    setIncidentExportEndDate(date);
                  }
                }}
                minimumDate={incidentExportStartDate}
                maximumDate={new Date()}
                style={{ height: 200, width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}
